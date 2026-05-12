# Handoff Document — Initial Scan

**Date:** 2026-05-12  
**Prepared by:** claude-sonnet-4-6 (initial codebase scan)  
**For:** Next developer or AI agent taking over this project

---

## What the App Does

A **car rental booking platform** for the Indian market (seed data covers Bengaluru, Mumbai, Chennai, Delhi). Users browse and book cars. Admins manage the fleet. Key flows:

1. **User registers / logs in** → gets JWT access + refresh tokens
2. **User searches available cars** by city and date range
3. **User creates a booking** → car is locked, price is calculated and frozen, booking is PENDING
4. **User or admin confirms** → PENDING → CONFIRMED
5. **Booking completes** (manually by admin or auto by scheduler) → CONFIRMED → COMPLETED, car released
6. **Booking cancelled** (by user, admin, force-cancel, or scheduler timeout) → car released

All state transitions produce Kafka events consumed by downstream services (not yet implemented).

---

## Current State

### What's working (backend is production-quality)

The backend is complete and production-grade. Specifically:

- Full auth flow (register, login, refresh, logout, change-password)
- Car search, detail, cities listing — Redis-cached
- Booking lifecycle with state machine enforcement
- Admin fleet management (CRUD on cars, status changes)
- Admin booking management (list/filter, complete, force-cancel)
- Audit trail (AOP-generated, immutable, queryable by entity/actor)
- Scheduled auto-cancel and auto-complete jobs
- Kafka event publishing (AFTER_COMMIT, idempotent producer)
- Prometheus metrics endpoint
- Swagger UI at `/swagger-ui.html`
- Double-booking prevention at three layers (pessimistic lock + query + DB index)
- Optimistic locking with retry on both Car and Booking
- Graceful Redis degradation

### What's missing / not started

1. **Frontend** — The React app is the default Vite template. Zero domain pages, no routing, no API client, no auth state. This is the entire UI layer.
2. **Kafka consumers** — Topics and events exist (`booking.created`, `booking.confirmed`, `booking.cancelled`, `booking.completed`, `audit.events`), but no consumer services. Notifications and settlement/refund are not implemented.
3. **Tests** — Testcontainers (PostgreSQL + Kafka) is declared as a dependency. Zero test files exist.
4. **Docker Compose** — No local dev stack file. Developer must run PostgreSQL, Redis, Kafka manually.
5. **User admin endpoints** — No way to list users, disable accounts, or promote to admin via API.
6. **Car image upload** — `image_url` field exists on Car; no upload endpoint.
7. **Reviews / ratings** — No schema, no endpoints.

---

## Architecture in 60 Seconds

```
[React SPA]  ←→  [Spring Boot REST API :8080]
                        │
                   ┌────┴─────────────────────────┐
                   │                               │
              [PostgreSQL]                    [Redis cache]
              (primary store)           (car-search/details/cities)
                   │
              [Kafka broker]
              (booking events — producers only)
```

- **JWT stateless auth** — no sessions, access=24h refresh=7d
- **Two roles** — `ROLE_USER`, `ROLE_ADMIN`
- **Booking state machine** — PENDING → CONFIRMED → COMPLETED | CANCELLED
- **Price immutability** — `dailyRateSnapshot` on every booking row
- **Soft deletes** — User + Car rows never hard-deleted
- **Scheduler** — hourly auto-cancel stale PENDING + auto-complete expired CONFIRMED bookings

---

## File You MUST Read Before Touching Anything

1. `backend/src/main/resources/db/migration/V1__init_schema.sql` — complete DB schema with all constraints and indexes
2. `backend/src/main/java/com/rentalcar/enums/BookingStatus.java` — state machine definition
3. `backend/src/main/java/com/rentalcar/service/BookingService.java` — all booking business logic
4. `backend/src/main/resources/application.yml` — all env vars and their defaults

---

## Dangerous / Fragile Areas

### 1. Booking creation concurrency (BookingService.create)
The three-layer double-booking prevention is intentional and critical. Do not simplify it. The PESSIMISTIC_WRITE lock on Car must come before the overlap check. `@Retryable` must stay — it handles the `@Version` conflict on Car.

### 2. Kafka AFTER_COMMIT pattern
`BookingEventProducer.handleBookingEvent()` fires only after DB commit. If you refactor to call `kafkaTemplate.send()` directly inside a `@Transactional` method, you will send events for rolled-back transactions.

### 3. Flyway migrations
Never edit an already-applied Flyway script. Flyway checksums will fail on startup. Add new `V{N}__description.sql` files for any schema change.

### 4. Soft deletes
`@SQLRestriction("deleted = false")` on Car and User is Hibernate-level magic. It means `carRepository.findAll()` never returns deleted cars. Do not add `WHERE deleted = false` manually — it's redundant and confusing.

### 5. Cache eviction
If you add a new mutation method for Car or Booking, you must add `@CacheEvict` on the appropriate caches. Missing eviction = stale search results showing cars that are no longer available.

### 6. `dailyRateSnapshot`
When creating new booking logic, always read `car.getDailyRate()` at booking creation time and store it. Never compute price from a later car state.

### 7. CORS wildcard
`SecurityConfig` sets `allowedOriginPatterns("*")`. This is development-only. For production, lock to the actual frontend origin.

### 8. JWT secret default
`application.yml` has a hardcoded default `JWT_SECRET`. If this deploys to prod without override, it's a security hole.

---

## Suggested Next Steps (priority order)

### Priority 1 — Docker Compose for local dev
Create `docker-compose.yml` at repo root spinning up PostgreSQL, Redis, and Kafka. Blocks everything else for new contributors.

### Priority 2 — Frontend core (auth + car search + booking)
Minimum viable UI:
1. Install `react-router-dom`, `axios`
2. Login / register pages (calls `/api/auth/login`, `/api/auth/register`)
3. JWT storage (httpOnly cookie preferred, or localStorage with short access token)
4. Car search page (calls `GET /api/cars/search?city=&startDate=&endDate=`)
5. Car detail + booking form (calls `POST /api/bookings`)
6. My bookings page (calls `GET /api/bookings/my`)

### Priority 3 — Write tests
Start with `BookingService` unit tests (mock repos) and one Testcontainers integration test for the full booking flow. The test infrastructure (Testcontainers dependencies) is already declared.

### Priority 4 — Notification consumer
Implement a Kafka consumer listening on `booking.created` and `booking.confirmed` topics to send email notifications. The event payload (`BookingEvent`) already contains all needed fields (userEmail, car details, dates, price).

### Priority 5 — User management admin API
`GET /api/admin/users` (paginated), `PATCH /api/admin/users/{id}/disable`, `PATCH /api/admin/users/{id}/role`.

---

## Seed Data for Testing

Admin user:
- Username: `admin`
- Email: `admin@rentalcar.com`
- Password: `Admin@123`

Sample cars: 10 pre-seeded across Bengaluru (5), Mumbai (2), Chennai (2), Delhi (1). All AVAILABLE. License plates format: `KA01AB1234` etc.

---

## Port Map

| Service | Default Port |
|---------|-------------|
| Spring Boot API | 8080 |
| Swagger UI | 8080/swagger-ui.html |
| Prometheus metrics | 8080/actuator/prometheus |
| Vite dev server | 5173 |
| PostgreSQL | 5432 |
| Redis | 6379 |
| Kafka | 9092 |
