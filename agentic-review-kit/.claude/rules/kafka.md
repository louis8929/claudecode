---
paths:
  - "**/*Kafka*.java"
  - "**/*Listener*.java"
  - "**/*Consumer*.java"
  - "**/*Producer*.java"
  - "**/*Publisher*.java"
  - "**/*Event*.java"
  - "**/messaging/**"
  - "**/kafka/**"
  - "**/application*.yml"
  - "**/application*.yaml"
  - "**/application*.properties"
  - "**/*.avsc"
---

# Kafka rules (Spring for Apache Kafka, Spring Boot 3)

## Topics and contracts
- Topic names come from configuration (`@ConfigurationProperties` / `${...}`), never string literals scattered in code.
  Convention: `<domain>.<entity>.<event>.v<N>` (adapt to the project's existing convention if one exists).
- Messages are **versioned contracts**: event payloads are immutable records with explicit fields.
  Breaking changes go to a new topic version or a compatible schema evolution (Avro/Protobuf with
  Schema Registry if the project uses it). Never send JPA entities as messages.
- Choose the **key** deliberately: it decides partitioning and therefore ordering. Events about the same
  aggregate share the same key (e.g. `customerId`).
- Include an event id and timestamp (in payload or headers) to enable idempotency and tracing.

## Producers
- `acks=all`, `enable.idempotence=true` (default in recent clients — do not disable).
- Handle the send result: the `CompletableFuture<SendResult>` from `KafkaTemplate.send` must be observed
  (log + metric on failure). Fire-and-forget is not acceptable for business events.
- Don't block request threads on `send(...).get()` unless synchronous confirmation is a stated requirement
  (then use a timeout).
- **DB + Kafka consistency**: writing to the database and publishing in the same method is a dual write.
  Use the **transactional outbox** pattern (or publish after commit via
  `@TransactionalEventListener(phase = AFTER_COMMIT)` when losing an event is tolerable). Flag dual writes.

## Consumers
- Every `@KafkaListener` has an explicit `groupId` (or `spring.kafka.consumer.group-id`) and a configured
  concurrency ≤ partition count.
- **At-least-once is the default ⇒ consumers must be idempotent** (dedupe on event id, upserts,
  natural keys). Assume every message can be delivered twice.
- Offsets: leave `enable.auto.commit=false` (Spring default) and let the container commit (`AckMode.RECORD`/`BATCH`).
  Manual ack only when needed, and then always ack or nack.
- Errors: configure a `DefaultErrorHandler` with bounded `BackOff` and a `DeadLetterPublishingRecoverer`
  (or `@RetryableTopic` for non-blocking retries). Classify non-retryable exceptions
  (validation, deserialization) so they go straight to the DLT. Never swallow exceptions in a listener.
- Deserialization: wrap with `ErrorHandlingDeserializer` so a poison pill doesn't block the partition.
  `JsonDeserializer` trusted packages are **explicit** — never `*`.
- Keep listeners thin: deserialize → validate → delegate to a service. No long blocking work beyond
  `max.poll.interval.ms`; tune `max.poll.records` if processing is slow.
- Ordering is only guaranteed per partition; don't rely on cross-key ordering.

## Configuration
- Bootstrap servers, credentials and SASL/SSL settings come from environment / secrets manager.
- `auto.offset.reset` chosen deliberately per consumer group (`earliest` for new event-sourced consumers,
  usually) and documented.
- No `spring.kafka.admin.auto-create`/`NewTopic` beans creating production topics unless the team agreed;
  topics are provisioned by infrastructure.

## Observability
- Propagate trace context via headers (Micrometer observation enabled on template and listener container:
  `spring.kafka.template.observation-enabled=true`, `spring.kafka.listener.observation-enabled=true`).
- Log topic/partition/offset/key on errors — never the full payload if it may contain PII.
