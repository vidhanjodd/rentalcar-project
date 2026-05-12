# Rental Car Booking — CLAUDE.md

**Project:** rental-car-booking  
**Purpose:** Production-grade car rental platform — users search/book cars, admins manage fleet and operations.

---

## Agent Workflow (MANDATORY)

Before starting ANY task:
1. Read `.ai/tasks.md` — check if already tracked; find related incomplete items
2. Read `.ai/decisions.md` — check if an ADR covers the area you're about to touch
3. Do the work
4. Update `.ai/tasks.md` — mark completed tasks `[x]`, add new tasks if discovered

Also read before touching specific areas:
- `backend/CLAUDE.md` — before any backend change (routes, schema, caching patterns)
- `frontend/CLAUDE.md` — before any frontend change (API integration, routing plan)
- `.ai/handoffs/initial-scan-2026-05-12.md` — if starting fresh on an unfamiliar area

**Never skip step 4.** `.ai/tasks.md` is the living state of what's done and what's not.

---

## Tech Stack

### Backend
| Layer | Technology | Version |
|-------|-----------|---------|
| Language | Java | 21 |
| Framework | Spring Boot | 3.2.5 |
| Security | Spring Security + JJWT | JJWT 0.12.5 |
| Database | PostgreSQL | latest |
| ORM | Hibernate 6 / Spring Data JPA | (Boot-managed) |
| Migrations | Flyway | (Boot-managed) + flyway-database-postgresql 10.10.0 |
| Cache | Redis via Lettuce | (Boot-managed) |
| Messaging | Apache Kafka | (Boot-managed) |
| Metrics | Micrometer + Prometheus | 1.12.5 |
| API Docs | SpringDoc OpenAPI (Swagger UI) | 2.4.0 |
| Retry | Spring Retry | 2.0.5 |
| Code-gen | Lombok | 1.18.30 |
| Build | Maven | — |

### Frontend
| Layer | Technology | Version |
|-------|-----------|---------|
| Language | JavaScript (JSX) | — |
| Framework | React | 19.2.6 |
| Build Tool | Vite | 8.0.12 |
| Styling | Plain CSS | — |

> **Frontend status:** bare Vite+React scaffold — no routing, no API calls, no domain components yet.

---

## Folder Structure

```
rentalcar-project/
├── backend/                          Spring Boot application
│   ├── src/main/java/com/rentalcar/
│   │   ├── RentalCarApplication.java Main entry point
│   │   ├── audit/                    AOP aspect + async audit log service
│   │   ├── config/                   SecurityConfig, RedisConfig, KafkaConfig
│   │   ├── controller/               REST controllers (Auth, Car, Booking, Admin)
│   │   ├── dto/request/              Incoming request DTOs (@Valid annotated)
│   │   ├── dto/response/             Outgoing response DTOs (Lombok @Builder)
│   │   ├── entity/                   JPA entities (User, Car, Booking, RefreshToken, AuditLog)
│   │   ├── enums/                    Role, CarStatus, CarCategory, BookingStatus (state machine)
│   │   ├── exception/                Domain exceptions + GlobalExceptionHandler
│   │   ├── filter/                   RequestTraceFilter (MDC trace IDs)
│   │   ├── kafka/                    BookingEvent POJO + BookingEventProducer
│   │   ├── repository/               Spring Data JPA repositories
│   │   ├── scheduler/                BookingScheduler (auto-cancel, auto-complete)
│   │   ├── security/                 JwtTokenProvider, JwtAuthenticationFilter, UserPrincipal
│   │   ├── service/                  AuthService, CarService, BookingService (all business logic)
│   │   └── validation/               @ValidDateRange custom constraint
│   ├── src/main/resources/
│   │   ├── application.yml           All config (env vars with defaults)
│   │   └── db/migration/             Flyway SQL scripts
│   │       ├── V1__init_schema.sql   Full schema + seed data
│   │       └── V2__add_ip_address_to_audit_logs.sql
│   └── pom.xml
├── frontend/                         React + Vite (scaffold only)
│   ├── src/
│   │   ├── App.jsx                   Default Vite template — not yet domain-specific
│   │   ├── main.jsx                  React root mount
│   │   └── assets/                   hero.png, logos
│   ├── index.html
│   └── package.json
├── .ai/                              AI agent memory (tasks, decisions, handoffs)
├── CLAUDE.md                         This file
└── AGENTS.md                         AI-agent-compatible version of this file
```

---

