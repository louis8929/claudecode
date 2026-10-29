---
paths:
  - "**/src/test/**"
  - "**/*.test.*"
  - "**/*.spec.*"
  - "**/__tests__/**"
---

# Testing rules

## Backend (JUnit 5 + Mockito + Spring test slices)
- Test names describe behaviour: `shouldReturn404WhenCustomerDoesNotExist`.
- Arrange / Act / Assert, one behaviour per test. AssertJ for assertions.
- Prefer the narrowest slice: plain unit test → `@WebMvcTest` (controllers) → `@DataJpaTest` (repositories)
  → `@SpringBootTest` only for true integration paths.
- Databases in integration tests: Testcontainers with the production engine, not H2, when SQL dialect matters.
- No `Thread.sleep`; use Awaitility. No dependency on test execution order or wall-clock time
  (inject a `Clock`).
- Mock collaborators, not the class under test; don't mock value objects or DTOs.
- Use `@ServiceConnection` (Boot 3.1+) with Testcontainers instead of manual `@DynamicPropertySource` where possible.

## Kafka
- Listener logic is unit-tested by calling the service it delegates to; the listener itself is covered by an
  integration test.
- Integration tests use **Testcontainers Kafka** (`KafkaContainer` / `ConfluentKafkaContainer`) — or
  `@EmbeddedKafka` for fast slices when broker fidelity doesn't matter.
- Assert asynchronously with Awaitility (`await().atMost(...)`), never `Thread.sleep`.
- Cover at least: happy path, **duplicate delivery** (idempotency), poison pill / invalid payload
  (ends in the DLT, partition keeps flowing), and retryable failure (retries then DLT).
- Producers: assert key, headers and payload on the consumed record, not just that `send` was called.
- Use unique topic names or consumer group ids per test to avoid cross-test interference.

## Frontend (Jest/Vitest + React Testing Library)
- Query by role/label/text the way a user would (`getByRole`), not by class or test-id first.
- Use `userEvent` over `fireEvent`. Await async UI with `findBy*` / `waitFor`.
- Mock the network at the boundary (MSW), not internal hooks.
- No snapshot tests as the only assertion for behaviour.

## Coverage expectations for a change
- Every new public service method or endpoint: happy path + at least one failure path.
- Every bug fix: a regression test that fails without the fix.
- Security-relevant logic (authz checks, validation): explicit negative tests.
