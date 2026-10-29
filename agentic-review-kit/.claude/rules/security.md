# Security rules (always loaded)

These mirror the Telenet organisation policy and apply to every change.

## Secrets
- Never hard-code credentials, API keys, tokens, or connection strings with passwords.
  Use environment variables resolved from a secrets manager (HashiCorp Vault, AWS/GCP Secrets Manager).
- If an existing hard-coded secret is found, **flag it immediately** and propose remediation
  (move to the secrets manager, rotate the secret).

## Authentication / authorization
- Internal users: OKTA Workforce + SailPoint. Customers: OKTA CIAM. Do not build custom auth.
- Authorization is enforced server-side on every endpoint (`@PreAuthorize` or security config),
  never only in the UI.

## Mandatory flags — call out explicitly before proceeding
| Pattern | Flag |
|---------|------|
| File upload / user-supplied file processing | Flag the risk (size, type, path traversal, malware scan, storage location) |
| SQL built by string concatenation | Replace with parameterized query |
| XML parsing without disabling external entities | XXE risk — disable DTDs / external entities |
| Server-side URL fetch using user input | SSRF risk — allow-list hosts, block internal ranges |
| Deserialization of untrusted data (`ObjectInputStream`, polymorphic Jackson typing) | Flag, propose safe alternative |

## Errors and data
- External error responses are generic. Internal logs are detailed but contain no secrets or PII.
- No tokens, passwords, or PII in URLs or query parameters.

## Dependencies
- Before adding a dependency, note known CVEs and deprecation status.
- Pin exact versions in production manifests (no `^`, `~`, version ranges, or `LATEST`).
- Flag dependencies from git URLs or unverified registries.

## Kafka
- Brokers are reached over TLS with SASL (or mTLS); `security.protocol=PLAINTEXT` only in local profiles.
- `JsonDeserializer` trusted packages must be an explicit list — `spring.json.trusted.packages=*` is a
  deserialization risk. Prefer type mapping headers or a schema registry.
- Messages are untrusted input: validate payloads like request bodies.
- No PII or secrets in message keys or headers; keep PII in payloads to the minimum required.
- Consumer ACLs: a service reads only the topics it owns or subscribes to.

## Web
- CORS: explicit origins, never `*` with credentials.
- CSRF protection stays on for cookie-based sessions.
- Spring Actuator: expose only `health`/`info` publicly.