## Architecture Decisions

### Authentication
- Stateless JWT (no server-side sessions). Access token: 24h. Refresh token: 7d, stored in `refresh_tokens` DB table (can be revoked).
- Login accepts username OR email (UserDetailsService checks both).
- Passwords BCrypt strength 12.
- `UserPrincipal` wraps Spring Security `UserDetails` — carries UUID id + email + role beyond just username.

### Authorization
- Two roles: `ROLE_USER`, `ROLE_ADMIN`.
- `GET /api/cars/**` — public (no auth).
- `POST /api/auth/**` — public.
- `/api/admin/**` — class-level `@PreAuthorize("hasRole('ADMIN')")`.
- All other endpoints — authenticated.
- CORS: wildcard origin pattern (dev mode) — **lock this down for prod**.

### Database
- PostgreSQL only. Flyway owns all schema changes — Hibernate `ddl-auto: validate`.
- All PKs are UUID (`gen_random_uuid()`).
- Soft deletes on `users` and `cars` via `deleted` boolean. Hibernate `@SQLDelete` + `@SQLRestriction` make deleted rows invisible to all queries automatically.
- `BaseEntity` provides `id`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy` (JPA auditing).
- `version` column on `Car` and `Booking` for optimistic locking.
- DB-level double-booking guard: `UNIQUE INDEX idx_bookings_no_overlap ON bookings(car_id, start_date, end_date) WHERE status IN ('PENDING','CONFIRMED')`.

### Booking State Machine
```
PENDING ──► CONFIRMED ──► COMPLETED
   │              │
   └──► CANCELLED ◄┘
```
Encoded in `BookingStatus` enum with `allowedTransitions()` — invalid transitions throw `InvalidBookingStateException`.

### Concurrency
- `BookingService.create()`: PESSIMISTIC_WRITE lock on `Car` row + overlap check query. Wrapped in `@Retryable(ObjectOptimisticLockingFailureException, maxAttempts=3)`.
- All state transitions: PESSIMISTIC_WRITE lock on `Booking` row via `findByIdWithLock()`.

### Caching (Redis)
Three named caches:
| Cache name | TTL | Evicted on |
|-----------|-----|-----------|
| `car-search` | 10 min | booking create/cancel/complete, car update/delete |
| `car-details` | 30 min | car update/delete |
| `cities` | 1 hr | car create/delete |

Redis errors are swallowed and logged as WARN — app degrades gracefully (fallback to DB).

### Kafka Events
`BookingEventProducer` publishes Spring `ApplicationEvent` inside the transaction. `@TransactionalEventListener(AFTER_COMMIT)` sends to Kafka only after DB commits — prevents phantom events on rollback.

Topics: `booking.created`, `booking.confirmed`, `booking.cancelled`, `booking.completed`, `audit.events`.

Partition key = `bookingId` → events for the same booking are ordered.

### Pricing
`totalPrice = dailyRate × numberOfDays`. `dailyRateSnapshot` stored at booking creation time — rate changes never affect existing bookings.

### Scheduling
`BookingScheduler` runs hourly (configurable via `app.scheduling.interval-ms`):
1. Auto-cancel PENDING bookings older than `app.scheduling.pending-timeout-minutes` (default 30).
2. Auto-complete CONFIRMED bookings past their `end_date`.

### Audit Logging
Spring AOP `@Around` advice intercepts `BookingService.{create,confirm,cancel,complete}` and `CarService.updateStatus`. Writes async to `audit_logs` (write-once, no `updated_at`).

---

## Coding Conventions

- **Entities:** Lombok `@Builder + @Getter + @Setter + @NoArgsConstructor + @AllArgsConstructor`. Extend `BaseEntity`.
- **DTOs:** Request DTOs use Jakarta Bean Validation (`@NotNull`, `@NotBlank`, `@Valid`). Response DTOs use Lombok `@Builder`.
- **Services:** `@Transactional(readOnly = true)` at class level; `@Transactional` or `@Transactional(isolation = ...)` on mutating methods.
- **Controllers:** Constructor injection via `@RequiredArgsConstructor`. `@AuthenticationPrincipal UserPrincipal` for current user. Return `ResponseEntity<T>` explicitly.
- **Naming:** camelCase Java, snake_case DB columns/tables. Enum values UPPER_SNAKE_CASE. Stored in DB as `@Enumerated(EnumType.STRING)`.
- **Pagination:** All list endpoints return `PageResponse<T>` wrapper (totalElements, totalPages, page, size, content).
- **Exception handling:** Custom domain exceptions (e.g., `BookingDateConflictException`, `CarNotAvailableException`). `GlobalExceptionHandler` maps to HTTP status codes.
- **No null fields in JSON:** `spring.jackson.default-property-inclusion: non_null`.

---

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_URL` | `jdbc:postgresql://localhost:5432/rentalcardb` | PostgreSQL JDBC URL |
| `DB_USER` | `vidhan` | DB username |
| `DB_PASSWORD` | `vidhan` | DB password |
| `REDIS_HOST` | `localhost` | Redis host |
| `REDIS_PORT` | `6379` | Redis port |
| `REDIS_PASSWORD` | _(empty)_ | Redis password |
| `KAFKA_SERVERS` | `localhost:9092` | Kafka bootstrap servers |
| `KAFKA_CONSUMER_GROUP` | `rental-car-group` | Kafka consumer group |
| `JWT_SECRET` | _(hardcoded hex — change in prod)_ | JWT signing secret |
| `JWT_EXPIRATION_MS` | `86400000` (24h) | Access token TTL |
| `JWT_REFRESH_MS` | `604800000` (7d) | Refresh token TTL |
| `SERVER_PORT` | `8080` | HTTP port |
| `PENDING_TIMEOUT_MINUTES` | `30` | Stale booking cancel threshold |
| `SCHEDULER_INTERVAL_MS` | `3600000` (1h) | Scheduler run interval |

