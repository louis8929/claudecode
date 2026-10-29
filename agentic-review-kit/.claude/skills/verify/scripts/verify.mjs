#!/usr/bin/env node
// Deterministic build/lint/test runner for a Spring Boot (Maven) + React repository.
// Usage: node verify.mjs [backend|frontend|all] [--fast]
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const args = process.argv.slice(2);
const fast = args.includes("--fast");
const target = args.find((a) => !a.startsWith("--")) || "all";
const isWin = process.platform === "win32";
const TAIL_LINES = 40;

function findBackend() {
  for (const d of [".", "backend", "server", "api"]) {
    if (existsSync(join(root, d, "pom.xml"))) return join(root, d);
  }
  return null;
}

function findFrontend() {
  for (const d of [".", "frontend", "web", "client", "ui"]) {
    const pkg = join(root, d, "package.json");
    if (!existsSync(pkg)) continue;
    try {
      const json = JSON.parse(readFileSync(pkg, "utf8"));
      const deps = { ...json.dependencies, ...json.devDependencies };
      if (deps.react) return { dir: join(root, d), scripts: json.scripts || {} };
    } catch {
      // unreadable package.json: skip
    }
  }
  return null;
}

function run(name, cmd, cmdArgs, cwd, env = {}) {
  const started = Date.now();
  process.stderr.write(`\n▶ ${name}: ${cmd} ${cmdArgs.join(" ")}  (in ${cwd})\n`);
  const res = spawnSync(cmd, cmdArgs, {
    cwd,
    env: { ...process.env, ...env },
    encoding: "utf8",
    shell: isWin, // needed for mvnw.cmd / npm.cmd on Windows
    maxBuffer: 64 * 1024 * 1024,
    timeout: 20 * 60 * 1000,
  });
  const out = `${res.stdout || ""}\n${res.stderr || ""}`.trimEnd();
  const ok = res.status === 0;
  process.stderr.write(`${ok ? "✔" : "✘"} ${name} (${Date.now() - started} ms)\n`);
  return {
    name,
    ok,
    durationMs: Date.now() - started,
    tail: ok ? "" : out.split(/\r?\n/).slice(-TAIL_LINES).join("\n"),
  };
}

const steps = [];

if (target === "all" || target === "backend") {
  const be = findBackend();
  if (!be) {
    steps.push({ name: "backend", ok: true, durationMs: 0, tail: "skipped: no pom.xml found" });
  } else {
    const wrapper = isWin ? "mvnw.cmd" : "./mvnw";
    const mvn = existsSync(join(be, isWin ? "mvnw.cmd" : "mvnw")) ? wrapper : "mvn";
    const goals = fast ? ["test", "-DskipITs"] : ["verify"];
    steps.push(run("backend", mvn, ["-B", "-q", "-ntp", ...goals], be));
  }
}

if (target === "all" || target === "frontend") {
  const fe = findFrontend();
  if (!fe) {
    steps.push({ name: "frontend", ok: true, durationMs: 0, tail: "skipped: no React package.json found" });
  } else {
    const npm = "npm";
    if (!existsSync(join(fe.dir, "node_modules"))) {
      steps.push({
        name: "frontend:install",
        ok: false,
        durationMs: 0,
        tail: "node_modules missing — run `npm ci` in " + fe.dir + " first (not done automatically).",
      });
    } else {
      if (fe.scripts.lint) steps.push(run("frontend:lint", npm, ["run", "lint"], fe.dir));
      if (fe.scripts.test) {
        // CI=true makes CRA/Jest run once; `--run`-style flags differ per runner so we rely on CI.
        steps.push(run("frontend:test", npm, ["test", "--silent"], fe.dir, { CI: "true" }));
      }
      if (!fast && fe.scripts.build) steps.push(run("frontend:build", npm, ["run", "build"], fe.dir));
    }
  }
}

console.log(JSON.stringify({ steps }));
process.exit(steps.every((s) => s.ok) ? 0 : 1);
