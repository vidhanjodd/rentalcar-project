# backend/CLAUDE.md — Spring Boot Backend

---

## Stack

- Java 21, Spring Boot 3.2.5, Maven
- Spring Security (stateless JWT, JJWT 0.12.5)
- Spring Data JPA + Hibernate 6 (PostgreSQL dialect)
- PostgreSQL + Flyway (owns schema — never change `ddl-auto` from `validate`)
- Redis via Lettuce (`spring-boot-starter-data-redis`)
- Apache Kafka (`spring-kafka`)
- Micrometer + Prometheus (`micrometer-registry-prometheus`)
- SpringDoc OpenAPI 2.4.0 (Swagger UI)
- Spring Retry 2.0.5
- Lombok 1.18.30 (compile-time only, excluded from fat jar)

---

## API Route Structure

All controllers under `com.rentalcar.controller`:

| Controller | Base Path | Auth |
|-----------|-----------|------|
| `AuthController` | `/api/auth` | Public |
| `CarController` | `/api/cars` | GET = public; mutations = ADMIN |
| `BookingController` | `/api/bookings` | Authenticated |
| `AdminController` | `/api/admin` | ADMIN (class-level) |

Naming convention:
- Collections: plural noun (`/bookings`, `/cars`)
- State transitions: PATCH + verb (`/confirm`, `/cancel`, `/complete`)
- Admin override: POST + noun (`/force-cancel`)
- Nested resources under admin: `/admin/cars`, `/admin/bookings`, `/admin/audit`

---

## Database Schema Overview

Tables: `users`, `refresh_tokens`, `cars`, `bookings`, `audit_logs`

All PKs are UUID (`gen_random_uuid()` via pgcrypto extension).

### Key constraints
- `cars.daily_rate > 0`, `cars.year BETWEEN 1900 AND 2100`
- `bookings.end_date > bookings.start_date`, `bookings.total_price > 0`
- `UNIQUE INDEX idx_bookings_no_overlap ON bookings(car_id, start_date, end_date) WHERE status IN ('PENDING','CONFIRMED')` — DB-level double-booking guard

### Soft deletes
`users` and `cars` have `deleted BOOLEAN NOT NULL DEFAULT FALSE`. `@SQLDelete` issues UPDATE instead of DELETE. `@SQLRestriction("deleted = false")` filters all Hibernate queries. Bookings are NOT soft-deleted.

### Auditing
`BaseEntity` provides `id (UUID)`, `createdAt`, `updatedAt`, `createdBy`, `updatedBy` via JPA auditing.

### Optimistic locking
`@Version Long version` on `Car` and `Booking` entities.

---

## Auth and Security Patterns

- `SecurityConfig`: CSRF disabled, CORS wildcard (dev only), `STATELESS` session, method security enabled.
- Public: `/api/auth/**`, `GET /api/cars/**`, Swagger, actuator health/info.
- `JwtAuthenticationFilter` runs before `UsernamePasswordAuthenticationFilter`.
- `UserPrincipal` implements `UserDetails` — extends it with `UUID id`, `String email`, `String role`.
- Login accepts username OR email: `UserDetailsService` tries `findByUsername` then `findByEmail`.
- BCrypt strength 12 for passwords.
- Refresh tokens stored in `refresh_tokens` table with `revoked` flag — logout + change-password revoke all tokens.

---

## Business Logic Location

All business logic is in `service/`. Controllers are thin (validate input, call service, return response).

| Service | Responsibility |
|---------|---------------|
| `AuthService` | Registration, login, token refresh, logout, password change |
| `CarService` | Car CRUD, availability search, cache management |
| `BookingService` | Full booking lifecycle — create, confirm, cancel, complete, forceCancel, auto operations |

### BookingService.create() — critical path
```
1. @ValidDateRange on DTO (custom annotation)
2. validateDateRange() defensive re-check
3. Load user by principal.getId()
4. PESSIMISTIC_WRITE lock on Car row
5. Assert car.status == AVAILABLE
6. existsOverlappingBooking() query
7. Compute totalPrice = dailyRate × days
8. Build Booking with dailyRateSnapshot = car.dailyRate
9. Set car.status = BOOKED
10. Save car + booking
11. publishCreated() → ApplicationEvent → @TransactionalEventListener fires Kafka AFTER_COMMIT
12. Increment micrometer counter
```

### State machine enforcement
`transitionStatus(booking, target)` always calls `booking.getStatus().canTransitionTo(target)`. Never bypass. `forceCancel` is the only operation that sets status directly without `canTransitionTo`.

