# frontend/CLAUDE.md — React Frontend

---

## Stack

| Technology | Version | Status |
|-----------|---------|--------|
| React | 19.2.6 | Installed |
| Vite | 8.0.12 | Installed |
| react-router-dom | — | NOT INSTALLED — needs adding |
| axios / fetch client | — | NOT INSTALLED — needs adding |
| CSS framework | Plain CSS | Minimal default styles only |
| State management | None yet | Needs decision |

**Current state:** Default Vite+React scaffold. `App.jsx` is the unmodified Vite template with a counter button. No domain pages exist.

---

## Component Patterns (to follow when building)

The backend follows REST conventions and returns `PageResponse<T>` for all lists. Frontend should:

- Use functional components + hooks only (no class components — React 19)
- Route with `react-router-dom` (v6+ declarative API)
- Store JWT access token in memory or httpOnly cookie (avoid localStorage for security)
- Use refresh token rotation: intercept 401 → call `/api/auth/refresh` → retry

---

## Routing Structure (to be built)

Suggested routes based on backend API:

```
/                       → Home / car search
/login                  → Login page
/register               → Registration page
/cars/:id               → Car detail page
/bookings/new?carId=X   → Booking creation form
/bookings               → My bookings list
/admin                  → Admin dashboard (ROLE_ADMIN only)
/admin/fleet            → Fleet management (add/edit/delete cars)
/admin/bookings         → All bookings with filters
/admin/audit            → Audit trail viewer
```

---

## API Integration Patterns

Backend runs on `http://localhost:8080` in dev. All endpoints documented at `/swagger-ui.html`.

### Auth endpoints
```
POST /api/auth/register   { username, email, password, firstName, lastName, phone? }
POST /api/auth/login      { usernameOrEmail, password }
POST /api/auth/refresh    { refreshToken }
POST /api/auth/logout
GET  /api/auth/me
```
Login response: `{ accessToken, refreshToken, tokenType: "Bearer", expiresIn, user: { id, username, email, role } }`

### Car search (public, no auth needed)
```
GET /api/cars/search?city=Bengaluru&startDate=2026-06-01&endDate=2026-06-05&page=0&size=10
GET /api/cars/:id
GET /api/cars/cities
```
Search response: `PageResponse<CarResponse>` where CarResponse has `id, brand, model, year, licensePlate, category, color, status, dailyRate, city, seats, transmission, fuelType, description, imageUrl`

### Booking flow
```
POST /api/bookings
  body: { carId, startDate, endDate, pickupLocation?, dropoffLocation?, notes? }
  → returns BookingResponse with totalPrice calculated server-side

GET  /api/bookings/my?page=0&size=10
GET  /api/bookings/:id
PATCH /api/bookings/:id/confirm
PATCH /api/bookings/:id/cancel?reason=optional
```

BookingResponse includes: `id, userId, username, userEmail, carId, carBrand, carModel, licensePlate, startDate, endDate, numberOfDays, status, totalPrice, dailyRateSnapshot, pickupLocation, dropoffLocation, notes, cancellationReason, createdAt, updatedAt`

### Admin APIs (ROLE_ADMIN header: `Authorization: Bearer <token>`)
```
POST   /api/admin/cars
PUT    /api/admin/cars/:id
PATCH  /api/admin/cars/:id/status?status=MAINTENANCE
DELETE /api/admin/cars/:id

GET    /api/admin/bookings?status=PENDING&userEmail=x&from=2026-06-01&to=2026-06-30
PATCH  /api/admin/bookings/:id/complete
POST   /api/admin/bookings/:id/force-cancel  body: { reason }

GET    /api/admin/audit/:entityType/:entityId
GET    /api/admin/audit/actor/:actor
```

---

## Car Rental UI Flows

### Search Flow
1. User selects city (from `/api/cars/cities`), start date, end date
2. `GET /api/cars/search` → paginated list of available cars
3. Each card shows: brand/model, category, dailyRate/day, city, seats, transmission, fuelType

### Booking Creation Flow
1. User clicks a car → car detail page
2. Date range pre-filled from search (editable)
3. Optional: pickup location, dropoff location, notes
4. `totalPrice` is calculated server-side on booking create — show estimated price client-side as `dailyRate × days` but final price comes from the response
5. Submit → `POST /api/bookings` → on success, redirect to booking confirmation page

### My Bookings Flow
1. `GET /api/bookings/my` → paginated list
2. Show status badge: PENDING (yellow), CONFIRMED (green), COMPLETED (grey), CANCELLED (red)
3. PENDING: show Confirm + Cancel buttons
4. CONFIRMED: show Cancel button
5. COMPLETED/CANCELLED: no actions, show cancellationReason if CANCELLED

### Admin Fleet Flow
1. Table of all cars (use `GET /api/cars/search` with no date filters, or admin needs a separate list-all endpoint — currently not available without search params; consider adding)
2. Add car form → `POST /api/admin/cars`
3. Edit car → `PUT /api/admin/cars/:id`
4. Status dropdown → `PATCH /api/admin/cars/:id/status`
5. Delete → `DELETE /api/admin/cars/:id` (confirm modal)

---

## Styling Conventions (to establish)

Current state: `App.css` and `index.css` are default Vite templates. No design system chosen.

Recommended approach (not yet implemented):
- Tailwind CSS or CSS Modules (keep it consistent, pick one before starting)
- No inline styles
- Color tokens for booking status: pending=#FFC107, confirmed=#28A745, completed=#6C757D, cancelled=#DC3545
- Responsive breakpoints: mobile-first

---

## State Management (decision pending)

No state management library is installed. Options ranked by complexity:
1. **React Context + useReducer** — sufficient for auth state + minimal global state
2. **Zustand** — lightweight, good for auth + cart-like booking state
3. **Redux Toolkit** — only if admin dashboard needs complex state

Minimum needed: auth context (JWT tokens, current user, isAuthenticated, logout).

---

## Dev Server

```bash
npm install
npm run dev   # http://localhost:5173

npm run build     # production build → dist/
npm run preview   # preview built dist
npm run lint      # ESLint
```

Vite proxies are not yet configured — API calls will hit CORS. Either:
- Configure `vite.config.js` proxy: `'/api' → 'http://localhost:8080'`
- Or rely on Spring Boot's CORS config (currently wildcard — works in dev)
