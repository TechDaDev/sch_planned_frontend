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
- Upstream paths are always addressed with the trailing slash Django defines.
  The browser-facing path is normalized into segments, so `/api/backend/colleges`
  becomes `/api/colleges/` upstream. Without that slash Django answers with an
  `APPEND_SLASH` redirect the proxy does not follow, and while `DEBUG` is enabled
  it refuses a `POST` outright — losing the request body. Every route in the
  accepted backend, including the router-generated ones, ends with `/`.

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

## Academic Administration (F1)

`/academic` is the administration workspace for the academic structure. It is
available to `COLLEGE_ADMIN` and `DEPARTMENT_ADMIN` only; schedulers, viewers and
instructors never receive these navigation entries and are refused if they open a
route directly.

### Academic routes

| Route | Records | Backend endpoint |
| ----- | ------- | ---------------- |
| `/academic` | Module overview (grouped links, no invented counts) | — |
| `/academic/colleges` | Colleges | `/api/backend/colleges/` |
| `/academic/departments` | Departments | `/api/backend/departments/` |
| `/academic/academic-years` | Academic years (e.g. 2026–2027) | `/api/backend/academic-years/` |
| `/academic/semesters` | First/second semester per year | `/api/backend/semesters/` |
| `/academic/programs` | Study programs | `/api/backend/programs/` |
| `/academic/stages` | Study stages | `/api/backend/stages/` |
| `/academic/student-groups` | Student groups and subgroups | `/api/backend/student-groups/` |
| `/academic/courses` | Course catalog | `/api/backend/courses/` |
| `/academic/course-offerings` | A course delivered in a semester | `/api/backend/course-offerings/` |
| `/academic/teaching-components` | Theory/practical parts with hours | `/api/backend/teaching-components/` |
| `/academic/component-groups` | Component ↔ student group links | `/api/backend/teaching-component-groups/` |

Every call goes through the F0 BFF proxy (`/api/backend/...`). No academic
component knows the backend host or a token.

### Role and write matrix

| Record | `COLLEGE_ADMIN` | `DEPARTMENT_ADMIN` |
| ------ | --------------- | ------------------ |
| College | create, update, activate/deactivate | read only |
| Academic year | create, update, activate/deactivate | read only |
| Semester | create, update, activate/deactivate | read only |
| Department | create, update every department | update its own department only |
| Study program | all departments | own department only |
| Study stage | all programs | own department only |
| Student group | all stages | own department only |
| Course | all departments | own department only; foreign joint courses read only |
| Course offering | all | own-managed offerings only; foreign offerings read only |
| Teaching component | all | components of offerings it manages only |
| Component group link | any component/group, including cross-department | only component **and** group inside its own department |

A `DEPARTMENT_ADMIN` with no department is restricted: the shell shows a clear
"No department is assigned to this account." state and no mutation control is
offered.

These rules are frontend usability only. Django remains the authorization
authority: the UI shows whatever the backend rejects, and out-of-scope records
answer 404 without revealing that they exist.

### Lifecycle: there are no deletes

The academic API intentionally has no hard delete (`DELETE` answers HTTP 405).
The UI therefore never renders a Delete/Trash/Remove action, and `src/lib/academic/api.ts`
exposes no delete helper. Records are retired with **Activate** / **Deactivate**
through `PATCH { "is_active": false }`, and deactivation always asks for
confirmation stating that the record is not deleted. `TeachingComponentGroup` has
no `is_active` field, so it offers no status action.

### Read/write representation split

Writes submit foreign keys as ids; reads always answer with compact nested
summaries (`department: { id, name, code }`, `semester: { id, number, academic_year }`,
...). Read models and write DTOs are therefore typed separately, and a form always
converts values at the payload boundary. Updates use `PATCH` so a partial edit
never has to resend required foreign keys (a department always needs a college).

### Joint teaching and read-only rows

A department-scoped user can legitimately see records it does not manage, because
its students attend a joint component. Those rows stay visible but read-only and
are labelled:

- **Joint** — a course, or a link, that involves the user's students;
- **External manager** — an offering or component managed by another department.

A component's or group's owning department is not part of the nested summaries, so
it is resolved from the already-loaded offerings, stages and programs instead of
being guessed. When a selector would create a cross-department write the backend
would reject, the option is not offered.

### Academic hierarchy model

```
College
 └─ Department
     └─ StudyProgram (UNDERGRADUATE | MASTER | PHD)
         └─ StudyStage (number >= 1)
             └─ StudentGroup (optional parent_group → subgroup in the same stage)
                 └─ linked to TeachingComponent
Course (owned by a department)
 └─ CourseOffering (semester + managing department + offering_code)
     └─ TeachingComponent (THEORY | PRACTICAL, weekly_hours, session_duration_hours)
         └─ TeachingComponentGroup → StudentGroup
```

