# Rental Car Booking — AGENTS.md

**Compatible with:** OpenAI Codex, Gemini, GitHub Copilot, Claude, and other AI coding agents.

**Project:** rental-car-booking  
**Purpose:** Production-grade car rental platform — users search/book cars, admins manage fleet.

---

## How to Read This Project as an AI Agent

1. **Start with the backend.** All business logic, domain rules, and data model live in `backend/src/main/java/com/rentalcar/`. The frontend is a bare scaffold with no domain code yet.
2. **Schema is authoritative.** Read `backend/src/main/resources/db/migration/V1__init_schema.sql` before touching any entity, DTO, or repository. Flyway owns schema — do not modify entities to drive schema changes.
3. **State machine is in the enum.** `BookingStatus.java` defines all valid transitions. Do not add `if/else` transition logic elsewhere.
4. **Security rules are in `SecurityConfig.java`.** Check permitted URLs before adding endpoints.
5. **Cache eviction is critical.** Any mutation to `Car` or `Booking` must evict the appropriate Redis caches (`car-search`, `car-details`, `cities`). Missing `@CacheEvict` causes stale search results.
6. **Kafka events fire after DB commit.** Publishing is done via Spring `ApplicationEvent` + `@TransactionalEventListener(AFTER_COMMIT)`. Never call `kafkaTemplate.send()` directly inside a `@Transactional` method.
7. **Lombok is heavy-use.** Entities use `@Builder`, `@Getter`, `@Setter`, `@NoArgsConstructor`, `@AllArgsConstructor`. Do not write manual constructors or getters/setters unless Lombok cannot handle the case.

---

## Tech Stack

### Backend
- Java 21, Spring Boot 3.2.5
- Spring Security (stateless JWT via JJWT 0.12.5)
- Spring Data JPA + Hibernate 6 + HikariCP
- PostgreSQL (UUID PKs, soft deletes, optimistic + pessimistic locking)
- Flyway for schema migrations
- Redis (Lettuce) for caching — 3 named caches
- Apache Kafka for async booking events
- Micrometer + Prometheus for metrics
- SpringDoc OpenAPI 2.4.0 (Swagger UI at `/swagger-ui.html`)
- Spring Retry 2.0.5
- Lombok 1.18.30

### Frontend
- React 19.2.6, Vite 8.0.12, plain CSS
- **Status: default Vite scaffold — zero domain code**

---

## Folder Structure

```
backend/src/main/java/com/rentalcar/
  audit/          AOP audit aspect + async audit log service
  config/         SecurityConfig, RedisConfig, KafkaConfig, KafkaConsumerConfig
  controller/     AuthController, CarController, BookingController, AdminController
  dto/request/    Incoming DTOs with Bean Validation
  dto/response/   Outgoing DTOs (Lombok Builder)
  entity/         User, Car, Booking, RefreshToken, AuditLog (extend BaseEntity)
  enums/          Role, CarStatus, CarCategory, BookingStatus (state machine enum)
  exception/      Domain exceptions + GlobalExceptionHandler
  filter/         RequestTraceFilter (MDC)
  kafka/          BookingEvent, BookingEventProducer
  repository/     Spring Data JPA repositories
  scheduler/      BookingScheduler (auto-cancel, auto-complete)
  security/       JwtTokenProvider, JwtAuthenticationFilter, UserPrincipal
  service/        AuthService, CarService, BookingService
  validation/     @ValidDateRange custom constraint

backend/src/main/resources/
  application.yml           All config with env-var defaults
  db/migration/             Flyway scripts (V1 full schema, V2 audit IP column)
```

---

## API Surface

### Auth — `/api/auth/**` (public)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/register` | Register user, returns JWT pair |
| POST | `/login` | Login (username or email), returns JWT pair |
| POST | `/refresh` | Exchange refresh token for new access token |
| POST | `/logout` | Revoke all refresh tokens |
| PUT | `/change-password` | Change password, invalidates refresh tokens |
| GET | `/me` | Current user info |

