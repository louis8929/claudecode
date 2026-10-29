---
name: new-kafka-listener
description: Scaffold Kafka messaging code with Spring for Apache Kafka (Spring Boot 3, Java 17) — a consumer (@KafkaListener with idempotency, error handling and DLT) or a producer (event record, publisher with outbox/after-commit) plus Testcontainers integration tests. Use when the developer asks to consume, publish, or add a Kafka topic, event, listener, or producer.
argument-hint: "consumer|producer <topic purpose>, e.g. 'consumer customer.address.changed → update billing address'"
---

# /new-kafka-listener

Request: `$ARGUMENTS`

## 1. Learn the project before writing
- `pom.xml`: `spring-kafka` version, serialization (JSON `JsonSerializer`/`JsonDeserializer`, Avro + Schema Registry,
  Protobuf), Testcontainers modules present.
- Existing Kafka code: container factory, `DefaultErrorHandler` / `DeadLetterPublishingRecoverer` / `@RetryableTopic`,
  topic naming, properties class holding topic names, event payload style, outbox table if any.
  **Mirror what exists**; create shared infrastructure (error handler, DLT) only if none exists, and say so.
- `.claude/rules/kafka.md` is the standard.

## 2. Confirm the plan (one short message, then wait)
Topic name (+ DLT name), key, payload record fields and version, consumer group id, delivery semantics
and how idempotency is achieved (dedupe table / upsert / natural key), retryable vs non-retryable
exceptions, files to create. Ask only what you cannot infer.

## 3a. Consumer mode — generate
- Topic and group id in the existing `@ConfigurationProperties` (or `application.yml`) — no literals in code.
- Event payload `record` (if not shared already) with an `eventId` and `occurredAt`.
- `XxxListener` — `@KafkaListener(topics = "${...}", groupId = "${...}")`, thin: validate → delegate to service.
  Logs topic/partition/offset/key on failure, never the full payload.
- `XxxService` handler — **idempotent** (check processed `eventId` or upsert), `@Transactional`.
- Error handling — reuse the project's `DefaultErrorHandler`; otherwise create one with bounded
  `ExponentialBackOff`, `DeadLetterPublishingRecoverer`, and non-retryable exceptions
  (`DeserializationException`, validation exceptions) registered via `addNotRetryableExceptions`.
  Consumer value deserializer wrapped in `ErrorHandlingDeserializer`; explicit trusted packages.

## 3b. Producer mode — generate
- Event payload `record`, versioned topic name in configuration, deliberate key (aggregate id).
- Publisher that never creates a dual write: if the project has an outbox, write to it in the business transaction;
  otherwise publish from `@TransactionalEventListener(phase = AFTER_COMMIT)` and state that an event can be lost
  on crash, recommending an outbox.
- Observe the `CompletableFuture<SendResult>`: log + metric on failure, no blocking `get()` on request threads.

## 3c. Tests (both modes)
- Unit test of the service handler / publisher with Mockito.
- Integration test with Testcontainers Kafka and `@ServiceConnection` (or `@EmbeddedKafka` if the project
  already standardised on it): happy path, duplicate delivery processed once, poison pill lands in the DLT while
  the next message is still processed, retryable failure retried then DLT. Awaitility for assertions, unique
  topic/group per test.

## 4. Finish
Run `/verify backend --fast` (needs Docker running for Testcontainers). Report created files as links,
the delivery semantics achieved, and test results in a few lines.
