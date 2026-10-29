#!/usr/bin/env node
// SessionStart: inject a compact, current picture of the repo (context engineering).
// Stdout of a SessionStart hook is added to Claude's context.
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { projectDir, readHookInput, readStackFromPom } from "./lib.mjs";

const input = await readHookInput();
const root = projectDir(input);
const out = [];

const git = (...args) => {
  const r = spawnSync("git", args, { cwd: root, encoding: "utf8", timeout: 5000 });
  return r.status === 0 ? r.stdout.trim() : "";
};

const pom = [".", "backend", "server", "api"].map((d) => join(root, d, "pom.xml")).find(existsSync);
if (pom) {
  const s = readStackFromPom(pom);
  out.push(`Backend: Spring Boot ${s.bootVersion ?? "?"}, Java ${s.javaRelease ?? "?"} (${relative(root, pom).replace(/\\/g, "/")})`);
  if (s.bootMajor >= 3 && s.javaRelease && s.javaRelease < 17) {
    out.push("⚠ pom.xml mismatch: Spring Boot 3 requires Java 17+. Raise this with the developer before writing code.");
  }
  if (s.kafka) {
    out.push(`Messaging: Spring for Apache Kafka${s.testcontainers ? ", Testcontainers present (Docker must run for integration tests)" : ", no Testcontainers dependency found"}`);
  }
}

for (const d of [".", "frontend", "web", "client", "ui"]) {
  const p = join(root, d, "package.json");
  if (!existsSync(p)) continue;
  try {
    const j = JSON.parse(readFileSync(p, "utf8"));
    const deps = { ...j.dependencies, ...j.devDependencies };
    if (!deps.react) continue;
    const runner = deps.vitest ? "vitest" : deps.jest || deps["react-scripts"] ? "jest" : "?";
    out.push(`Frontend: React ${deps.react}, ${deps.typescript ? "TypeScript" : "JavaScript"}, tests: ${runner} (${d}/)`);
    break;
  } catch {
    // ignore unreadable package.json
  }
}

const branch = git("rev-parse", "--abbrev-ref", "HEAD");
if (branch) {
  const changed = git("status", "--porcelain").split(/\r?\n/).filter(Boolean);
  out.push(`Git: branch ${branch}, ${changed.length} uncommitted file(s)` +
    (changed.length ? ": " + changed.slice(0, 10).map((l) => l.slice(3)).join(", ") + (changed.length > 10 ? ", …" : "") : ""));
}

const learnings = join(root, ".claude", "review-memory", "learnings.md");
if (existsSync(learnings)) {
  const n = readFileSync(learnings, "utf8").split(/\r?\n/).filter((l) => /^- (ACCEPT|REJECT|CONVENTION)/.test(l)).length;
  out.push(`Review memory: ${n} curated lesson(s) in .claude/review-memory/learnings.md`);
}

out.push("Available: /review, /verify, /review-feedback, /review-eval, /new-endpoint, /new-kafka-listener, /react-component");
console.log("Project context (auto-generated at session start):\n- " + out.join("\n- "));