A course offering's managing department must be the department that owns the
course, so the form derives and locks it instead of letting a mismatched pair be
submitted. `total_weekly_hours` (offering) and `sessions_per_week` (component) are
computed by the backend and only displayed.

Decimal hours are handled as exact scaled integers: inputs such as `1`, `1.5` and
`2.00` are submitted as backend-shaped decimal strings, and the client warns when
`weekly_hours / session_duration_hours` is not a whole number. Rounding is never
applied, and the backend remains authoritative.

### Form and error behaviour

All eleven entities share one list page and one form panel, so loading, empty,
error, search, status filter, capability checks and post-mutation refresh behave
identically. Shared behaviour:

- client-side search over name/code/offering code (no undocumented query
  parameters are sent to the backend);
- DRF field errors mapped beside the offending control, `non_field_errors` shown
  in the error summary, and the panel stays open with the user's input intact;
- 403/404/409/500 responses shown as safe messages — never a stack trace, SQL or
  an internal payload;
- tables scroll horizontally on small screens and drop secondary columns, forms
  stay usable at mobile width, every control is labelled and keyboard operable.


- `src/proxy.ts` (Next.js 16 renamed Middleware to Proxy) performs an optimistic
  cookie-**presence** redirect only, e.g. `/scheduling` → `/login?next=/scheduling`.
  It is never treated as authorization.
- Server-side session validation, the BFF and Django permissions are authoritative.
- `next` targets are restricted to safe internal paths; external URLs are rejected.
- Visiting `/login` with a valid session leads to `/dashboard` (no redirect loops).
- `/` immediately redirects to `/dashboard` or `/login` — there is no blank landing page.

## Resources and Calendar (F2)

`/resources` is the resource workspace the college schedules against: instructor
resources, room resources and the calendar configuration. It is available to
`COLLEGE_ADMIN`, `DEPARTMENT_ADMIN` and `SCHEDULER`. Viewers and instructors are
refused, including on direct navigation.

### Resource routes

| Route | Records | Backend endpoint |
| ----- | ------- | ---------------- |
| `/resources` | Module overview (grouped links) | — |
| `/resources/instructors` | Instructor profiles | `/api/backend/instructors/` |
| `/resources/instructor-sharing` | Instructor sharing grants | `/api/backend/instructor-department-access/` |
| `/resources/instructor-availability` | Hard availability windows | `/api/backend/instructor-availability/` |
| `/resources/instructor-preferences` | Soft preferences | `/api/backend/instructor-preferences/` |
| `/resources/teaching-assignments` | Component staffing | `/api/backend/teaching-assignments/` |
| `/resources/room-types` | Room type vocabulary | `/api/backend/room-types/` |
| `/resources/room-capabilities` | Room capability vocabulary | `/api/backend/room-capabilities/` |
| `/resources/rooms` | Rooms | `/api/backend/rooms/` |
| `/resources/room-sharing` | Room sharing grants | `/api/backend/room-department-access/` |
| `/resources/room-capability-assignments` | Room ↔ capability links | `/api/backend/room-capability-assignments/` |
| `/resources/room-availability` | Room availability windows | `/api/backend/room-availability/` |
| `/resources/room-requirements` | Component room requirements | `/api/backend/teaching-component-room-requirements/` |
| `/resources/room-requirement-capabilities` | Required capabilities | `/api/backend/teaching-component-capability-requirements/` |
| `/resources/calendar` | Calendar overview (grid vs exceptions) | — |
| `/resources/calendar/working-days` | Working days | `/api/backend/working-days/` |
| `/resources/calendar/time-slots` | Time slots | `/api/backend/time-slots/` |
| `/resources/calendar/breaks` | Break periods | `/api/backend/break-periods/` |
| `/resources/calendar/exceptions` | Calendar exceptions | `/api/backend/calendar-exceptions/` |

Every call goes through the F0 BFF proxy. The F2 layer reuses the same list page,
form panel, table, toast and error normalization as F1 rather than duplicating them.

### Role and write matrix

| Resource | `COLLEGE_ADMIN` | `DEPARTMENT_ADMIN` | `SCHEDULER` |
| -------- | --------------- | ------------------ | ----------- |
| Instructor profile | all | own department | read only |
| Instructor sharing grant | all | own instructors only, and only when another department can be named | read only |
| Instructor availability / preferences | all | own instructors | read only |
| Teaching assignment | all | components its department manages | read only |
| Room type / capability vocabulary | create and edit | read only | read only |
| Room | all | own department | read only |
| Room sharing grant | all | own rooms only | read only |
| Room capability assignment | all | own rooms | read only |
| Room availability | all | own rooms | read only |
| Teaching component room requirement | all | components its department manages | read only |
| Required capability | all | requirements it manages | read only |
| Working days / time slots / breaks | create and edit | read only | read only |
| Calendar exception | every scope | non-college scopes whose target it owns | read only |