### Cars — `/api/cars/**`
| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/search` | None | Search available cars (Redis-cached 10min) |
| GET | `/{id}` | None | Car details (Redis-cached 30min) |
| GET | `/cities` | None | Available cities (Redis-cached 1hr) |
| POST | `/` | ADMIN | Add car to fleet |
| PUT | `/{id}` | ADMIN | Update car |
| PATCH | `/{id}/status` | ADMIN | Change car status |
| DELETE | `/{id}` | ADMIN | Soft-delete car |

### Bookings — `/api/bookings/**` (authenticated)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | Create booking (pessimistic lock, overlap check) |
| GET | `/my` | Paginated user bookings |
| GET | `/{id}` | Booking detail (owner or admin) |
| PATCH | `/{id}/confirm` | PENDING → CONFIRMED |
| PATCH | `/{id}/cancel` | → CANCELLED, releases car |

### Admin — `/api/admin/**` (ROLE_ADMIN)
| Method | Path | Description |
|--------|------|-------------|
| POST | `/cars` | Add car |
| PUT | `/cars/{id}` | Update car |
| PATCH | `/cars/{id}/status` | Change car status |
| DELETE | `/cars/{id}` | Soft-delete car |
| GET | `/bookings` | All bookings (filter: status, userEmail, date range) |
| PATCH | `/bookings/{id}/complete` | CONFIRMED → COMPLETED |
| POST | `/bookings/{id}/force-cancel` | Force-cancel any non-terminal booking |
| GET | `/audit/{entityType}/{entityId}` | Entity audit trail |
| GET | `/audit/actor/{actor}` | All actions by a user |

---

## Database Schema (key tables)

**users:** id (UUID PK), username, email, password (BCrypt), first_name, last_name, phone, role, enabled, deleted, created_at, updated_at, created_by, updated_by

**cars:** id, brand, model, year, license_plate (UNIQUE), category, color, status, daily_rate (>0 CHECK), city, seats, transmission, fuel_type, description, image_url, deleted, version, auditing cols

**bookings:** id, user_id (FK), car_id (FK), start_date, end_date, status, total_price, daily_rate_snapshot, pickup_location, dropoff_location, notes, cancellation_reason, version, auditing cols  
**Critical constraint:** `UNIQUE INDEX idx_bookings_no_overlap ON bookings(car_id, start_date, end_date) WHERE status IN ('PENDING','CONFIRMED')`

**refresh_tokens:** id, user_id (FK), token (UNIQUE), expires_at, revoked, created_at

**audit_logs:** id, entity_type, entity_id, action, old_value, new_value, actor, ip_address, details, created_at (write-once)

---

## Booking State Machine

```
PENDING ──► CONFIRMED ──► COMPLETED  (terminal)
   │              │
   └──► CANCELLED ◄┘                 (terminal)
```

Enforced by `BookingStatus.canTransitionTo()`. Any attempt to bypass throws `InvalidBookingStateException`. Admin `forceCancel` bypasses only for non-terminal states.

---

## Concurrency Model

- **Double-booking prevention:** `PESSIMISTIC_WRITE` lock on `Car` row + `existsOverlappingBooking()` JPQL query + DB partial unique index (three layers).
- **Optimistic locking:** `@Version` on `Car` and `Booking`. `BookingService.create()` wrapped in `@Retryable(maxAttempts=3, backoff=100ms×2)`.
- **State transitions:** `findByIdWithLock()` acquires `PESSIMISTIC_WRITE` on `Booking` before any status change.

---

## Environment Variables

| Variable | Default | Notes |
|----------|---------|-------|
| `DB_URL` | `jdbc:postgresql://localhost:5432/rentalcardb` | |
| `DB_USER` | `vidhan` | |
| `DB_PASSWORD` | `vidhan` | |
| `REDIS_HOST` | `localhost` | |
| `REDIS_PORT` | `6379` | |
| `REDIS_PASSWORD` | _(empty)_ | |
| `KAFKA_SERVERS` | `localhost:9092` | |
| `KAFKA_CONSUMER_GROUP` | `rental-car-group` | |
| `JWT_SECRET` | _(hex string — change in prod)_ | |
| `JWT_EXPIRATION_MS` | `86400000` | 24h |
| `JWT_REFRESH_MS` | `604800000` | 7d |
| `SERVER_PORT` | `8080` | |
| `PENDING_TIMEOUT_MINUTES` | `30` | Stale PENDING booking cutoff |
| `SCHEDULER_INTERVAL_MS` | `3600000` | 1h |

---

## Run Commands

```bash
# Backend
cd backend && mvn spring-boot:run

# Frontend
cd frontend && npm install && npm run dev

# Build artifacts
cd backend && mvn clean package -DskipTests
cd frontend && npm run build

# Tests (requires Docker for Testcontainers)
cd backend && mvn test
```

Seed admin: username `admin`, password `Admin@123`.

---

## What NOT to Change

These are locked architectural decisions. Do not alter without a new ADR in `.ai/decisions.md`.

1. **Flyway owns the schema.** Never set `ddl-auto` to anything but `validate`. All schema changes go through `db/migration/V{N}__description.sql`.
2. **Booking state machine lives in `BookingStatus` enum.** Do not add transition logic to services or controllers.
3. **Kafka events only after DB commit.** The `@TransactionalEventListener(AFTER_COMMIT)` pattern in `BookingEventProducer` must not be changed to synchronous sends.
4. **Soft deletes on User and Car.** `@SQLDelete` + `@SQLRestriction` on both entities. Do not add `WHERE deleted = false` manually to queries — Hibernate applies it automatically.
5. **`dailyRateSnapshot` immutability.** Booking price must be captured at creation time. Do not derive `totalPrice` from the current car rate at read time.
6. **UUID primary keys.** All entities use UUID PKs. Do not switch to auto-increment sequences.
7. **Stateless JWT.** No server-side session state. `SessionCreationPolicy.STATELESS` is intentional.
8. **`PESSIMISTIC_WRITE` lock on booking create.** This prevents double-bookings under concurrent requests. Do not remove or downgrade to optimistic-only.

---

## Missing / Incomplete Features

- [ ] Frontend UI (all domain pages: search, car detail, booking flow, my bookings, admin panel)
- [ ] Email/SMS notification consumers (Kafka topics exist, consumers not implemented)
- [ ] Payment / settlement consumer (`BOOKING_FORCE_CANCELLED` references `SettlementConsumer`)
- [ ] User management admin endpoints (list users, enable/disable, role promotion)
- [ ] Unit and integration tests (Testcontainers dependency present, no test files found)
- [ ] Car image upload (field exists, no upload endpoint)
- [ ] Reviews / ratings feature
- [ ] Production CORS configuration (currently wildcard)
