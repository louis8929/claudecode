---
name: new-endpoint
description: Scaffold a Spring Boot REST endpoint (controller, service, DTOs, exception mapping, tests) that follows the team rules and the project's declared Java/Spring Boot version. Use when the developer asks to create or add an endpoint, resource, or REST API.
argument-hint: "<HTTP method> <path> <short purpose>, e.g. 'GET /api/customers/{id} fetch customer summary'"
---

# /new-endpoint

Request: `$ARGUMENTS`

## 1. Learn the project before writing
- `pom.xml`: confirm Spring Boot 3.x / Java 17 (`jakarta.*`, records, Spring Security 6 DSL).
- Find an existing controller, service, DTO, `@RestControllerAdvice`, and their tests; **mirror their
  package layout, naming, mapping style (MapStruct or manual), and test style.** Existing code wins over
  this skill when they disagree.
- Security config: how endpoints are authorised (`@PreAuthorize`, request matchers).

## 2. Confirm the plan (one short message, then wait)
List the files you'll create/modify, the request/response DTO fields, status codes, the authorization rule,
and validation constraints. Ask only what you cannot infer (e.g. which role may call it).

## 3. Generate
- `XxxController` — thin; `@Valid` request DTO; correct status (201 + `Location` for create, 204 for empty);
  `Pageable` for collections; authorization annotation consistent with the project.
- `XxxService` — business logic, `@Transactional` (`readOnly = true` for reads), constructor injection.
- Request/Response DTOs — Java 17 records with Bean Validation annotations on components.
- Not-found / conflict → domain exceptions handled in the existing `@RestControllerAdvice`, returning
  `ProblemDetail` (generic external message, detailed internal log).
- If the endpoint changes state that other services must learn about, **don't** publish to Kafka inline —
  propose an event via the outbox / after-commit pattern and offer `/new-kafka-listener` (producer mode).
- Tests:
  - `XxxControllerTest` with `@WebMvcTest`: happy path, validation failure (400), not found (404), forbidden (403).
  - `XxxServiceTest` plain JUnit 5 + Mockito: business branches.
- Security flags from `.claude/rules/security.md` apply: if the endpoint accepts files, fetches URLs,
  parses XML, or builds queries — call it out before writing that part.

## 4. Finish
Run `/verify backend --fast`. Report created files as links and test results in a few lines.
