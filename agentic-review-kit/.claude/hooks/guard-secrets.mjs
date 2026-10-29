#!/usr/bin/env node
// PreToolUse (Write|Edit|MultiEdit): refuse to write secrets or secret-bearing files.
import { basename } from "node:path";
import { block, readHookInput } from "./lib.mjs";

const input = await readHookInput({ failClosed: true });
const ti = input.tool_input || {};
const file = String(ti.file_path || "");
const name = basename(file).toLowerCase();

const content = [ti.content, ti.new_string, ...(ti.edits || []).map((e) => e.new_string)]
  .filter(Boolean)
  .join("\n");

// 1. Files that should never be authored by the agent.
const SECRET_FILE = /^(\.env(\..+)?|.*\.(pem|key|p12|pfx|jks|keystore)|id_(rsa|dsa|ecdsa|ed25519)|credentials(\.json)?|\.npmrc|\.netrc|settings-security\.xml)$/;
const ALLOWED_TEMPLATE = /^\.env\.(example|sample|template)$/;
if (SECRET_FILE.test(name) && !ALLOWED_TEMPLATE.test(name)) {
  block(
    `BLOCKED by guard-secrets: '${name}' is a secret-bearing file. ` +
      `Create a '.env.example' with placeholder values instead and tell the developer which ` +
      `values to load from the secrets manager (HashiCorp Vault / AWS / GCP Secrets Manager).`
  );
}

// 2. Secret-looking literals in content. Placeholders like ${DB_PASSWORD} or <changeme> are fine.
const PATTERNS = [
  [/AKIA[0-9A-Z]{16}/, "AWS access key id"],
  [/-----BEGIN (RSA |EC |OPENSSH |DSA |)PRIVATE KEY-----/, "private key"],
  [/\bgh[pousr]_[A-Za-z0-9]{30,}/, "GitHub token"],
  [/\bxox[baprs]-[A-Za-z0-9-]{10,}/, "Slack token"],
  [/\beyJ[\w-]{10,}\.[\w-]{10,}\.[\w-]{10,}/, "JWT"],
  [/\b(sk|rk)_live_[A-Za-z0-9]{16,}/, "live API key"],
  [/:\/\/[^\s:/@]+:[^\s@/${}<]{3,}@/, "credentials embedded in a URL"],
  // Quoted literal assigned to a secret-named key/variable (Java, JS, JSON, YAML).
  [
    /\b(password|passwd|pwd|secret|client[_-]?secret|api[_-]?key|access[_-]?token)["']?\s*[:=]\s*["'](?!\$\{|<|%|\*{3}|changeme|example|dummy|test|xxx)[^"'\s]{6,}["']/i,
    "hard-coded credential",
  ],
];
// Unquoted values only count in config files (in code they are usually variables).
if (/\.(properties|ya?ml|env|conf|ini|toml)$/i.test(name)) {
  PATTERNS.push([
    /^\s*[\w.-]*(password|passwd|pwd|secret|api[_-]?key|access[_-]?token)\s*[:=]\s*(?!\$\{|<|%|\*{3}|changeme|example|dummy|test|xxx|["'])\S{6,}/im,
    "hard-coded credential in configuration",
  ]);
}

for (const [re, label] of PATTERNS) {
  const m = content.match(re);
  if (m) {
    block(
      `BLOCKED by guard-secrets: possible ${label} in ${file || "content"}. ` +
        `Never hard-code secrets. Reference an environment variable / Spring property placeholder ` +
        `(e.g. \${DB_PASSWORD}) resolved from HashiCorp Vault or AWS/GCP Secrets Manager. ` +
        `If this is an obvious test placeholder, use a value like 'changeme' or '\${...}'.`
    );
  }
}
process.exit(0);