Frontend checks are usability only. Django stays authoritative for ownership,
sharing, eligibility, window overlap, capacity and exception scoping, and its
errors are shown faithfully.

### Ownership, sharing and read-only rows

Instructors and rooms are department-owned with an explicit sharing scope:

- **Private** — only the owning department may schedule the resource. Existing
grants stay on file but are not effective, and are never deleted automatically.
- **Selected departments** — departments with an active grant may schedule it.
- **College-wide** — every active department may schedule it.

Rows carry a badge: **Owned**, **Shared**, **College-wide**, **External owner** or
**Read only**. A resource that is visible only because it teaches a joint course is
labelled read-only, never shared, so nobody concludes it can be scheduled.

Ownership is resolved from loaded collections rather than guessed: the nested
summaries deliberately omit the owning department of a stage, group, component or
room summary, so the screens join against the offerings, programs and rooms they
already load.

### Instructor account linking (backend limitation)

`InstructorProfileWriteSerializer` accepts an optional `user` id, but the accepted
backend exposes no administrative endpoint for listing eligible accounts. F2
therefore:

- never offers a free-form or guessed user id field;
- creates instructors with `user` omitted, and omits it on every update so an
existing link is preserved;
- displays the linked account read-only when the API returns one;
- explains the limitation in the UI.

### Hard availability versus soft preference

`InstructorAvailability` and `RoomAvailability` are **hard** recurring windows.
No row for a weekday means availability is not configured there — never that the
resource is free all day. `InstructorPreference` is **soft**: `PREFERRED` and
`AVOID` guide scheduling, and an `AVOID` window is explicitly not an unavailable
period. Both distinctions are stated in the forms.

Both window tables share the same client checks (`start < end`, semester and
weekday required); overlap detection stays on the backend, whose message is
displayed.

### Teaching assignments and room requirements

A teaching assignment staffs a component and is written by the department that
manages the component's offering. A component may hold at most one active primary
instructor; the role is labelled and the backend refusal is shown if a second one
is attempted — the UI never silently demotes the first. Instructor choices are
narrowed to resources that look eligible (own, college-wide, or granted), and the
server rechecks eligibility for every writer, including college administrators.

A component has at most one room requirement. `expected_student_count`,
`effective_minimum_capacity` and the required capability list are **derived by the
server** and displayed read-only. Room capability assignments and required
capabilities are relationship rows with no active flag: they are created or edited,
never deleted, and no delete action exists anywhere.

### Calendar: recurring grid versus dated exceptions

- **Recurring grid** — working days, time slots and breaks repeat weekly per
semester. Nothing auto-creates Sunday–Thursday rows. A slot must fit inside its
working day and must not overlap an active slot or break; durations may vary and
`duration_minutes` is derived. Narrowing a working day is rejected while active
children fall outside it.
- **Dated exceptions** — one date, full-day (no times at all) or partial-day
(both times), scoped to college, department, instructor, room or student group.
Only the target matching the selected scope is submitted. `INSTRUCTOR_ABSENCE` is
pinned to the instructor scope and `ROOM_CLOSURE` to the room scope, and the scope
is derived when such a type is chosen. When a semester has configured dates the
date is checked against them; a semester without dates imposes no client limit.

All times are recurring wall-clock values in the college week (Sunday = 0). No
timezone conversion is ever applied, and dates remain date-only.

### Lifecycle: still no deletes

The F2 endpoints inherit the same no-delete surface. Records with `is_active` use
**Activate** / **Deactivate** behind the same confirmation that states the record is
not deleted; relationship rows (room capability assignments, required
capabilities) offer create and edit only, and no remove action is rendered.

### Documented filters

F2 uses only the exact-match filters the backend publishes for each viewset
(`primary_department`, `sharing_scope`, `instructor`, `semester`, `room`,
`working_day`, `date`, `scope_type`, ...). Local text search stays client-side and
no undocumented parameter is ever sent.

### Resource tests

115 tests cover the 17 endpoint paths, the read/write DTO split, documented
filters, error preservation (including window overlap, ineligible instructor and
second primary instructor), the capability matrix, decimal-safe workload limits,
time-window validation, calendar scope/type pairing, full-day versus partial-day
exceptions and the read-only shared-resource UI.

## Scheduling Workspace (F3)

`/scheduling` is the operational workspace for validation, timetable generation
and the persisted draft history. It is the first phase that talks to the
solver-backed scheduling API.