---

## Caching Patterns

Three caches, constants in `RedisConfig`:
```java
CACHE_CAR_SEARCH  = "car-search"   // TTL 10min
CACHE_CAR_DETAILS = "car-details"  // TTL 30min
CACHE_CITIES      = "cities"       // TTL 1hr
```

`@CacheEvict` on mutations:
- Booking create/cancel/complete → evict `car-search` (car availability changed)
- Car update/delete → evict `car-search` + `car-details`
- Car create → evict `cities`

Redis errors are swallowed by custom `CacheErrorHandler` (log WARN, fall back to DB).

---

## Kafka Patterns

Topics (constants in `KafkaConfig`): `booking.created`, `booking.confirmed`, `booking.cancelled`, `booking.completed`, `audit.events`

**Do not call `kafkaTemplate.send()` directly inside `@Transactional` methods.** Always:
1. Call `bookingEventProducer.publish*()` inside the transaction → fires `ApplicationEvent`
2. `BookingEventProducer.handleBookingEvent()` picks it up via `@TransactionalEventListener(AFTER_COMMIT)` → sends to Kafka

Partition key = `bookingId.toString()` → events for same booking are ordered.

---

## Scheduling

`BookingScheduler` runs both jobs every `app.scheduling.interval-ms` (default 1hr):

1. `cancelStalePendingBookings()`: finds PENDING bookings where `createdAt < now - pendingTimeoutMinutes`
2. `completeExpiredBookings()`: finds CONFIRMED bookings where `endDate < today`

Both call `BookingService.autoCancel(booking)` / `BookingService.autoComplete(booking)` directly (bypasses Spring proxy — direct bean ref, so `@Transactional` and `@CacheEvict` work correctly because scheduler calls service bean, not `this`).

---

## Audit Logging

`AuditAspect` intercepts (via AOP `@Around`):
- `BookingService.create`, `.confirm`, `.cancel`, `.complete`
- `CarService.updateStatus`

`AuditLogService.log()` writes to `audit_logs` asynchronously. Records are write-once (no `updatedAt`). Actor resolved from `SecurityContextHolder` — falls back to `"SYSTEM"` for scheduler operations.

IP address recorded since V2 migration (`ip_address VARCHAR(45)` added to `audit_logs`).

---

## Naming Conventions

| Type | Convention | Example |
|------|-----------|---------|
| Entity fields | camelCase | `dailyRate`, `licensePlate` |
| DB columns | snake_case | `daily_rate`, `license_plate` |
| Enum values | UPPER_SNAKE_CASE | `ROLE_ADMIN`, `BOOKED` |
| Enums stored in DB | `@Enumerated(EnumType.STRING)` | `"AVAILABLE"` not `"0"` |
| Request DTOs | `{Entity}Request` | `BookingRequest`, `CarRequest` |
| Response DTOs | `{Entity}Response` | `BookingResponse`, `CarResponse` |
| Exceptions | Descriptive domain names | `BookingDateConflictException`, `CarNotAvailableException` |

All response lists are wrapped in `PageResponse<T>` with `totalElements`, `totalPages`, `page`, `size`, `content[]`.

---

## Running and Building

```bash
# Run (requires PostgreSQL + Redis + Kafka locally)
mvn spring-boot:run

# Build fat jar
mvn clean package -DskipTests

# Run fat jar
java -jar target/rental-car-booking-1.0.0-SNAPSHOT.jar

# Tests
mvn test  # requires Docker for Testcontainers

# Swagger UI
open http://localhost:8080/swagger-ui.html

# Health check
curl http://localhost:8080/actuator/health
```

---

## Adding a New Feature — Checklist

- [ ] Schema change? → new `V{N}__description.sql` in `db/migration/`
- [ ] New entity? → extend `BaseEntity`, add `@Builder @Getter @Setter @NoArgsConstructor @AllArgsConstructor`
- [ ] New mutation? → add `@CacheEvict` if Car/Booking is touched
- [ ] New booking state operation? → add transition in `BookingStatus.allowedTransitions()`
- [ ] New service method to audit? → add `@Pointcut` + `@Around` in `AuditAspect`
- [ ] New Kafka event type? → add to `BookingEvent.EventType`, add case in `topicFor()`, call `bookingEventProducer.publish*()`
- [ ] New admin endpoint? → put in `AdminController` under `/api/admin/**`
- [ ] New Micrometer metric? → inject `MeterRegistry` and call `.counter().increment()`
