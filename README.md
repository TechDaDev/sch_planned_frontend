# College Academic Schedule Planner — Frontend

Frontend for the College Academic Schedule Planner, an operational college scheduling
system. This repository currently contains **Frontend Phase F0**: project foundation,
BFF authentication, application shell and the testing/quality gate.

- Backend: `https://github.com/TechDaDev/sch_planned_backend.git` (Backend API v1.0.0)
- Backend development base URL: `http://127.0.0.1:8000`
- Frontend local URL: `http://localhost:3000`

## Stack

| Concern      | Choice                                                       |
| ------------ | ------------------------------------------------------------ |
| Framework    | Next.js `16.3.3` (App Router, Turbopack)                     |
| Runtime libs | React `19.3.0`, React DOM `19.3.0`                           |
| Language     | TypeScript `5.9.3` (strict)                                  |
| Styling      | Tailwind CSS `4.3.3` with design tokens in `globals.css`     |
| Icons        | `lucide-react`                                               |
| Lint         | ESLint `9` + `eslint-config-next`                            |
| Tests        | Vitest `5`, React Testing Library, `@testing-library/user-event`, `jsdom` |
| Package mgr  | npm with committed `package-lock.json`                       |

No component framework (Material UI / Ant Design) is used; F0 relies on React,
Tailwind and small local components.

### Node.js requirement

Node.js **24 LTS** is the recommended runtime. `package.json#engines` requires
`>=20.9.0`, which is what the current Next.js 16 toolchain supports.

## Install and run

```bash
npm ci                       # clean, lockfile-exact install
cp .env.example .env.local   # then adjust BACKEND_API_URL if needed
npm run dev                  # http://localhost:3000
```

The Django backend must be running separately for real sign-in
(`python manage.py runserver 127.0.0.1:8000` in the backend repository).

### Scripts

| Script                | Purpose                                  |
| --------------------- | ---------------------------------------- |
| `npm run dev`         | Development server                       |
| `npm run build`       | Production build                         |
| `npm start`           | Serve the production build               |
| `npm run lint`        | ESLint (no errors at handoff)            |
| `npm run typecheck`   | `tsc --noEmit`                           |
| `npm test`            | Vitest in watch mode                     |
| `npm run test:run`    | Vitest single run (unit tests only)      |

Unit tests never require a live Django server: backend `fetch` calls are mocked.

## Environment configuration

`.env.example` documents the only variable F0 needs:

```
BACKEND_API_URL=http://127.0.0.1:8000
```

- `BACKEND_API_URL` is **server-only**. It deliberately has no `NEXT_PUBLIC_`
  prefix, so the internal backend URL never reaches browser JavaScript.
- Only variables prefixed with `NEXT_PUBLIC_` are exposed to the client bundle.
  F0 has none, and no JWT, cookie secret or infrastructure URL may ever be added
  there.
- `.env.local` is git-ignored and must never be committed.

## Authentication architecture

The browser never sees a JWT. The Next.js application acts as a
Backend-for-Frontend (BFF):

```
Browser (React)
   │  same-origin fetch, no Authorization header
   ▼
Next.js Route Handlers  /api/auth/*  and  /api/backend/[...path]
   │  Authorization: Bearer <access>  (server-side only)
   ▼
Django REST API  http://127.0.0.1:8000
```

Tokens are stored **only** in HttpOnly cookies set by the Next.js server. They are
never written to `localStorage`, `sessionStorage`, `IndexedDB`, non-HttpOnly
cookies, or React state exposed to browser code.

### Cookie strategy

Centralized in `src/lib/auth/cookies.ts` (single source of truth for names and
options):

| Cookie       | Purpose        | Lifetime | Flags                              |
| ------------ | -------------- | -------- | ---------------------------------- |
| `sch_access` | Django access  | 30 min   | `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` in production |
| `sch_refresh`| Django refresh | 7 days   | `HttpOnly`, `SameSite=Lax`, `Path=/`, `Secure` in production |

### Route handlers

| Endpoint                  | Behavior |
| ------------------------- | -------- |
| `POST /api/auth/login`    | Validates the request shape, calls Django `/api/auth/login/`, stores both tokens as HttpOnly cookies, calls `/api/me/`, and returns **only** `{ user }`. Tokens, `Authorization` headers and raw backend errors are never returned. |
| `GET /api/auth/session`   | Reads the access cookie, calls `/api/me/`. If the access token is rejected and a refresh cookie exists, it refreshes **once**, updates the access cookie, and retries `/api/me/` **once**. Refresh failure clears both cookies and returns a controlled 401. No recursion. |
| `POST /api/auth/logout`   | Clears both auth cookies. Client-session termination only — the accepted backend exposes no token-blacklist/logout endpoint, so no Django logout API is invented. |
| `ALL /api/backend/[...path]` | Authenticated same-origin proxy to Django. |

### Generic backend proxy

`/api/backend/[...path]` is the only path future feature phases need for backend
data (`/api/backend/academics/...`), so no UI code ever attaches a JWT manually.

- The server reads the access cookie and sets `Authorization: Bearer <access>`.
- On backend `401` it refreshes **once**, updates the access cookie and retries the
  original request **once**. A second `401` is terminal.