### What this phase is and is not

F3 covers readiness validation, department and college preview generation,
generate-and-persist drafts, the schedule/version history, both timetable viewer
representations, snapshot rendering and version comparison. Everything the phase
renders is read-only except the two generation actions.

Explicitly **not** in F3, and left to F4:

```
manual schedule editing            drag-and-drop placement
move room/time by hand             submit / review / approve / publish
workflow validation                published timetable
analytics dashboards               XLSX / PDF export
semester-plan import               audit viewer
```

There is no drag handle, no "move session" control and no workflow button
anywhere in the module, and no client-side solver: the engine is authoritative,
and nothing is scheduled, repaired or moved in JavaScript.

### Readiness is not feasibility

`POST /api/scheduling/validate/` checks the **stored data** and returns `ready`,
`summary` and `issues`. `ready = true` means only that no blocking `ERROR` was
found; warnings never make a run unready. Validation does not place sessions,
resolve collisions, assign rooms, prove feasibility or subtract calendar
exceptions from the recurring weekly grid, so the UI says
"Configuration is ready for generation." and never "This timetable is feasible."

### Preview versus persisted draft — the critical distinction

| | Preview | Draft |
| --- | --- | --- |
| Endpoint | `POST /api/scheduling/generate/`, `POST /api/scheduling/generate-college/` | `POST /api/schedules/generate-department-draft/`, `POST /api/schedules/generate-college-draft/` |
| Writes | nothing (`persisted = false`) | a new immutable version |
| Client supplies | semester, department, time limit | semester, department, time limit, notes |

**Generate & Save Draft reruns generation server-side; it does not persist a
client preview.** The draft endpoint runs the whole validated pipeline again and
stores that result. The client never sends placements, a status or a version
number — the request body is rejected by the backend if it contains them, and no
code path in `src/lib/scheduling/` attaches a preview payload to a draft request.
Regenerating the same semester and department appends V2, then V3, to the same
logical schedule; it never overwrites an existing version, and the version number
always comes from the response.

### Department versus college generation

| Operation | Endpoint | Who | Limits |
| --- | --- | --- | --- |
| Department validation | `scheduling/validate` (`DEPARTMENT`) | college admin any department, dept admin/scheduler own | — |
| College validation | `scheduling/validate` (`COLLEGE`) | college admin only | — |
| Department preview | `scheduling/generate` | as department validation | 1–120 s, default 30 |
| College preview | `scheduling/generate-college` | college admin only | 1–300 s, default 60 |
| Department draft | `schedules/generate-department-draft` | as department validation | 1–120 s, default 30 |
| College draft | `schedules/generate-college-draft` | college admin only | 1–300 s, default 60 |

A `COLLEGE` validation body omits `department`; a `DEPARTMENT` body requires it.
The college generation and college draft bodies never carry `department` or
`scope`, and the only solver input the UI exposes is `max_time_seconds` — the
seed, the worker count, solver logging and reservations are fixed server-side and
are never sent.

### Solver result semantics

| Status | Meaning shown to the user |
| --- | --- |
| `OPTIMAL` | A valid timetable was produced and proven optimal. |
| `FEASIBLE` | A valid timetable was produced; optimality was not proven. |
| `INFEASIBLE` | The solver proved that no timetable exists. |
| `MODEL_INVALID` | The solver model was invalid, so no timetable was produced. |
| `UNKNOWN` | The solve ended without a successful result. |

`FEASIBLE` is never displayed as `OPTIMAL`, and `INFEASIBLE` is never presented
as a server crash. No success percentage is invented: the backend streams no
progress, so the UI shows an active-run indicator, the scope and the semester
instead.

Generation outcomes are told apart, not flattened:

| Situation | Response | UI |
| --- | --- | --- |
| Not ready | 409 `PRE_SCHEDULING_VALIDATION_FAILED` | "Configuration not ready" + validation issues |
| No candidates | 409 `CANDIDATE_BUILD_FAILED` | "No placement candidates" + generation issues |
| Incomplete persistence | 409 `GENERATION_RESULT_INCOMPLETE` | "Generation result incomplete", nothing stored |
| Solver found nothing | 200 `generated: false` | "No timetable produced" (a completed run) |
| Malformed request | 400 | "Request invalid" + rejected fields |
| Out of scope / role denied | 403, 404 | "Permission denied" / "Not found" |

A 409 body is structured, so the normalized error keeps the raw payload and the
panel renders its `reason`, issues and diagnostics. Issue codes are always shown,
filterable by **Errors / Warnings / All**. `details` is rendered as primitive
key/value text only — backend data can never become markup.

### Timetable visualization

