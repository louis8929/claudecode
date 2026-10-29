# Project guide for Claude

Full-stack application: **Spring Boot 3** backend (Maven, **Java 17**) with **Apache Kafka** messaging
(Spring for Apache Kafka) + **React** frontend.
The primary user is a **senior developer**. Act as a precise, terse peer: no tutorials,
no restating the obvious, lead with the finding or the change.

## Stack

| Layer     | Expected location | Build / test commands |
|-----------|-------------------|-----------------------|
| Backend   | `backend/` (or repo root if `pom.xml` is there) | `./mvnw -B verify`, `./mvnw -B test -Dtest=ClassName` |
| Messaging | Kafka via `spring-kafka`; integration tests with Testcontainers (Docker required) | part of `./mvnw -B verify` |
| Frontend  | `frontend/` | `npm run lint`, `npm test`, `npm run build` |

- **Java 17** language level: records, sealed types, text blocks, switch expressions and
  `instanceof` patterns are welcome. **Do not use Java 18+ APIs** (e.g. `getFirst()`/`getLast()`/`reversed()`
  on collections, virtual threads, pattern matching in `switch` on types) — a local JDK 21 compiles with
  `--release 17` and will reject them; the `post-edit-check` hook flags them early.
- **Spring Boot 3** ⇒ `jakarta.*` namespaces only, Spring Security 6 (`SecurityFilterChain`, no
  `WebSecurityConfigurerAdapter`), `spring.kafka.*` auto-configuration.
- `pom.xml` is the source of truth for exact versions; adjust the table if your layout differs
  (the `/verify` skill auto-detects).

## Multiagent code-verification system

Designed after *Building Applications with AI Agents* (M. Albada, O'Reilly 2025):
manager coordination + specialised workers + actor-critic quality gate + human-in-the-loop.

| Component | Kind | Role |
|-----------|------|------|
| `/review` | skill (manager) | Scopes the change, routes to the minimum set of specialists, runs them in parallel, sends findings to the critic, writes the report |
| `backend-reviewer` | subagent | Spring Boot / Java 17 / JPA correctness and design |
| `kafka-reviewer` | subagent | Kafka producers, consumers, topics, delivery semantics, error handling |
| `frontend-reviewer` | subagent | React correctness, hooks, state, a11y, performance |
| `security-reviewer` | subagent | OWASP + Telenet security policy (incl. Kafka transport/deserialization) |
| `test-reviewer` | subagent | Test adequacy and test quality for the change |
| `review-critic` | subagent | Verifies every finding against the code; drops false positives; calibrates severity |
| `/verify` | skill | Deterministic build/lint/test pipeline (no LLM judgement needed) |
| `/review-feedback` | skill | Records accepted/rejected findings → `.claude/review-memory/learnings.md` |
| `/review-eval` | skill | Measures reviewer precision/recall on seeded-bug fixtures |
| `/new-endpoint`, `/new-kafka-listener`, `/react-component` | skills | Scaffold code that already follows the rules |
| `.claude/rules/*.md` | rules | Path-scoped conventions loaded when matching files are touched |
| `.claude/hooks/*.mjs` | hooks | Deterministic guardrails, fast feedback, audit trail |

## Working agreement

- Reviewers are **read-only**. Only the main session edits code, and only after the developer agrees
  (see `.claude/rules/agent-autonomy.md`).
- Prefer deterministic tools (compiler, tests, linters, hooks) over LLM judgement whenever they can
  answer the question.
- Every finding must cite `path:line` and quote the evidence. No evidence → no finding.
- Never commit, push, change build/CI configuration, or touch Kafka topics/offsets on a real cluster unless asked.