---

## Running Locally

### Prerequisites
- Java 21, Maven 3.9+
- PostgreSQL running with DB `rentalcardb` and user `vidhan`/`vidhan`
- Redis on `localhost:6379`
- Kafka on `localhost:9092`

### Backend
```bash
cd backend
mvn spring-boot:run
# API: http://localhost:8080
# Swagger: http://localhost:8080/swagger-ui.html
# Health: http://localhost:8080/actuator/health
```

### Frontend
```bash
cd frontend
npm install
npm run dev
# http://localhost:5173
```

### Build
```bash
cd backend && mvn clean package -DskipTests
cd frontend && npm run build
```

### Tests
```bash
cd backend && mvn test
# Integration tests require Docker (Testcontainers: PostgreSQL + Kafka containers)
```

### Seed Admin Credentials
- Username: `admin` | Email: `admin@rentalcar.com` | Password: `Admin@123`

---

## Known Issues / Technical Debt

1. **Frontend is a stub.** The React app is the default Vite template — no pages, no routing, no API integration. This is the single largest gap.
2. **CORS is wildcard** (`allowedOriginPatterns: "*"`) — must be restricted before production deployment.
3. **JWT secret has a hardcoded default** in `application.yml` — must override via `JWT_SECRET` env var in prod.
4. **No email notifications.** Kafka consumers for notification events are not implemented (only the producer side exists).
5. **No payment integration.** `BOOKING_FORCE_CANCELLED` event comment references a `SettlementConsumer` — not implemented.
6. **`CarController` duplicates admin fleet endpoints** also in `AdminController` — two paths for the same operations (`POST /api/cars` and `POST /api/admin/cars`). Should consolidate.
7. **No user management endpoints** (list users, disable users, promote to admin) beyond what `AuthController` provides.
8. **No test files found** under `src/test/` — Testcontainers is a dependency but no tests are written yet.

---

## Car Rental Domain Rules

- A car can only be booked if `status = AVAILABLE`.
- `totalPrice = car.dailyRate × (endDate − startDate).days`.
- `dailyRateSnapshot` locks in the rate at booking time; future rate changes don't affect existing bookings.
- `start_date` must be strictly in the future; `end_date` must be strictly after `start_date`.
- No two PENDING/CONFIRMED bookings for the same car may overlap dates (enforced at app layer AND DB partial unique index).
- Releasing a car (cancel/complete) sets `Car.status` back to `AVAILABLE`.
- PENDING bookings older than `pendingTimeoutMinutes` are auto-cancelled (car is released).
- CONFIRMED bookings past `end_date` are auto-completed (car is released).
- Cars support categories: SUV, SEDAN, HATCHBACK (enum `CarCategory`).
- Cars support statuses: AVAILABLE, BOOKED, MAINTENANCE, RETIRED (`CarStatus`).
- Soft-deleted cars are invisible to all queries — fleet is never hard-deleted.
- Admin can force-cancel any non-terminal booking, bypassing the state machine.
