# Architecture Decision Records

---

## ADR-001: PostgreSQL as the only database

- **Date:** Unknown (V1 schema present from project start)
- **Status:** Accepted
- **Context:** Need a relational DB with ACID guarantees for booking overlap prevention and financial data (prices, rates). UUID support and partial indexes needed for the double-booking guard.
- **Decision:** PostgreSQL only. No multi-DB or NoSQL layer.
- **Consequences:** Strong consistency guarantees. `pgcrypto` extension for `gen_random_uuid()`. Cannot trivially swap to MySQL/H2 (uses PG-specific partial indexes and `TIMESTAMPTZ`). H2 in-memory is not viable for tests — Testcontainers PostgreSQL is used instead.

---

## ADR-002: Flyway owns schema, Hibernate only validates

- **Date:** Unknown
- **Status:** Accepted
- **Context:** Production safety: accidental `ddl-auto: create-drop` or `update` can destroy data. Reproducible schema history needed across environments.
- **Decision:** `spring.jpa.hibernate.ddl-auto: validate`. All schema changes via `db/migration/V{N}__description.sql`.
- **Consequences:** Schema changes require a new Flyway file. Hibernate entity changes that don't match the schema cause startup failure — this is intentional (catch drift early). `flyway-database-postgresql 10.10.0` required for Spring Boot 3.2+ full PG support.

---

## ADR-003: Stateless JWT authentication with DB-persisted refresh tokens

- **Date:** Unknown
- **Status:** Accepted
- **Context:** REST API needs stateless auth (no server sessions). Refresh tokens must be revocable (logout, change-password, security incident).
- **Decision:** Short-lived JWT access tokens (24h) for stateless auth. Long-lived refresh tokens (7d) stored in `refresh_tokens` table with a `revoked` flag.
- **Consequences:** Access tokens cannot be revoked before expiry — 24h window of exposure if token is leaked. Refresh token revocation is O(1) DB lookup. Login accepts both username and email (UserDetailsService tries both). BCrypt strength 12 for passwords.

---

## ADR-004: BookingStatus as a self-encoding state machine enum

- **Date:** Unknown
- **Status:** Accepted
- **Context:** Booking lifecycle has strict transition rules. Scattering `if (status == X) status = Y` in services leads to bugs and is hard to audit.
- **Decision:** `BookingStatus` enum encodes its own `allowedTransitions()` as `Set<BookingStatus>`. `canTransitionTo()` is the single enforcement point. `InvalidBookingStateException` thrown for illegal transitions.
- **Consequences:** Adding a new state requires modifying the enum only. Services cannot accidentally bypass the machine without explicit `booking.setStatus()` (admin `forceCancel` does this deliberately and is documented). State diagram is code-as-documentation.

---

## ADR-005: Three-layer double-booking prevention

- **Date:** Unknown
- **Status:** Accepted
- **Context:** Under concurrent requests, two users could both pass the overlap check and both book the same car for overlapping dates.
- **Decision:** Three independent guards:
  1. `PESSIMISTIC_WRITE` lock on `Car` row in `BookingService.create()` — only one thread proceeds per car.
  2. `bookingRepository.existsOverlappingBooking()` query checks for PENDING/CONFIRMED overlaps.
  3. DB partial unique index `idx_bookings_no_overlap ON bookings(car_id, start_date, end_date) WHERE status IN ('PENDING','CONFIRMED')` — DB-level safety net.
- **Consequences:** Highest-cost but safest approach. `@Retryable(maxAttempts=3)` on `create()` handles `ObjectOptimisticLockingFailureException` from the car `@Version` column. Database is the final arbiter.

---

## ADR-006: `dailyRateSnapshot` for booking price immutability

- **Date:** Unknown
- **Status:** Accepted
- **Context:** If a car's `dailyRate` changes after a booking is created, the booking's `totalPrice` must not change. Financial correctness.
- **Decision:** Store `dailyRateSnapshot = car.dailyRate` at booking creation time. `totalPrice = dailyRateSnapshot × numberOfDays`. All reporting uses `dailyRateSnapshot`, never the current car rate.
- **Consequences:** Rate changes do not affect existing bookings (correct behavior). Historical pricing is always auditable from the booking row itself.

