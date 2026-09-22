# Final Frontend Architecture

College Academic Schedule Planner — frontend release candidate **v1.0.0**.
Backend contract: **Backend API v1.0.0** (Django REST Framework, SimpleJWT).

This document describes the architecture as built. It is written for the release
review, so it states ownership and boundaries of the whole frontend after F0–F5.

---

## 1. Shape of the system

```
Browser UI (React, same-origin only)
        |
        v
Next.js 16 App Router  —  same-origin BFF
        |                     owns the JWT cookies
        |                     owns the Authorization header
        v
Django REST API (Backend API v1.0.0)
        |
        v
Backend services and database
```

Dependency direction is one-way. The browser never talks to Django, never holds a JWT
and never learns the backend host. Every backend call is made by a Next.js route handler
on the server.

## 2. Runtime

| Item | Value |
| --- | --- |
| Framework | Next.js 16.3.3 (App Router, Turbopack build) |
| UI | React 19.3.0, React DOM 19.3.0 |
| Language | TypeScript 5.9.3, strict |
| Styling | Tailwind CSS 4.3.3, CSS-variable design tokens |
| Tests | Vitest 5.0.1, Testing Library, jsdom for UI tests |
| Lint | ESLint 9 with `eslint-config-next` |
| Production runtime target | Node 24 LTS (`.nvmrc`); Next.js itself requires >= 20.9 |

## 3. Route groups

| Group | Purpose |
| --- | --- |
| `src/app/(public)` | Unauthenticated surface: `/login`. |
| `src/app/(app)` | Authenticated shell: dashboard and every product module. |
| `src/app/api/auth` | BFF session endpoints: `login`, `logout`, `session`. |
| `src/app/api/backend` | The generic authenticated proxy to Django. |
| `src/app/api/health` | `live` and `ready` probe endpoints. |

`src/proxy.ts` (Next 16's renamed Middleware) performs an optimistic cookie-presence
redirect for the protected prefixes. It is not authorization: the shell, the route
handlers and Django decide.

## 4. Authentication and session architecture

- `POST /api/auth/login` exchanges credentials with Django, stores both JWTs in
  **HttpOnly** cookies and returns only safe identity data.
- `GET /api/auth/session` restores the session: a rejected access token triggers
  **exactly one** refresh attempt and one retry. A rejected refresh clears both cookies
  and reports an expired session; an unreachable backend reports a temporary outage and
  deliberately leaves the cookies alone, so an outage never signs a user out.
- `POST /api/auth/logout` clears both cookies. The backend exposes no token blacklist,
  so logout is client-session termination.
- Cookie policy: `HttpOnly`, `Secure` in production, `SameSite=Lax`, `Path=/`, 30-minute
  access token and 7-day refresh token. Deletion cookies carry matching attributes.
- No token is ever stored in `localStorage`, `sessionStorage`, `IndexedDB`, a readable
  cookie or React state; a source scan enforces this.

## 5. Same-origin BFF proxy

`ALL /api/backend/[...path]` forwards a browser request to Django.

- Request headers are allowlisted (`content-type`, `accept`, `accept-language`,
  `if-none-match`). `Authorization` and `Cookie` are set by the server only; `Host`,
  `X-Forwarded-*` and hop-by-hop headers are never forwarded.
- `auth/login` and `auth/refresh` are refused through the proxy so tokens can only be
  obtained by the dedicated handlers.
- Path traversal and external scheme or host injection are rejected before any network
  call.
- One refresh retry, never more. A second `401` is terminal for that request.
- Binary responses keep `Content-Type`, `Content-Disposition` and their bytes;
  `multipart/form-data` bodies are streamed unchanged, so the workbook never becomes
  base64 JSON.
- Every session or data response is `Cache-Control: no-store`.
- Request timeout policy is **per endpoint**: solver-backed generation and draft
  persistence get 15 minutes, everything else 30 seconds, and readiness probes 3 seconds.
  Every bound is finite.

## 6. Same-origin mutation guard

State-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) on `/api/auth/*` and
`/api/backend/*` pass `src/lib/http/same-origin.ts` before anything else happens:

- `Sec-Fetch-Site: cross-site` is rejected with `403`. The header is set by the browser
  and page script cannot forge it.
- When `Origin` is present, its host must match the host the request was delivered to
  (the request URL host or the `Host` header). The scheme is not compared, because TLS
  termination changes it. `X-Forwarded-Host` and `X-Forwarded-Proto` are never consulted.
- A request with neither header remains allowed, so scripts, health checks and
  server-side tests still work. Such a client cannot be tricked into attaching a user's
  cookies, which is what the guard protects against.
- `GET` and `HEAD` are never affected.
- A rejected request is never forwarded to Django, and nothing about it is logged.

## 7. Role architecture

Five roles: `COLLEGE_ADMIN`, `DEPARTMENT_ADMIN`, `SCHEDULER`, `VIEWER`, `INSTRUCTOR`.
Unknown roles receive no navigation and no capabilities.

Three independent layers agree on the same matrix:

1. **Navigation** (`src/lib/navigation/navigation.ts`) decides what a role sees.
2. **Capabilities** (`src/lib/academic/permissions.ts`,
   `src/lib/resources/permissions.ts`, `src/lib/scheduling/permissions.ts`) decide what a
   screen offers.
3. **Django** decides what actually happens. The frontend is a usability layer; every
   refusal from the backend is displayed rather than hidden.

A department-scoped role with no department fails closed everywhere instead of falling
back to college-wide data.

## 8. Product modules

### 8.1 Academic administration (F1)
Eleven entities from colleges down to component/group links. Capability-aware read/write
UI, lifecycle by deactivation rather than deletion, separate read and write
representations, and joint-teaching rows rendered read-only.

### 8.2 Resources and calendar (F2)
Instructor profiles and sharing, hard availability versus soft preference, teaching
assignments, room types and capabilities, rooms and sharing, room availability,
component room requirements, working days, time slots, breaks and dated exceptions.
Owned rows are editable; shared foreign rows are readable only.

### 8.3 Scheduling workspace (F3)
Readiness validation, department and college preview generation, draft persistence,
persisted schedule history, immutable versions, stored timetable rendering from the
version's own snapshots, and version comparison across eight difference classes.

### 8.4 Manual editing (F4)
Validated editing of placements in a draft. The proposal is a **batch** that the backend
validates as one final timetable state, which is what makes a swap possible. The request
shape is `entry_id`, `time_slot_ids` and `room_id` only, so content cannot be edited by
construction. Applying stores a new immutable `MANUAL_EDIT` version. Any change to the
proposal invalidates a previous validation, and a `409` refusal is rendered with its
reason, help text and issue list. A role that may not edit gets a fully readable page
with every control inert.

### 8.5 Workflow and publication (F4)
Forward-only `DRAFT → SUBMITTED → REVIEWED → APPROVED → PUBLISHED`, one endpoint per step
with an empty body. Review, approve and publish are college-administrator actions; only
an approved **college-wide** schedule can be published. A transition is offered only once
the workflow validation has confirmed the stored version can still advance, so the panel
never shows `Blocked` next to a live action.

### 8.6 Official timetable (F4)
Reads the schedule's **published-version pointer**, never a `status=PUBLISHED` query and
never a draft. A semester without a publication is an explicit empty state. Entries render
from the stored snapshots, so renaming live data cannot rewrite what was published.
`/my-timetable` uses the same endpoint with an instructor scope and no exports.

### 8.7 Analytics and export (F4)
Analytics of one exact version and of the current publication. Department scope keeps
`managed` and `participating` apart; room utilization is measured against **today's**
availability, states a missing denominator in words and is never clamped above 100; there
is no composite score. Excel and PDF exports are produced by the backend and streamed as
bytes; download filenames are sanitized before becoming browser download names.

### 8.8 Semester plan import (F4)
Create-only and target-scoped: the department and semester come from the form, never from
the workbook. Validate-then-apply, with issues positioned by sheet, row and column.
Warnings never block; errors do. Apply re-validates fully on the server.