The same viewer renders a preview and a stored version, from one normalized
`TimetableSession` produced by either `sessionFromPlacement` or
`sessionFromEntry`. `source` keeps `PREVIEW` and `PERSISTED` apart so a preview is
never labelled as a stored version.

- **Grid** — the college week, Sunday to Thursday, never Monday-first. Each
event is positioned by its real start and end times, so periods of different
durations are drawn at their true size and a period is never assumed to be one
hour. A multi-period session is one event spanning its whole interval, not one
card per slot.
- **List** — the same sessions as day/time/course/component/room/instructors/
groups text, plus a managing-department column on a college timetable. This is
the accessible representation, and both views are one click apart.
- **Filters** — department, course, instructor, student group, room and weekday,
built from the sessions actually present. Filtering is presentation only: the
preview endpoints accept no filters and a stored version is immutable, so no
filter ever becomes a query parameter or a request.
- A joint session serving several student groups stays **one** session listing
every group; it is never duplicated per group or per department.

### Schedule and version immutability

Schedules and versions are history, so `src/lib/scheduling/api.ts` exposes no
update or delete helper for either, and the UI renders no such control. The list
shows scope, semester, department (`College-wide` for a college schedule, never a
fabricated department), version count, latest version number and status, and the
timestamps; the detail page shows the identity, the newest version and the
publication pointer when the backend reports one; the version page shows
provenance, solver metadata and workflow metadata as read-only values. Workflow
states (`DRAFT`, `SUBMITTED`, `REVIEWED`, `APPROVED`, `PUBLISHED`) and sources
(`DEPARTMENT_GENERATION`, `COLLEGE_GENERATION`, `MANUAL_EDIT`) are all displayed
correctly even though F3 cannot create them.

### Snapshot rendering

A persisted `ScheduleEntry` stores its own labels. The version view renders those
stored values, so renaming a course, room, department, instructor or student group
afterwards does not rewrite what a stored version shows. Live academic and
resource collections are used for selectors and filters only, never to replace a
version's snapshot.

### Version comparison

Comparison is offered between two versions of the **same** logical schedule,
selected from that schedule's history, because sessions of different schedules are
unrelated and pairing them on `session_id` would report nonsense (the comparison
also throws if the two sides do not belong to one schedule). Sessions are paired on
`session_id` and classified as `UNCHANGED`, `TIME_CHANGED`, `ROOM_CHANGED`,
`TIME_AND_ROOM_CHANGED`, `CONTENT_CHANGED`, `PENALTY_CHANGED`, `ADDED` or
`REMOVED`. A changed `candidate_id` alone is not a physical difference. Each row
shows **Before** and **After** from the two versions' own snapshots, with no
mutation action.

### Role matrix

| Role | Validate | Preview | Draft | History / compare |
| --- | --- | --- | --- | --- |
| `COLLEGE_ADMIN` | college + any department | department + college | department + college | all visible schedules |
| `DEPARTMENT_ADMIN` | own department | own department | own department | own department |
| `SCHEDULER` | own department | own department | own department | own department |
| `VIEWER` | — | — | — | own department, read-only |
| `INSTRUCTOR` | — | — | — | — |

A department-scoped account with `department = null` fails closed everywhere: it
is never treated as a college administrator and never falls back to "all
departments". A scoped role's department is shown as a fixed value rather than a
selector, so a foreign department cannot be chosen even transiently.

### Scheduling routes

| Route | Purpose |
| --- | --- |
| `/scheduling` | Role-appropriate actions (no invented statistics) |
| `/scheduling/readiness` | Validate readiness for a semester and scope |
| `/scheduling/generate` | Preview a timetable and generate/store a draft |
| `/scheduling/schedules` | Persisted schedules with filters |
| `/scheduling/schedules/[id]` | Schedule identity, newest version, history, comparison |
| `/scheduling/versions/[id]` | Version provenance, solver metadata, stored timetable |
| `/scheduling/compare` | Compare two versions of one schedule |

### Scheduling tests

154 tests cover the ten endpoint paths and their exact bodies (including
"no unsupported solver field" and "no placement in a draft request"), the full
permission matrix including departmentless accounts, the readiness payload rules,
preview outcomes (`generated: true`, `generated: false`, both 409 reasons),
solver-status wording, draft persistence and version numbering, snapshot entry
rendering against a renamed live course, the eight comparison classes, the
same-schedule guard, grid ordering and variable durations, the accessible list,
the filters and the absence of any drag or workflow affordance.

## Schedule Operations, Publication, Reporting, Import and Audit (F4)

F4 makes a stored schedule usable: a draft can be edited and validated, moved
through the review workflow, published as the official timetable, analysed,
exported, initialized from a teaching-plan workbook and audited. Every one of
those is a backend operation reached through the F0 BFF; nothing is computed in
the browser.

