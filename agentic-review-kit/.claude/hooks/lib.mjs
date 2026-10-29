// Shared helpers for Claude Code hooks. No external dependencies (Node 18+).
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * Parse the hook's JSON stdin. Guards pass failClosed=true: if the input cannot be parsed,
 * the tool call is blocked rather than silently allowed.
 */
export async function readHookInput({ failClosed = false } = {}) {
  let raw = "";
  for await (const chunk of process.stdin) raw += chunk;
  try {
    return JSON.parse(raw || "{}");
  } catch {
    if (failClosed) block("Hook could not parse its input; blocking the call as a precaution.");
    return {};
  }
}

export function projectDir(input) {
  return process.env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
}

/** Block a PreToolUse call: the reason is shown to Claude, which must adapt. */
export function block(reason) {
  process.stderr.write(reason.trim() + "\n");
  process.exit(2);
}

/** Non-blocking feedback injected into Claude's context after a tool ran. */
export function addContext(eventName, text) {
  process.stdout.write(
    JSON.stringify({ hookSpecificOutput: { hookEventName: eventName, additionalContext: text } })
  );
  process.exit(0);
}

/** Walk up from a file to find the closest pom.xml, stopping at the project dir. */
export function findUp(startFile, name, stopDir) {
  let dir = dirname(resolve(startFile));
  const stop = resolve(stopDir);
  for (let i = 0; i < 30; i++) {
    const candidate = join(dir, name);
    if (existsSync(candidate)) return candidate;
    if (dir === stop || dirname(dir) === dir) break;
    dir = dirname(dir);
  }
  return null;
}

/** Extract Spring Boot major version and Java release from a pom.xml (best effort, regex based). */
export function readStackFromPom(pomPath) {
  if (!pomPath) return {};
  const pom = readFileSync(pomPath, "utf8");
  const boot =
    pom.match(/<artifactId>\s*spring-boot-(?:starter-parent|dependencies)\s*<\/artifactId>\s*<version>\s*([\d.]+)/) ||
    pom.match(/<spring-boot\.version>\s*([\d.]+)\s*</);
  const java =
    pom.match(/<java\.version>\s*([\d.]+)\s*</) ||
    pom.match(/<maven\.compiler\.release>\s*([\d.]+)\s*</) ||
    pom.match(/<maven\.compiler\.source>\s*([\d.]+)\s*</) ||
    pom.match(/<release>\s*([\d.]+)\s*<\/release>/);
  const normJava = java ? (java[1].startsWith("1.") ? Number(java[1].slice(2)) : Number(java[1])) : undefined;
  return {
    bootVersion: boot ? boot[1] : undefined,
    bootMajor: boot ? Number(boot[1].split(".")[0]) : undefined,
    javaRelease: normJava,
    kafka: /<artifactId>\s*spring-kafka\s*<\/artifactId>/.test(pom),
    testcontainers: /<groupId>\s*org\.testcontainers\s*<\/groupId>/.test(pom),
  };
}

/** Redact obvious secrets before anything is logged. */
export function redact(text) {
  return String(text || "")
    .replace(/\b(Bearer|Basic)\s+[\w.~+/=-]+/gi, "$1 ****")
    .replace(/(password|passwd|pwd|secret|token|api[_-]?key|authorization)(\s*[=:]\s*|\s+)("[^"]*"|'[^']*'|\S+)/gi, "$1$2****")
    .replace(/AKIA[0-9A-Z]{16}/g, "AKIA****")
    .replace(/eyJ[\w-]+\.[\w-]+\.[\w-]+/g, "<jwt>")
    .replace(/(gh[pousr]_|xox[baprs]-)[\w-]+/g, "$1****");
}