### 8.9 Audit viewer (F4)
Read-only trail over eight actions with the eight documented filters. Actor identity comes
from the event-time snapshot, so the trail still reads correctly after a rename or a
removal. Metadata is rendered as text and is never interpreted as markup.

## 9. Error and security boundaries

- `global-error.tsx` catches failures above the shell and renders its own document;
  `error.tsx` catches route failures inside it. Both offer retry and a way to the
  dashboard, and neither shows a stack trace, an exception message or a digest's contents.
- The shell distinguishes `401` (session) from `503` (outage): only a `401` sends the user
  to login, and an outage keeps the cookies intact.
- `403` means authenticated but forbidden and never triggers a login redirect. `404` for an
  out-of-scope object stays a `404`, so scope is not revealed. Structured `409` refusals
  stay structured through the proxy.
- A production configuration problem fails closed: `BACKEND_API_URL` must be set and must
  be an absolute `http(s)` URL with a host, no embedded credentials and no fragment. A
  failure answers a controlled `503` and is logged server-side by variable name only —
  never with its value, a token or a filesystem path.
- The CSP is static (`'unsafe-inline'` for scripts and styles, never `'unsafe-eval'` in
  production) so the statically optimized build is preserved. `connect-src 'self'` is
  sufficient because all traffic is same-origin.

## 10. Performance posture

- No production page imports a test fixture or helper; a scan enforces it.
- List endpoints are consumed as they are; large lists rely on local filtering and stable
  rendering rather than invented pagination.
- Loaders are memoized per screen so a filter change does not refetch, and mutations are
  single-submission: one confirmation, one request.
- `productionBrowserSourceMaps` is disabled.

## 11. Health endpoints

| Endpoint | Meaning |
| --- | --- |
| `GET /api/health/live` | The process is running. Checks nothing else and is safe during an outage. |
| `GET /api/health/ready` | This frontend **and** its backend dependency can serve traffic. Calls the backend's `/api/health/ready/` server-to-server. |

Both are public, both are `no-store`, and neither reveals a host, a path or a version. See
`docs/DEPLOYMENT_READINESS.md` for the operational reading of each status code.

## 12. Accessibility and responsive posture

No automated accessibility runner (axe, pa11y or similar) was added. The reason is
deliberate: introducing a new test dependency and its transitive tree at release-candidate
time would change the locked dependency graph that the rest of this phase was verified
against, for a signal that the semantic and interaction tests already cover for the
screens that exist. The behaviour is therefore asserted by tests rather than by a
third-party scan, and this choice is recorded here rather than left implicit.

What the application provides today, each item verifiable in the source:

| Area | Behaviour |
| --- | --- |
| Landmarks | A skip link (`Skip to main content`) targets `<main id="main-content">`; primary navigation is `<nav aria-label="Main navigation">`; the active item carries `aria-current="page"`. |
| Mobile navigation | The drawer is `role="dialog"`, `aria-modal="true"`, `aria-label="Main navigation"`; the trigger is labelled and carries `aria-expanded` and `aria-controls="app-navigation-drawer"`; `Escape` and the overlay close it. |
| Confirmation dialogs | `role="alertdialog"` with an accessible name and description, focus moved inside on open, focus on the safe action for a destructive confirmation, `Escape` cancels, `Tab`/`Shift+Tab` stay inside, focus returns to the opening control. |
| Status | Lifecycle and access badges carry a text label, so state is never conveyed by colour alone; read-only row annotations add a screen-reader-only prefix. |
| Dense data | Every wide table and grid sits in an `overflow-x-auto` container, so no column becomes unreachable at narrow widths. |
| Timetable | The grid is supplemented by a list or table representation of the same data, reachable without interpreting a visual grid. |
| Motion | The only animations are a spinner and a skeleton pulse; there are no animated layout or position transitions to reduce. |

Responsive behaviour is expressed with Tailwind breakpoints on the shell (sidebar hidden
below `lg`, drawer above), on page padding, and on grid density; the timetable grid
degrades to horizontal scrolling rather than to hidden content.