### What this phase is and is not

- **Is** validated manual editing of placements, the four-step schedule workflow,
the official published timetable, instructor My Timetable, version and published
analytics, Excel and PDF exports, semester teaching-plan import and a read-only
audit viewer.
- **Is not** a drag-and-drop editor, a generic status editor, a client-side report
engine, a spreadsheet parser or a second authorization layer. The backend
re-validates every proposal, and Django stays the authority; the UI only decides
what to offer.

### F4 routes

| Route | Purpose |
| --- | --- |
| `/scheduling/versions/[id]/edit` | Validated manual editing of one draft version |
| `/scheduling/versions/[id]/workflow` | Workflow stage, validation report and the single next action |
| `/published` | Official published timetable of a semester, plus its exports |
| `/my-timetable` | The instructor's own published sessions |
| `/reports` | Reports landing: the two report families |
| `/reports/version/[id]` | Analytics and exports of one exact stored version |
| `/reports/published` | Analytics and exports of the current publication |
| `/imports/semester-plan` | Template download, workbook validation and apply |
| `/audit` | Audit trail with the documented filters |
| `/audit/[id]` | One audit event, including its metadata |

### Manual editing is a batch, not a move

The backend validates the whole `changes` list as **one final timetable state**.
The page therefore builds a pending batch: select a session, tick the periods of
one weekday, choose a room (`keep`, `none` or a room), add it, inspect the whole
batch, then validate and apply. A swap is two changes in one proposal. Nothing is
applied per move.

Only placement moves. `entry_id`, `time_slot_ids` and `room_id` are the whole
request shape, so the course, offering, component, instructors, student groups,
session ordinal and every snapshot value cannot be edited by construction: there
is no field for them.

Any edit to the proposal — a period, a room, a pending row or the notes — drops a
previous validation, so **Apply validated proposal** stays disabled until the
server has seen the current batch. A `200` with `valid: false` is a normal result
and is rendered as such; a `409` refusal
(`MANUAL_EDIT_VALIDATION_FAILED`, `BASE_VERSION_NOT_DRAFT`, `STALE_BASE_VERSION`)
is rendered with its reason, its help text and its issue list, and the batch is
cleared so nothing is resubmitted blindly. Applying stores a **new immutable
`MANUAL_EDIT` version**; the edited version is never modified.

Editing is offered only for the newest `DRAFT` version of a schedule the caller
manages. An unknown status, scope or latest-state fails closed.

### Workflow: four explicit steps, one at a time

The state machine is forward-only:

```
DRAFT -> SUBMITTED -> REVIEWED -> APPROVED -> PUBLISHED
```

Each transition is its own endpoint (`submit`, `review`, `approve`, `publish`)
with an **empty body**: the stage comes from the URL, the actor from the session
and the timestamp from the server. No status, actor, timestamp or
published-version pointer is ever sent, there is no backward transition and no
combined action. Submitting, reviewing, approving and publishing are therefore
four separate confirmations, and the page never chains one into the next: after a
successful call it reloads the version, the history and the validation and offers
the next single action.

- Submit: the newest draft of a schedule in scope (college administrator,
department administrator, scheduler).
- Review and Approve: a college administrator only, so a department administrator
cannot review its own submission.
- Publish: a college administrator on an APPROVED **college-wide** version. A
department schedule can be approved and stops there; the publish control is not
offered for it, which the UI states in words rather than failing on submit.

Every confirmation names the schedule scope, the semester, the version number and
the action. A refusal (409) is shown with its reason and help text, and a stale or
wrong-stage refusal is stated as "reload before acting again" rather than retried.

**Workflow validation** is a read: it measures the stored version against **today's
configuration**, so a version that was valid when it was created can be reported as
blocked later, because components, assignments, group links, room requirements,
sharing, availability and the time grid may have changed since. Stored snapshots
keep history readable; they do not keep a timetable valid forever.

### Publication pointer versus PUBLISHED status

Several versions may carry the `PUBLISHED` status over time. The
**published-version pointer** decides which one is official right now, and only
the pointer is read: the official timetable comes from
`published-schedules/current?semester=`, never from a `status=PUBLISHED` query and
never from a draft. A semester without a publication answers `404`, which is
rendered as an explicit empty state ("A draft is not a publication") rather than
falling back to anything.

The official timetable renders the version's **own snapshot columns**, so renaming
a live course, room, department, instructor or group does not rewrite what was
published. A newer draft cannot replace it.

`/my-timetable` reads the same endpoint with an explicit instructor scope and no
export or report controls. An instructor never sees a department, room or
group-level view of the semester.

### Analytics

