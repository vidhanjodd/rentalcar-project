# Task Log

---

## 2026-05-12

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
- [ ] Routing (react-router-dom not yet installed)
- [ ] Login/register pages
- [ ] Car search page
- [ ] Car detail page
- [ ] Booking creation flow
- [ ] My bookings page
- [ ] Admin dashboard
- [ ] Admin fleet management
- [ ] Admin booking management
- [ ] API integration (axios/fetch client)
- [ ] Auth state management (JWT storage + refresh)

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
