# Rental Car Booking

Production-grade car rental platform. Users search and book cars. Admins manage the fleet.

**Backend:** Spring Boot 3.2.5 + PostgreSQL + Redis + Kafka  
**Frontend:** React 19 + Vite 8 _(UI not yet built)_

---

## Onboarding a New Teammate

### Step 1 — Read the project context files

These files contain everything about how the project works, what's built, and what's missing.

| File | What's in it |
|------|-------------|
| `AGENTS.md` | Full project reference — stack, API routes, domain rules, architectural constraints |
| `.ai/decisions.md` | Why things are built the way they are (12 Architecture Decision Records) |
| `.ai/tasks.md` | What's already implemented `[x]` and what still needs building `[ ]` |
| `backend/CLAUDE.md` | Backend-specific patterns, caching rules, Kafka patterns, feature checklist |
| `frontend/CLAUDE.md` | Frontend API integration guide, booking UI flows, routing plan |

**Read `AGENTS.md` first.** It links to everything else.

---

### Step 2 — Tell your AI model to read the context

Different tools load context differently. Pick your tool below.

---

#### Claude Code (recommended)

`CLAUDE.md` is auto-loaded every session. No setup needed.

```bash
claude
# Context is already loaded. Start working.
```

---

#### Cursor

Add a `.cursorrules` file at repo root:

```bash
cp AGENTS.md .cursorrules
```

Cursor reads `.cursorrules` automatically on every session.

---

#### Windsurf

```bash
cp AGENTS.md .windsurfrules
```

Windsurf reads `.windsurfrules` automatically.

---

#### GitHub Copilot (VS Code)

Copilot does not auto-read files. Use workspace context:

1. Open `AGENTS.md` in the editor
2. In Copilot Chat, type:

```
@workspace Read AGENTS.md first, then help me with: [your task]
```

---

#### OpenAI ChatGPT / Codex

Paste the contents of `AGENTS.md` into the system prompt or at the top of your first message:

```
[paste contents of AGENTS.md]

Now help me with: [your task]
```

---

#### Gemini Code Assist

Same as ChatGPT — no auto-read. Attach or paste `AGENTS.md` at the start of the conversation.

---

### Step 3 — Before starting any task

1. Check `.ai/tasks.md` — is this feature already tracked?
2. Check `.ai/decisions.md` — does an ADR cover this area?
3. Do the work
4. Update `.ai/tasks.md` — mark done or add a new item

---

## Running Locally

### Prerequisites

- Java 21, Maven 3.9+
- PostgreSQL (`rentalcardb` database, user `vidhan` / password `vidhan`)
- Redis on `localhost:6379`
- Kafka on `localhost:9092`

### Backend

```bash
cd backend
mvn spring-boot:run
```

- API: http://localhost:8080
- Swagger UI: http://localhost:8080/swagger-ui.html
- Health: http://localhost:8080/actuator/health

### Frontend

```bash
cd frontend
npm install
npm run dev
```

- Dev server: http://localhost:5173

### Seed admin credentials

```
Username : admin
Email    : admin@rentalcar.com
Password : Admin@123
```

---

## What's Built vs What's Missing

See `.ai/tasks.md` for the full list. Short version:

**Done:** Full backend — auth, car search, booking lifecycle, admin panel, audit logging, Redis caching, Kafka events, scheduled jobs, Swagger docs.

**Not done:** Entire frontend UI, Kafka consumers (notifications, payments), tests, Docker Compose.