Two endpoints, one report shape: the analytics of **one exact stored version**
(any status) and the analytics of the **current publication**. Both are computed
server-side; nothing is joined from live academic or resource data, and every
descriptive value is a snapshot reference the response carried.

- The summary block reports counts, minutes and hours. Scheduled minutes are the
authoritative integer figure; hours are derived from them.
- **Department scope** keeps `managed` (this department owns the teaching) and
`participating` (joint sessions managed elsewhere that its groups attend) as
separate figures. They are never added into one local load.
- Instructor workload merges a shared instructor into **one** row, with the
department codes they teach for.
- **Room utilization** is the one figure measured against **current**
configuration: the stored occupancy of the version divided by today's
availability. When today's grid offers no denominator, the cell says
"Current availability denominator unavailable" instead of showing `0%`. A
percentage above 100 is reported above 100 and is never clamped, with a badge and
a notice explaining that historical occupancy exceeds current availability.
- There is **no composite score**: the backend computes none, and inventing one
would be a fabricated metric. The quality block is a set of interpretable figures
with the weekday and start-hour distributions shown as bars **and** as numbers.

### Exports

The workbook and the PDF are produced by the backend and streamed through the F0
proxy as bytes, preserving `Content-Type` and `Content-Disposition`. Nothing is
rebuilt in JavaScript: a client-side reimplementation would be a different
document. The browser never attaches a token to a download.

Failures are classified rather than collapsed: `403` (your role may not download
this), `404` (not available to your account), PDF `503` (the server could not
resolve a Unicode-capable font, with the note that the Excel export is
unaffected), other `503`, and an aborted request. The saved filename prefers the
backend's own `Content-Disposition` name and falls back to a documented name per
export kind. A repeated click while a download is being prepared is disabled.

### Semester teaching-plan import

The import is **create-only** and target-scoped: the department and semester come
from the form, never from the workbook, so a spreadsheet cannot choose where it
lands. The workbook crosses the proxy as `multipart/form-data`; it is never
converted to base64 JSON.

The flow is validate-then-apply. Validation reports sheets, rows, errors and
warnings with their **sheet, row and column** so the workbook can be fixed in the
right place. Warnings never block an apply; errors do. Changing the file, the
department or the semester discards the previous result, and the normal apply
stays disabled until the workbook has been validated for the current selection.

Apply **re-reads and fully re-validates** the workbook on the server, so the
displayed result is guidance and never authority, and no validation token is sent
because none exists. A refusal (`400`) is rendered with its structured issues.
The success card lists the eight created record types and any warnings. The import
creates semester teaching-plan setup only: it does not import placements, does not
overwrite existing records and does not create instructors or rooms.

### Audit viewer

The trail is append-only and read-only from the client: there is no create, update
or delete helper for an audit event anywhere in the layer, and the UI offers no
write control. It covers the eight documented actions, and only the eight
documented filters are ever sent — they narrow the authorized scope and can never
widen it.

Actor identity comes from the event's own snapshot columns (`username_snapshot`,
`role_snapshot`), not from the current account, so the trail still reads correctly
after a rename or a removal; a removed account is stated as such while its
recorded identity stays readable. Metadata is rendered as text: only primitives
become text, a nested value becomes bounded JSON, and a value is never interpreted
as markup. College-wide operations store no department, so a department
administrator never sees them, and an event outside the caller's scope answers as
not found.

### F4 role matrix

| Capability | College admin | Department admin | Scheduler | Viewer | Instructor |
| --- | --- | --- | --- | --- | --- |
| Manual edit a newest draft | any schedule in scope | own department | own department | — | — |
| Submit a version | any schedule | own department | own department | — | — |
| Review / approve | yes | — | — | — | — |
| Publish (college schedule only) | yes | — | — | — | — |
| Official timetable | yes | yes | yes | yes | yes |
| My Timetable | — | — | — | — | yes |
| Version analytics and its export | yes | yes | yes | yes | — |
| Published analytics and its export | yes | yes | yes | yes | — |
| Semester plan import | chooses the department | own department only | — | — | — |
| Audit trail | yes | own department | — | — | — |

A department-scoped role without an assigned department fails closed on every one
of these instead of falling back to "all departments".

### F4 tests

257 tests were added for F4 (728 in 42 files in total), covering: the endpoint
paths and exact bodies of the manual-edit, workflow, publication, analytics, export,
import and audit calls; the four-step state machine and its refusal copy; the
permission matrix for every new capability; proposal building, meaningfulness and
fingerprints; slot grouping and selection guidance; room-utilization denominators,
never-clamped percentages and the absence of a composite score; export failure
classification and byte-preserving downloads; import file guards, multipart bodies,
validation currency and warning-versus-error handling; audit formatting, snapshot
actors and safe metadata rendering; and the UI behaviour of every F4 screen,
including single-action workflow confirmations, stale-validation gating, structured
refusals, restricted states and the empty "not published" state. F1–F3 regression
tests are kept intact and are never weakened to accommodate F4.

