#!/usr/bin/env node
// PostToolUse (Write|Edit|MultiEdit): fast, deterministic checks on the file just edited.
// Errors are fed back to Claude (exit 2) so it fixes them immediately; warnings are added as context.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { addContext, findUp, projectDir, readHookInput, readStackFromPom } from "./lib.mjs";

const input = await readHookInput();
const root = projectDir(input);
const file = input.tool_input?.file_path ? resolve(root, input.tool_input.file_path) : null;
if (!file || !existsSync(file)) process.exit(0);

const rel = relative(root, file).replace(/\\/g, "/");
// Skip the agent kit itself (eval fixtures are intentionally flawed) and generated folders.
if (/^\.claude\/|(^|\/)(node_modules|target|build|dist)\//.test(rel)) process.exit(0);

const ext = extname(file).toLowerCase();
const src = readFileSync(file, "utf8");
const lines = src.split(/\r?\n/);
const errors = [];
const warnings = [];

/** Report every line matching `re` (ignores //, * and # comment lines). */
function scan(re, list, message) {
  lines.forEach((line, i) => {
    if (/^\s*(\/\/|\*|#)/.test(line)) return;
    if (re.test(line)) list.push(`${rel}:${i + 1} ${message}`);
  });
}

if (ext === ".java") {
  const isTest = /\/src\/test\//.test(rel);
  const stack = readStackFromPom(findUp(file, "pom.xml", root));

  // Namespace consistency with the declared Spring Boot version.
  const JAVAX_EE = /^\s*import\s+javax\.(persistence|servlet|validation|annotation\.(PostConstruct|PreDestroy)|transaction\.Transactional|inject)\b/;
  const JAKARTA = /^\s*import\s+jakarta\./;
  if (stack.bootMajor >= 3) scan(JAVAX_EE, errors, `javax.* import but Spring Boot ${stack.bootVersion} requires jakarta.*`);
  if (stack.bootMajor && stack.bootMajor < 3) scan(JAKARTA, errors, `jakarta.* import but Spring Boot ${stack.bootVersion} uses javax.*`);
  if (stack.bootMajor >= 3 && stack.javaRelease && stack.javaRelease < 17) {
    errors.push(`${rel}: pom.xml declares Spring Boot ${stack.bootVersion} with Java ${stack.javaRelease} — Spring Boot 3 requires Java 17+.`);
  }

  // Java 17 language level guard: a local JDK 21 accepts these, `--release 17` does not.
  if (stack.javaRelease === 17) {
    const J18PLUS = [
      [/Thread\.(ofVirtual|ofPlatform|startVirtualThread)\b|newVirtualThreadPerTaskExecutor/, "virtual threads (Java 21)"],
      [/\bcase\s+[A-Z][\w.]*(<[^>]*>)?\s+[a-z]\w*\s*(->|:|when\b)/, "type pattern in switch (Java 21)"],
      [/\binstanceof\s+[A-Z][\w.]*(<[^>]*>)?\s*\(/, "record pattern (Java 21)"],
      [/\bMath\.clamp\(|\.splitWithDelimiters\(|\bSTR\."/, "Java 21+ API / string template"],
    ];
    for (const [re, what] of J18PLUS) scan(re, errors, `${what} not available with --release 17`);
    scan(/\.(getFirst|getLast|removeFirst|removeLast|reversed)\(\)/, warnings,
      "getFirst/getLast/reversed() on a List/Set is Java 21 (SequencedCollection); fine only on Deque/Comparator");
  }

  // Spring Boot 3 idioms.
  if (stack.bootMajor >= 3) {
    scan(/WebSecurityConfigurerAdapter/, errors, "WebSecurityConfigurerAdapter was removed in Spring Security 6 — declare a SecurityFilterChain bean");
    scan(/\.(antMatchers|mvcMatchers)\(/, errors, "antMatchers/mvcMatchers removed in Spring Security 6 — use requestMatchers");
    scan(/new\s+RestTemplate\s*\(/, warnings, "New RestTemplate code — prefer RestClient (Boot 3.2+) or WebClient");
  }

  // Kafka (Spring for Apache Kafka).
  if (/org\.(springframework\.kafka|apache\.kafka)/.test(src)) {
    scan(/(addTrustedPackages|trustedPackages)\s*\(\s*"\*"|TRUSTED_PACKAGES\s*,\s*"\*"/, errors, "JsonDeserializer trusts all packages — untrusted deserialization risk; list packages explicitly");
    scan(/ENABLE_AUTO_COMMIT_CONFIG\s*,\s*(true|"true")/, errors, "Kafka auto-commit enabled — offsets committed before processing, messages can be lost");
    scan(/ENABLE_IDEMPOTENCE_CONFIG\s*,\s*(false|"false")|ACKS_CONFIG\s*,\s*"(0|1)"/, errors, "Producer durability weakened — keep acks=all and idempotence enabled");
    scan(/@KafkaListener\s*\((?![^)]*groupId)/, warnings, "@KafkaListener without explicit groupId (ok only if spring.kafka.consumer.group-id is set deliberately)");
    scan(/@KafkaListener\s*\([^)]*topics\s*=\s*\{?\s*"[^$"]/, warnings, "Hard-coded topic name — use a ${...} property");
    scan(/^\s*\w*[kK]afka[tT]emplate\.send\(.*\);\s*$/, warnings, "KafkaTemplate.send result ignored — observe the CompletableFuture (log + metric on failure)");
    scan(/\.send\([^;]*\)\.get\(\s*\)/, warnings, "Blocking send().get() without timeout");
    if (/@Transactional/.test(src) && /[kK]afka[tT]emplate\.send\(/.test(src) && /\.(save|saveAndFlush|persist|merge|update)\(/.test(src)) {
      warnings.push(`${rel}: DB write and Kafka send in the same class with @Transactional — possible dual write; use outbox or AFTER_COMMIT publishing`);
    }
  }

  // Security policy flags (Telenet).
  scan(/(createQuery|createNativeQuery|executeQuery|executeUpdate|prepareStatement|queryForList|queryForObject|queryForMap|\.query|\.update|\.execute)\s*\(\s*"[^"]*"\s*\+/, errors, "SQL built by string concatenation — use a parameterized query");
  scan(/"\s*(SELECT|INSERT|UPDATE|DELETE)\b[^"]*"\s*\+\s*\w/i, errors, "SQL built by string concatenation — use a parameterized query");
  scan(/new\s+ObjectInputStream\s*\(/, errors, "Deserialization of untrusted data risk (ObjectInputStream) — use JSON with explicit types");
  scan(/enableDefaultTyping|activateDefaultTyping|JsonTypeInfo\.Id\.CLASS/, errors, "Jackson polymorphic default typing — deserialization risk");
  if (/(DocumentBuilderFactory|SAXParserFactory|XMLInputFactory|TransformerFactory)\.newInstance\(/.test(src) &&
      !/disallow-doctype-decl|ACCESS_EXTERNAL_DTD|SUPPORT_DTD|external-general-entities/.test(src)) {
    errors.push(`${rel}: XML parser created without disabling external entities — XXE risk`);
  }
  scan(/(MultipartFile|@RequestPart)/, warnings, "File upload: validate size/type, prevent path traversal, store outside webroot, consider malware scan");
  scan(/(new\s+URL\s*\(|RestTemplate|WebClient|HttpClient)/, warnings, "Outbound HTTP: if the URL/host is user-influenced, SSRF risk — use an allow-list");
  scan(/@CrossOrigin\s*(\(\s*\)|\(\s*(origins\s*=\s*)?"\*")|allowedOrigins\s*\(\s*"\*"/, errors, "CORS allows any origin");

  // Hygiene.
  if (!isTest) {
    scan(/System\.(out|err)\.print/, warnings, "System.out/err — use SLF4J");
    scan(/\.printStackTrace\(\)/, warnings, "printStackTrace() — log with log.error(\"...\", ex)");
    scan(/^\s*@Autowired\s*$/, warnings, "Field injection — use constructor injection with final fields");
    scan(/log\.(trace|debug|info|warn|error)\s*\(\s*"[^"]*"\s*\+/, warnings, "String-concatenated log — use {} placeholders");
    scan(/catch\s*\(\s*(Exception|Throwable)\s+\w+\s*\)\s*\{\s*\}/, warnings, "Empty catch of Exception/Throwable");
  }
}

if ([".js", ".jsx", ".ts", ".tsx"].includes(ext)) {
  const isTest = /\.(test|spec)\.[jt]sx?$|__tests__\//.test(rel);
  scan(/dangerouslySetInnerHTML/, src.includes("DOMPurify") ? warnings : errors, "dangerouslySetInnerHTML without DOMPurify sanitisation — XSS risk");
  scan(/\beval\s*\(|new\s+Function\s*\(/, errors, "eval/new Function — code injection risk");
  scan(/(localStorage|sessionStorage)\.setItem\s*\(\s*["'`][^"'`]*(token|jwt|auth)/i, errors, "Token stored in web storage — use the OKTA SDK token handling");
  scan(/[?&](token|access_token|password|apikey|api_key)=/i, errors, "Secret/token in URL query string");
  scan(/target=["']_blank["'](?![^>]*rel=["'][^"']*noopener)/, warnings, "target=_blank without rel=\"noopener noreferrer\"");
  if (!isTest) {
    scan(/console\.(log|debug)\(/, warnings, "console.log left in code");
    scan(/eslint-disable(?!-next-line\s+\S)/, warnings, "Broad eslint-disable");
    if (ext === ".ts" || ext === ".tsx") scan(/:\s*any\b|as\s+any\b|<any>/, warnings, "`any` type");
    scan(/key=\{\s*(i|idx|index)\s*\}/, warnings, "Array index used as React key");
  }

  // Run the project's own ESLint on the file if it is installed (no network, no install).
  const pkg = findUp(file, "package.json", root);
  if (pkg) {
    const bin = join(dirname(pkg), "node_modules", ".bin", process.platform === "win32" ? "eslint.cmd" : "eslint");
    if (existsSync(bin)) {
      const res = spawnSync(bin, ["--no-warn-ignored", "--format", "unix", file], {
        cwd: dirname(pkg), encoding: "utf8", timeout: 30000, shell: process.platform === "win32",
      });
      if (res.status === 1 && res.stdout) {
        errors.push("ESLint:\n" + res.stdout.split(/\r?\n/).filter(Boolean).slice(0, 20).join("\n"));
      }
    }
  }
}

if (/(^|\/)package\.json$/.test(rel)) {
  try {
    const json = JSON.parse(src);
    for (const section of ["dependencies", "devDependencies"]) {
      for (const [dep, ver] of Object.entries(json[section] || {})) {
        if (/^(git\+|git:|github:|https?:)/.test(ver)) errors.push(`${rel}: ${dep} pulled from unverified source (${ver})`);
        else if (/^[\^~><*]|\|\||^latest$/.test(ver)) warnings.push(`${rel}: ${dep}@${ver} is not pinned to an exact version`);
      }
    }
  } catch {
    errors.push(`${rel}: invalid JSON`);
  }
}

if (/(^|\/)application[\w-]*\.(ya?ml|properties)$/.test(rel)) {
  const localProfile = /application-(local|dev|test)\b/.test(rel);
  const cfg = (re, list, message) => scan(re, list, message);
  cfg(/trusted[.-]packages\s*[:=]\s*["']?\*/, errors, "spring.json.trusted.packages=* — untrusted deserialization risk; list packages explicitly");
  cfg(/enable[.-]auto[.-]commit\s*[:=]\s*["']?true/, errors, "Kafka auto-commit enabled — messages can be lost; let the listener container commit");
  cfg(/\backs\s*[:=]\s*["']?(0|1)["']?\s*$/, errors, "Producer acks below 'all' — weakened durability");
  cfg(/enable[.-]idempotence\s*[:=]\s*["']?false/, errors, "Producer idempotence disabled — duplicates on retry");
  if (!localProfile) {
    cfg(/security[.-]protocol\s*[:=]\s*["']?PLAINTEXT/, errors, "Kafka PLAINTEXT outside a local profile — use SASL_SSL / SSL");
    cfg(/ddl-auto\s*[:=]\s*["']?(update|create|create-drop)/, warnings, "Hibernate ddl-auto mutating the schema — use Flyway/Liquibase");
  }
  if (/value-deserializer\s*[:=].*JsonDeserializer/.test(src) && !/ErrorHandlingDeserializer/.test(src)) {
    warnings.push(`${rel}: JsonDeserializer not wrapped in ErrorHandlingDeserializer — a poison pill will block the partition`);
  }
  cfg(/bootstrap-servers\s*[:=]\s*(?!\$\{)\S*(prod|prd)/i, warnings, "Hard-coded production bootstrap servers — use an environment placeholder");
}

if (/(^|\/)pom\.xml$/.test(rel)) {
  scan(/<version>\s*(\[|\(|LATEST|RELEASE)/, errors, "Maven version range / LATEST — pin an exact version");
  scan(/<version>[^<]*SNAPSHOT<\/version>/, warnings, "SNAPSHOT dependency");
}

const MAX = 25;
if (errors.length) {
  process.stderr.write(
    `post-edit-check found issues in ${rel} — fix them now (or explain to the developer why they are false positives):\n` +
      errors.slice(0, MAX).map((e) => "  ✘ " + e).join("\n") +
      (warnings.length ? "\nAlso:\n" + warnings.slice(0, MAX).map((w) => "  ⚠ " + w).join("\n") : "") + "\n"
  );
  process.exit(2);
}
if (warnings.length) {
  addContext("PostToolUse", `post-edit-check warnings for ${rel}:\n` + warnings.slice(0, MAX).map((w) => "  ⚠ " + w).join("\n"));
}
process.exit(0);
