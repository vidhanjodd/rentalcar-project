# Task Log

---

## 2026-05-21 (session 6)

**Agent/Model:** Antigravity (Gemini 3.5 Flash)  
**Changes made:**
- **DOCKERIZATION & DEPLOYMENT**:
  - **`backend/Dockerfile`**: Multi-stage build (Maven compiler stage with Java 21 + minimal runtime stage using eclipse-temurin:21-jre-alpine).
  - **`frontend/Dockerfile`**: Multi-stage build (Node 20 builder + Nginx:alpine runtime).
  - **`frontend/nginx.conf`**: Configured Nginx to serve React static files and act as a reverse proxy for `/api/*`, `/swagger-ui*`, `/api-docs*`, and `/actuator/*` pointing to backend container.
  - **`docker-compose.yml`**: Created orchestration for postgres:16-alpine, redis:7-alpine, zookeeper, kafka (confluentinc/cp-kafka:7.5.0), Spring Boot backend, and Nginx frontend.
  - **`frontend/src/api/axios.js` and `frontend/src/api/auth.js`**: Refactored hardcoded API baseURL to read dynamic `import.meta.env.VITE_API_BASE_URL` with fallback to `http://localhost:8080` for developer convenience.
- **Why**: Allows deployment of isolated containers to AWS EC2, runs entire stack on single port (80) under a unified origin, and solves browser-side CORS and httpOnly Cookie sharing constraints.

**Blockers:** None  
**Next steps:** Prepare EC2 host with Docker/Docker Compose and run it.

---

## 2026-05-13 (session 5 — part 2)

**Agent/Model:** claude-sonnet-4-6  
**Changes made:**
- **SECURITY — refresh token moved to httpOnly cookie** (backend + frontend):
  - **`AuthController.java`**: `login` and `register` now call `setRefreshCookie()` to write `refresh_token` as `httpOnly; SameSite=Strict; path=/api/auth` cookie, then null out the `refreshToken` field before returning the JSON response. `refresh` endpoint reads token from cookie (`extractRefreshCookie()`) instead of request body — returns 401 if cookie absent. `logout` and `change-password` call `clearRefreshCookie()` (maxAge=0) to expire the cookie server-side.
  - **`application.yml`**: Added `app.cookie.secure: ${COOKIE_SECURE:false}` — set env var `COOKIE_SECURE=true` in prod (requires HTTPS). Dev stays HTTP.
  - **`api/axios.js`**: Added `withCredentials: true` to the axios instance so cookies are sent on cross-origin requests (localhost:5173 → localhost:8080). Inner refresh call also uses `withCredentials: true`. Removed all `localStorage.getItem/setItem/removeItem('refreshToken')` calls from the interceptor.
  - **`api/auth.js`**: `refresh()` sends empty body — token comes from cookie, not request body. `withCredentials: true` explicit on the raw axios call.
  - **`context/AuthContext.jsx`**: Startup refresh no longer checks `localStorage` first — just always hits `/api/auth/refresh` and lets the cookie speak. Removed all `localStorage.*('refreshToken')` calls from login, logout, and the catch block.
- **Why**: Refresh tokens in `localStorage` are readable by any XSS-injected script. An httpOnly cookie cannot be read by JavaScript at all — only the browser sends it automatically on matching requests. `SameSite=Strict` + `path=/api/auth` further scopes it so it's only sent to auth endpoints, not to every API call.

**Blockers:** None  
**Next steps:** Docker Compose for local dev (PostgreSQL + Redis + Kafka)

---

## 2026-05-13 (session 5)

**Agent/Model:** claude-sonnet-4-6  
**Changes made:**
- **BUG FIX — double refresh on bad token** (`api/auth.js`): `refresh()` was using the `api` axios instance, so a 401 from the refresh endpoint would trigger the response interceptor, which would attempt a second refresh with the same bad token before redirecting. Fixed by using raw `axios.post` for `refresh()` — consistent with how the interceptor itself calls the refresh endpoint internally.
- **BUG FIX — hard page reload on session expiry** (`App.jsx`, `api/axios.js`, `context/AuthContext.jsx`): Flipped `<BrowserRouter>` to wrap `<AuthProvider>` instead of the reverse. AuthProvider now calls `useNavigate()` (valid since it's inside the Router) and wires it into the axios interceptor via exported `setNavigate()`. Interceptor now does soft React Router navigation (`navigate('/login', { replace: true })`) instead of `window.location.href = '/login'` — preserves React state, no full page reload on token expiry.
- **SECURITY / MINOR — removed `window.__accessToken` global** (`api/axios.js`, `context/AuthContext.jsx`): Access token was stored on the global `window` object, readable by any XSS-injected script via the console. Replaced with a module-level closure variable `_accessToken` in `axios.js`. Exported `setAccessToken()` and `clearAccessToken()` functions for AuthContext to call. Token is now scoped to the axios module — not reachable from outside the module.
- **MINOR — removed `accessToken` from React state and context value**: Only `tokenPresent` boolean remains in React state (drives `isAuthenticated`). Actual token lives only in the axios module closure. Eliminates a second source of truth that could drift out of sync.

**Why these matter:**
- Double refresh was causing two API calls to `/api/auth/refresh` on startup with a stale/invalid token, and the hard redirect bypassed React Router losing URL state.
- `window.__accessToken` was security hygiene — access tokens should not be readable from the browser console.

**Blockers:** None  
**Next steps:** httpOnly cookie for refresh token (needs backend `AuthController` + `AuthService` changes — prod blocker for XSS safety)

---

## 2026-05-12 (session 4)

**Agent/Model:** claude-sonnet-4-6  
**Changes made:**
- Fixed admin role not showing in navbar/routes after login — `AuthContext.login()` was reading `data.user` (undefined) instead of mapping flat `AuthResponse` fields (`userId`, `username`, `email`, `role`) into user object
- Fixed logout on page refresh — added `useEffect` in `AuthProvider` that reads `refreshToken` from localStorage on mount, calls `POST /api/auth/refresh`, and restores `accessToken` + `user` state; app renders `null` during init to prevent flash of logged-out state
- Fixed admin Fleet tab showing no cars — backend had no list-all-cars endpoint; added `GET /api/admin/cars` to `AdminController` and `CarService.listAll(page, size)` using `carRepository.findAll(Pageable)` (soft-deleted cars excluded via `@SQLRestriction`)
- Added `adminListCars` to `frontend/src/api/cars.js`
- Rewrote `FleetTab` in `AdminPage.jsx` — now loads full car table on mount with brand/model/year/plate/city/category/dailyRate columns, inline status dropdown (triggers `PATCH /api/admin/cars/{id}/status`), Edit (opens pre-filled form) and Delete (confirm dialog) buttons per row, pagination
- Backend build verified clean after changes

**Blockers:** None  
**Next steps:** Docker Compose for local dev (PostgreSQL + Redis + Kafka)

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
- [x] Auth state management (AuthContext, JWT in module closure, refresh token in httpOnly cookie)
- [x] Auto token refresh on 401 (axios response interceptor, soft React Router redirect on expiry)
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
- [x] Docker Compose for local dev (PostgreSQL + Redis + Kafka)
- [ ] Production CORS configuration
- [ ] Secure JWT secret management (must override `JWT_SECRET` env var)
- [ ] Rate limiting on auth endpoints
- [ ] Car search by additional filters (category, price range, transmission, fuel type)
- [ ] Booking history with cancellation reason visible to user
- [x] Debug admin login (seeded admin password hash corrected; existing DBs repaired via Flyway V3)
