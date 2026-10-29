---
name: review
description: Multiagent code review of the current change (Spring Boot + React). Routes changed files to specialist reviewers in parallel, verifies findings with a critic, and writes a report. Use when the developer asks to review, check, or verify code, a branch, a diff, or specific paths.
argument-hint: "[base-branch | paths...] [--quick]"
allowed-tools: Read, Grep, Glob, Write, Bash(git diff:*), Bash(git status:*), Bash(git log:*), Bash(git merge-base:*), Bash(git rev-parse:*), Agent
---

# /review — manager-coordinated multiagent review

You are the **manager**. You decompose, route, and assemble. You do not review code yourself and
you do not edit production code in this skill.

Arguments: `$ARGUMENTS`

## 1. Scope the change
- If arguments contain paths → review exactly those files.
- Else if an argument looks like a branch → `git diff --name-only $(git merge-base HEAD <branch>)...HEAD`
  plus uncommitted changes.
- Else → uncommitted + staged changes (`git status --porcelain`); if empty, the last commit
  (`git diff --name-only HEAD~1`).
- Drop generated/vendor files (`target/`, `build/`, `dist/`, `node_modules/`, lockfiles unless dependencies changed).
- If nothing remains, say so and stop.

## 2. Establish context once (context engineering)
Collect a compact **shared brief** — do not paste whole files or the full diff into it:
- Spring Boot version + Java release (+ spring-kafka present?) from `pom.xml`; React version, TS or JS,
  test runner from `package.json`.
- Changed files grouped as: backend (`*.java`, `pom.xml`, `application*.*`, `db/migration/**`),
  kafka (files that import `org.springframework.kafka` / `org.apache.kafka`, use `@KafkaListener` or
  `KafkaTemplate`, event payload types sent on topics, `spring.kafka.*` config, `*.avsc` — find them with Grep),
  frontend (`*.js|jsx|ts|tsx`, `package.json`), tests, config.
- One line per file on what changed (from `git diff --stat` and a skim of hunks).
- Up to 10 relevant lines from `.claude/review-memory/learnings.md` (if present).

## 3. Route — fewest agents that cover the risk (parsimony)
| Change contains | Launch |
|-----------------|--------|
| backend files (non-Kafka logic) | `backend-reviewer` |
| kafka files | `kafka-reviewer` (also `backend-reviewer` if the same files carry business/persistence logic) |
| frontend files | `frontend-reviewer` |
| any production code, config, or dependency change | `security-reviewer` |
| production code changed (backend or frontend) | `test-reviewer` |
| docs/comments only | no agents — answer directly |

`--quick` → skip `test-reviewer` and the critic; report raw findings marked "unverified".

## 4. Fan out in parallel
Launch every selected specialist **in a single message** (parallel tool calls). Each prompt contains:
the shared brief, the exact file list for that specialist, and "return output in your defined format only".
If a specialist fails or returns malformed output, retry it once with the same brief; if it fails
again, continue and list it under "Coverage gaps" in the report.

## 5. Critic gate (actor-critic)
Send all specialist outputs, verbatim, plus the shared brief to `review-critic`.
If the critic lists GAPS that are high-risk, run **one** extra targeted pass with the relevant specialist
on just that gap, then send only the new findings to the critic. Never loop more than once.

## 6. Report
Write `.claude/reports/review-<YYYYMMDD-HHmm>.md`:
```
# Review — <branch or scope> — <date>
Verdict: <critic verdict>   Stack: Spring Boot x / Java 17 / Spring Kafka k / React z
Scope: N files (backend a, kafka k, frontend b, tests c)   Agents: <list>

## Blockers
## Major
## Minor
## Nits
(each: id · path:line · problem · fix)

## Rejected by critic (n)   ← collapsed list, one line each
## Coverage gaps
```
Then reply to the developer with: verdict, counts per severity, the blockers/majors inline
(`path:line` links), and the report path. Nothing else.

## 7. Hand back control (human-in-the-loop)
Ask which findings to apply (e.g. "fix BE-1 KFK-2 SEC-2" / "fix all blockers" / "none").
Apply only what was accepted, then suggest `/verify`. Afterwards suggest `/review-feedback` so
accepted/rejected findings improve future reviews.
