# Task Log

---

## 2026-05-12 (session 3)

**Agent/Model:** Codex (GPT-5)  
**Changes made:**
- Investigated failing admin login across auth flow, security config, seed data, and live database state
- Verified `AuthService.login()` and Spring Security username/email lookup were correct
- Confirmed the seeded admin BCrypt hash did not match `Admin@123`
- Fixed the admin seed hash in `backend/src/main/resources/db/migration/V1__init_schema.sql`
- Added `backend/src/main/resources/db/migration/V3__fix_seed_admin_password.sql` to repair existing databases
- Repaired the Flyway checksum mismatch with `mvn -Dflyway.url=jdbc:postgresql://localhost:5432/rentalcardb -Dflyway.user=vidhan -Dflyway.password=vidhan -Dflyway.locations=filesystem:src/main/resources/db/migration flyway:repair`
- Applied the pending admin-password repair migration with `flyway:migrate`
- Verified the repaired schema history and updated admin password hash directly in PostgreSQL
- Verified `POST /api/auth/login` succeeds for `admin` / `Admin@123` with HTTP 200 and a valid JWT auth response
- Marked the tracked admin login debug task as completed
- Verified the backend still builds with `mvn -q -DskipTests package`

**Blockers:** None  
**Next steps:** Consider adding Flyway Maven plugin configuration so `flyway:repair` and `flyway:migrate` do not require explicit JDBC parameters in local development

---

## 2026-05-12 (session 2)

**Agent/Model:** claude-sonnet-4-6  
**Changes made:**
- Built full React frontend (25 files)
- Installed react-router-dom v6, axios, tailwindcss v3
- AuthContext + axios interceptors with auto JWT refresh
- Pages: Login, Register, Search (hero + paginated cards), CarDetail + booking form, MyBookings, Admin dashboard
- Components: Navbar, ProtectedRoute, AdminRoute, CarCard, BookingCard, StatusBadge, Pagination
- Admin dashboard: Fleet management (add/edit car form), Bookings table (filter/complete/force-cancel), Audit trail viewer
- Avis-inspired design: #C01A2A primary, dark navbar, white cards, mobile-first

**Blockers:** None  
**Next steps:** Docker Compose for local dev, write tests, Kafka notification consumers

---

## 2026-05-12 (session 1)

**Agent/Model:** claude-sonnet-4-6  
**Changes made:**
- Full codebase scan (backend + frontend)
- Created CLAUDE.md, AGENTS.md, .ai/tasks.md, .ai/decisions.md, .ai/handoffs/initial-scan-2026-05-12.md, backend/CLAUDE.md, frontend/CLAUDE.md

**Blockers:** None  
**Next steps:** Build frontend domain pages (see [ ] items below)

---

## Implemented Features

### Backend
- [x] User registration + login (username or email)
- [x] JWT access token (24h) + refresh token (7d, DB-persisted, revokable)
- [x] Change password + logout (token revocation)
- [x] `GET /api/auth/me` current user info
- [x] Car search by city + date range (Redis-cached 10min)
- [x] Car detail by ID (Redis-cached 30min)
- [x] Available cities list (Redis-cached 1hr)
- [x] Booking creation with PESSIMISTIC_WRITE lock + date overlap check
- [x] Booking state machine: PENDING → CONFIRMED → COMPLETED / CANCELLED
- [x] Booking cancellation with reason
- [x] Admin: add/update/delete car (soft delete)
- [x] Admin: change car status (AVAILABLE/MAINTENANCE/RETIRED)
- [x] Admin: list all bookings with filters (status, userEmail, date range)
- [x] Admin: complete booking
- [x] Admin: force-cancel booking (bypasses state machine)
- [x] Audit logging via AOP (booking lifecycle + car status changes)
- [x] Audit trail API endpoints (by entity, by actor)
- [x] Auto-cancel stale PENDING bookings (scheduler, configurable timeout)
- [x] Auto-complete expired CONFIRMED bookings (scheduler)
- [x] Kafka event publishing for all booking state transitions (after DB commit)
- [x] Micrometer counters for bookings.created, bookings.cancelled (by reason), bookings.completed
- [x] Prometheus metrics endpoint (`/actuator/prometheus`)
- [x] Swagger UI (`/swagger-ui.html`)
- [x] Flyway schema migrations (V1 full schema + seed, V2 audit IP)
- [x] `dailyRateSnapshot` price immutability
- [x] `@Retryable` on booking create for optimistic lock conflicts
- [x] Graceful Redis failure handling (log + fallback to DB)
- [x] `RequestTraceFilter` for MDC trace IDs
- [x] Partial unique DB index for double-booking prevention
- [x] `@ValidDateRange` custom constraint on `BookingRequest`
- [x] Optimistic locking (`@Version`) on Car and Booking entities

### Frontend
- [x] Vite + React 19 project scaffolded
- [x] Routing (react-router-dom v6)
- [x] Login/register pages
- [x] Car search page (hero + city/date filters + paginated car cards)
- [x] Car detail page (specs + sticky booking form + price preview)
- [x] Booking creation flow (POST /api/bookings, redirect on success)
- [x] My bookings page (confirm/cancel actions, status badges)
- [x] Admin dashboard (3-tab: Fleet / Bookings / Audit)
- [x] Admin fleet management (add car form, status change, delete)
- [x] Admin booking management (filter by status/email/date, complete, force-cancel)
- [x] Admin audit trail viewer (search by entityType + UUID)
- [x] API integration (axios instance with base URL)
- [x] Auth state management (AuthContext, JWT in memory, refresh token in localStorage)
- [x] Auto token refresh on 401 (axios response interceptor)
- [x] ProtectedRoute + AdminRoute guards
- [x] Tailwind CSS v3 with Avis-inspired design (#C01A2A primary)

---

## Missing / Not Implemented

- [ ] Kafka consumers (notification service, settlement/refund service)
- [ ] Email/SMS notifications on booking events
- [ ] Payment processing / refund flow
- [ ] User management admin endpoints (list, enable/disable, promote role)
- [ ] Car image upload endpoint
- [ ] Reviews and ratings system
- [ ] Unit tests (JUnit 5 + Mockito)
- [ ] Integration tests (Testcontainers — PostgreSQL + Kafka)
- [ ] Docker Compose for local dev (PostgreSQL + Redis + Kafka)
- [ ] Production CORS configuration
- [ ] Secure JWT secret management (must override `JWT_SECRET` env var)
- [ ] Rate limiting on auth endpoints
- [ ] Car search by additional filters (category, price range, transmission, fuel type)
- [ ] Booking history with cancellation reason visible to user
- [x] Debug admin login (seeded admin password hash corrected; existing DBs repaired via Flyway V3)