---

## ADR-007: Redis caching with graceful degradation

- **Date:** Unknown
- **Status:** Accepted
- **Context:** Car search is a hot read path. Repeated identical queries (same city/dates) should not hit PostgreSQL.
- **Decision:** Three named Redis caches with different TTLs. Custom `CacheErrorHandler` swallows Redis errors and logs WARN — app falls back to DB transparently.
- **Consequences:** Search results may be stale for up to 10 minutes. Booking create/cancel/complete evict `car-search` to prevent showing unavailable cars. Redis outage is non-fatal. Cache serialization uses `GenericJackson2JsonRedisSerializer` with type info (human-readable, class-rename safe).

---

## ADR-008: Kafka events publish only after DB commit

- **Date:** Unknown
- **Status:** Accepted
- **Context:** If Kafka events are sent inside `@Transactional` methods and the transaction rolls back, consumers receive events for bookings that don't exist in DB.
- **Decision:** Service layer calls `applicationEventPublisher.publishEvent(bookingEvent)`. `BookingEventProducer.handleBookingEvent()` is annotated `@TransactionalEventListener(phase = AFTER_COMMIT)` — Kafka send only fires after the DB transaction successfully commits.
- **Consequences:** Eliminates phantom events on rollback. Small window between DB commit and Kafka publish where DB state is ahead of Kafka — acceptable for this domain. Producer is idempotent (`enable.idempotence: true`).

---

## ADR-009: Admin operations consolidated under `/api/admin/**`

- **Date:** Unknown
- **Status:** Accepted
- **Context:** Admin-only operations need a clear security boundary. Scattering `@PreAuthorize("hasRole('ADMIN')")` across every method is error-prone.
- **Decision:** `AdminController` at `/api/admin/**` with class-level `@PreAuthorize("hasRole('ADMIN')")`. All fleet management and booking ops that require admin are in this controller.
- **Consequences:** `CarController` still has duplicated fleet management endpoints (also `@PreAuthorize` per method). This is a minor inconsistency — the `AdminController` path is preferred. See known issue in CLAUDE.md.

---

## ADR-010: Soft deletes on User and Car entities

- **Date:** Unknown
- **Status:** Accepted
- **Context:** Hard-deleting cars or users breaks referential integrity with bookings and audit logs. Historical data must be preserved.
- **Decision:** `deleted = false` column on both `users` and `cars`. Hibernate `@SQLDelete` overrides DELETE SQL with UPDATE. `@SQLRestriction("deleted = false")` filters all queries automatically.
- **Consequences:** Deleted entities are invisible to all Spring Data queries without any explicit filtering. DB partial indexes use `WHERE deleted = FALSE` to avoid indexing ghost rows. Booking rows are NOT soft-deleted — they use status CANCELLED/COMPLETED as their terminal state.

---

## ADR-011: AOP-based audit logging

- **Date:** Unknown
- **Status:** Accepted
- **Context:** Need an immutable audit trail for compliance. Putting audit writes in every service method is repetitive and easy to forget.
- **Decision:** `AuditAspect` uses `@Around` pointcuts on `BookingService.{create,confirm,cancel,complete}` and `CarService.updateStatus`. Audit write is async via `AuditLogService`. `audit_logs` table has no `updated_at` — records are write-once.
- **Consequences:** Adding a new audited method requires adding a pointcut. Actor is resolved from `SecurityContextHolder` — scheduled jobs resolve to `"SYSTEM"`. Async write means audit may be slightly delayed from the actual operation.

---

## ADR-012: Frontend framework choice (React + Vite)

- **Date:** Unknown
- **Status:** Accepted (scaffold only)
- **Context:** Frontend needs a modern SPA framework compatible with the REST API.
- **Decision:** React 19 with Vite 8 as build tool.
- **Consequences:** No routing library, state management, or API client has been chosen yet. These decisions are pending frontend development. React 19 is latest stable.
