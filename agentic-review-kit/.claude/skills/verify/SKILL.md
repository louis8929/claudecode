---
name: verify
description: Deterministic build, lint and test pipeline for the Spring Boot backend and React frontend. Use after code changes, before a review, or when the developer asks to build, test, lint or verify.
argument-hint: "[backend|frontend|all] [--fast]"
allowed-tools: Bash(node:*), Read, Grep, Glob
---

# /verify — deterministic verification

A fixed sequence of known steps is a workflow, not an agent task: run the script, then interpret.

Run:
```bash
node "${CLAUDE_PROJECT_DIR:-.}/.claude/skills/verify/scripts/verify.mjs" $ARGUMENTS
```

The script auto-detects:
- backend: nearest `pom.xml` in `.`, `backend/`, `server/`, `api/` — uses `mvnw` if present, else `mvn`.
  Runs `verify` (or `test-compile` + `test` with `--fast`, skipping integration tests).
- frontend: `package.json` with a `react` dependency in `.`, `frontend/`, `web/`, `client/`, `ui/`.
  Runs the `lint`, `test` and `build` npm scripts that exist (`--fast` skips `build`).
  Tests run once, non-interactively (`CI=true`).

It prints a JSON summary on the last line: `{"steps":[{"name","ok","durationMs","tail"}]}`.

## After it runs
- All green → say so in one line with durations.
- Failures → for each failed step, read the `tail`, identify the **first real error** (not the cascade),
  open the file at the reported line, and explain the cause in 1–2 lines with a proposed fix.
  Do not apply fixes unless the developer asks.
- Compilation errors on `getFirst()`/`getLast()`/`reversed()`, virtual threads or `switch` type patterns mean
  Java 18+ APIs were used while the build targets `--release 17`.
- Kafka / database integration tests use Testcontainers: errors like `Could not find a valid Docker environment`
  mean Docker Desktop is not running — say so instead of debugging the test. `--fast` skips `*IT` tests
  (failsafe) but not Testcontainers tests named `*Test`.