- Request headers come from a small allowlist; `Authorization`, `Cookie`, `Host`
  and `X-Forwarded-*` from the browser are never forwarded as credentials.
- Destination URLs are always built on `BACKEND_API_URL`; traversal, encoded
  separators, scheme/host injection and origin mismatch are rejected.
- `auth/login/` and `auth/refresh/` are **blocked** (403) so a browser cannot use
  the generic proxy to obtain raw JWTs.
- The response is streamed, not JSON-parsed, and preserves `Content-Type` and
  `Content-Disposition`, so future XLSX/PDF/multipart endpoints work without
  re-architecting authentication.

### Browser API client

`src/lib/api/client.ts` calls same-origin `/api/backend/...` and supports
`GET/POST/PUT/PATCH/DELETE`, `FormData` uploads and binary/download responses.
Backend failures are normalized into:

```ts
type ApiError = {
  status: number
  code?: string
  detail: string
  requestId?: string
  fieldErrors?: Record<string, string[]>
}
```

DRF field errors are preserved; unknown payloads start as `unknown` and are
narrowed safely. Raw backend exceptions, stack traces, SQL and environment values
are never rendered to end users.

## Roles

Roles mirror the backend exactly (`accounts.models.UserRole`):

`COLLEGE_ADMIN`, `DEPARTMENT_ADMIN`, `SCHEDULER`, `VIEWER`, `INSTRUCTOR`

Roles such as `ADMIN`, `SUPER_ADMIN`, `TEACHER` or `STAFF` do not exist and are
never invented. An unrecognized role fails safely (empty navigation, no session)
rather than being mapped onto a privileged one.

Navigation visibility is defined once in `src/lib/navigation/navigation.ts`:

| Role | Visible modules |
| ---- | --------------- |
| `COLLEGE_ADMIN`    | Dashboard, Academic Setup, Resources, Scheduling, Reports, Audit |
| `DEPARTMENT_ADMIN` | Dashboard, Academic Setup, Resources, Scheduling, Reports, Audit |
| `SCHEDULER`        | Dashboard, Resources, Scheduling, Reports |
| `VIEWER`           | Dashboard, Scheduling, Reports |
| `INSTRUCTOR`       | Dashboard, My Timetable |

Frontend navigation is a usability affordance only — the backend remains the
authorization authority. Department-scoped roles with `department = null` get a
clear restricted state instead of a misleading view.

## Route protection

- `src/proxy.ts` (Next.js 16 renamed Middleware to Proxy) performs an optimistic
  cookie-**presence** redirect only, e.g. `/scheduling` → `/login?next=/scheduling`.
  It is never treated as authorization.
- Server-side session validation, the BFF and Django permissions are authoritative.
- `next` targets are restricted to safe internal paths; external URLs are rejected.
- Visiting `/login` with a valid session leads to `/dashboard` (no redirect loops).
- `/` immediately redirects to `/dashboard` or `/login` — there is no blank landing page.

## Project structure

```
src/
  app/
    (public)/login/           unauthenticated layout + login page
    (app)/                    authenticated shell: dashboard, academic, resources,
                              scheduling, reports, audit, my-timetable, forbidden
    api/auth/{login,logout,session}/
    api/backend/[...path]/    BFF proxy
    error.tsx, not-found.tsx, loading.tsx, page.tsx
  components/                 app-shell, auth, providers, small UI primitives
  lib/
    api/                      browser client + ApiError normalization
    auth/                     cookies, backend calls, session resolution, types
    navigation/               navigation config + safe redirect helpers
    config/env.ts             server-only environment access
  proxy.ts                    optimistic route protection
  test/                       fetch mock, jsdom setup
```

## Frontend phase roadmap

| Phase | Scope |
| ----- | ----- |
| **F0 (this branch)** | Foundation, environment config, BFF auth (login/logout/session/refresh), application shell, role-aware navigation, protected routes, base UI states, dashboard, testing foundation, docs. |
| F1 | Academic structure CRUD (colleges, departments, programs, stages, courses). |
| F2 | Resources and instructors CRUD, room and instructor management. |
| F3 | Calendar, schedule generation, manual timetable editing, workflow. |
| F4 | Reports, analytics, imports/exports (XLSX/PDF/multipart via the F0 proxy). |
| F5 | Deployment hardening, Content-Security-Policy, mobile integration. |

F0 intentionally ships no domain CRUD tables and no fake schedule data. Placeholder
module pages state that they arrive in a later phase.

## Security notes

- JWTs are intentionally never stored in browser storage or readable by JavaScript.
- Security headers applied in `next.config.ts`: `X-Content-Type-Options`,
  `Referrer-Policy`, `X-Frame-Options`, `Permissions-Policy`. A strict CSP is
  deliberately deferred to F5 so it can be built and tested with nonces.
- `npm audit` reports **0 vulnerabilities** at handoff.
- No deployment configuration (Railway/Docker/Procfile) is part of F0.

## Quality gate

Required before commit; all of the following pass:

```bash
npm ci
npm run lint
npm run typecheck
npm run test:run
npm run build
npm audit
```