## Project structure

```
src/
  app/
    (public)/login/           unauthenticated layout + login page
    (app)/                    authenticated shell: dashboard, academic, resources,
                              scheduling, published, reports, imports, audit,
                              my-timetable, forbidden
      academic/               F1 academic administration routes (server pages)
      resources/              F2 resource and calendar routes (server pages)
      scheduling/             F3 readiness, generate, schedules, versions and
                              compare routes, plus the F4 manual-edit and
                              workflow routes (server pages)
      published/              F4 official timetable
      reports/                F4 reports landing, version report and published
                              report
      imports/                F4 semester teaching-plan import
      audit/                  F4 audit trail and event detail
    api/auth/{login,logout,session}/
    api/backend/[...path]/    BFF proxy
    error.tsx, not-found.tsx, loading.tsx, page.tsx
  components/
    academic/                 shared academic UI (resource page, data table, form
                              panel, screens/ for the eleven entities)
    resources/                F2 resource screens and calendar screens
    scheduling/               F3 timetable grid/list/filters, validation issues,
                              generation report, version comparison, screens/
                              plus F4 manual edit, workflow panel, published
                              timetable, analytics report, export buttons and
                              semester-plan import
    audit/                    F4 audit trail and event detail screens
    app-shell, auth, providers (session + toast), ui primitives
  lib/
    academic/                 types, api, permissions, forms, validation,
                              formatters, constants, collection hook
    resources/                instructor/room/calendar types, api, permissions,
                              forms, validation, formatters, calendar rules
    scheduling/               scheduling types, api, permissions, normalization,
                              comparison, outcome classification, formatters,
                              constants, single-record hook, plus F4 workflow
                              state machine, manual-edit proposal, analytics,
                              export and import helpers and audit formatting
    api/                      browser client + ApiError normalization + generic
                              CRUD helpers
    auth/                     cookies, backend calls, session resolution, types
    navigation/               navigation config + safe redirect helpers
    config/env.ts             server-only environment access
  proxy.ts                    optimistic route protection
  test/                       fetch mock, jsdom setup, academic + resource +
                              scheduling + F4 fixtures
```

## Frontend phase roadmap

| Phase | Scope |
| ----- | ----- |
| **F0** | Foundation, environment config, BFF auth (login/logout/session/refresh), application shell, role-aware navigation, protected routes, base UI states, dashboard, testing foundation, docs. |
| **F1** | Academic Administration: colleges, departments, academic years, semesters, study programs, stages, student groups, courses, course offerings, teaching components and component/group links, with capability-aware read/write UI and no hard deletes. |
| **F2** | Resources and Calendar Administration: instructor profiles, instructor sharing, hard availability, soft preferences, teaching assignments, room types and capabilities, rooms, room sharing, capability assignments, room availability, component room requirements and required capabilities, working days, time slots, breaks and dated calendar exceptions. |
| **F3** | Scheduling Workspace: readiness validation, department and college preview generation, generate-and-persist department and college drafts, persisted schedule list and detail, immutable version history, persisted version timetable view and version-to-version comparison. |
| **F4 (this branch)** | Schedule Operations, Publication, Reporting, Import and Audit: validated manual editing, the submit/review/approve/publish workflow, the official published timetable, instructor My Timetable, version and published analytics, Excel and PDF exports, semester teaching-plan import and the administrative audit viewer. |
| F5 | Deployment hardening, Content-Security-Policy, mobile integration. |

F0 intentionally ships no domain CRUD tables and no fake schedule data. F1 ships the
academic administration module, F2 the resource and calendar administration module,
F3 the scheduling workspace and F4 the schedule operations, publication, reporting,
import and audit module. Deployment hardening, a strict Content-Security-Policy and
the mobile integration remain in F5. No screen is populated with invented data: an
empty backend produces a real empty state, F3 draws no timetable until a preview is
solved or a version is stored, and F4 shows nothing until the backend answers.

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

The suite currently reports **728 tests in 42 files**, covering F0 (auth, proxy,
navigation, roles), F1 (academic administration), F2 (resources and calendar),
F3 (scheduling workspace) and F4 (operations, publication, reporting, import and
audit). F1–F3 regression tests are kept intact and are never weakened to
accommodate a later phase.

`npm ci` reports Node engine warnings on this machine (Node 22.22.1 installed;
Node 24 LTS is recommended and is what `engines` prefers). The warnings are
non-blocking while every gate above passes.
