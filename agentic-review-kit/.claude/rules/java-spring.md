---
paths:
  - "**/*.java"
  - "**/pom.xml"
  - "**/application*.yml"
  - "**/application*.yaml"
  - "**/application*.properties"
---

# Java 17 / Spring Boot 3 rules

## Language level (Java 17)
- Use modern Java where it improves clarity: **records** for DTOs, events and value objects;
  `sealed` interfaces for closed hierarchies; switch **expressions**; `instanceof` patterns; text blocks
  for multi-line SQL/JSON; `List.of`/`Map.of`; `Stream.toList()`; `var` only when the type is obvious.
- **Not available on 17** (Java 18+): `SequencedCollection` methods (`getFirst`, `getLast`, `reversed`, `addFirst`),
  virtual threads (`Thread.ofVirtual`, `newVirtualThreadPerTaskExecutor`), pattern matching on types in `switch`
  (`case Foo f ->`), record patterns, unnamed variables `_`, `String.splitWithDelimiters`, `Math.clamp`.
- `jakarta.*` only — never `javax.persistence|servlet|validation|annotation|transaction`.
- Spring Security 6 style: `SecurityFilterChain` beans with the lambda DSL; no `WebSecurityConfigurerAdapter`,
  no `antMatchers` (use `requestMatchers`).
- `RestClient` / `WebClient` for outbound HTTP; no new `RestTemplate` code.
- Observability: Micrometer (`Observation`/metrics) rather than Sleuth (removed in Boot 3).

## Structure
- Layering: `controller` → `service` → `repository`. Controllers hold no business logic;
  repositories hold no business logic; services own transactions.
- Controllers accept and return **DTOs**, never JPA entities.
- Constructor injection only (`final` fields). No field `@Autowired`.
- Configuration through `@ConfigurationProperties` classes, not scattered `@Value`.

## Persistence
- `@Transactional` on service methods, `readOnly = true` for queries. Never on controllers.
- Watch for N+1: lazy collections accessed in loops, missing `JOIN FETCH` / `@EntityGraph`.
- No `FetchType.EAGER` on collections.
- Queries: Spring Data derived queries, JPQL with named parameters, or `JdbcTemplate` with `?` placeholders.
  **Never** concatenate user input into SQL/JPQL.
- Schema changes go through Flyway/Liquibase migrations, never `ddl-auto=update` outside local profiles.

## Errors and logging
- One `@RestControllerAdvice` maps exceptions to responses. External responses are generic
  (problem+json style): no stack traces, class names, SQL, or internal paths.
- Log with SLF4J placeholders (`log.info("x={}", x)`), never string concatenation, never `System.out`, never `printStackTrace()`.
- Never log tokens, passwords, or PII. Log the full exception internally (`log.error("...", ex)`).
- Don't swallow exceptions; don't catch `Exception`/`Throwable` unless rethrowing or at a boundary.

## API
- Validate input with Bean Validation (`@Valid`, `@NotNull`, `@Size`...) on request DTOs.
- Error bodies use `ProblemDetail` (RFC 7807, built into Spring 6) with a generic `detail`.
- Correct status codes: 201 + `Location` on create, 204 on empty success, 404 for missing resource.
- Pagination for any collection endpoint that can grow (`Pageable`).
- No secrets or PII in path/query parameters.

## Concurrency and resources
- Spring beans are singletons: no mutable instance state in `@Service`/`@Controller`.
- try-with-resources for streams, connections, files.
- `@Async` / executors need a bounded, named pool.
