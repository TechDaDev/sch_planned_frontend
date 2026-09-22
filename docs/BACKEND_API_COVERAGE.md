# Backend API v1.0.0 Coverage by Frontend Phase

Every major backend module is consumed by the frontend. This table exists to prove that
nothing in Backend API v1.0.0 was forgotten, not to reproduce the OpenAPI schema.

All backend traffic crosses the same-origin BFF (`/api/backend/...`), except the auth
endpoints, which are handled by dedicated route handlers.

---

## Authentication and identity

| Backend endpoint | Consumed by | Frontend surface |
| --- | --- | --- |
| `POST /api/auth/login/` | F0 | `POST /api/auth/login` |
| `POST /api/auth/refresh/` | F0 | server-side only, one retry per request |
| `GET /api/me/` | F0 | `GET /api/auth/session` |
| `GET /api/health/ready/` | F5 | `GET /api/health/ready` (readiness dependency) |

## F1 — Academic administration

| Backend resource | Consumed by |
| --- | --- |
| colleges | `/academic/colleges` |
| departments | `/academic/departments` |
| academic years | `/academic/academic-years` |
| semesters | `/academic/semesters` |
| study programs | `/academic/programs` |
| study stages | `/academic/stages` |
| student groups | `/academic/student-groups` |
| courses | `/academic/courses` |
| course offerings | `/academic/course-offerings` |
| teaching components | `/academic/teaching-components` |
| component/group links | `/academic/component-groups` |

## F2 — Resources and calendar

| Backend resource | Consumed by |
| --- | --- |
| instructor profiles | `/resources/instructors` |
| instructor sharing | `/resources/instructor-sharing` |
| instructor availability | `/resources/instructor-availability` |
| instructor preferences | `/resources/instructor-preferences` |
| teaching assignments | `/resources/teaching-assignments` |
| room types | `/resources/room-types` |
| room capabilities | `/resources/room-capabilities` |
| rooms | `/resources/rooms` |
| room sharing | `/resources/room-sharing` |
| room capability assignments | `/resources/room-capability-assignments` |
| room availability | `/resources/room-availability` |
| component room requirements | `/resources/room-requirements` |
| component capability requirements | `/resources/room-requirement-capabilities` |
| working days | `/resources/calendar/working-days` |
| time slots | `/resources/calendar/time-slots` |
| break periods | `/resources/calendar/breaks` |
| calendar exceptions | `/resources/calendar/exceptions` |

## F3 — Scheduling workspace

| Backend endpoint | Consumed by |
| --- | --- |
| `POST scheduling/validate` | `/scheduling/readiness` |
| `POST scheduling/generate` | `/scheduling/generate` (department preview) |
| `POST scheduling/generate-college` | `/scheduling/generate` (college preview) |
| `POST schedules/generate-department-draft` | `/scheduling/generate` (persist) |
| `POST schedules/generate-college-draft` | `/scheduling/generate` (persist) |
| `GET schedules` | `/scheduling/schedules` |
| `GET schedules/{id}` | `/scheduling/schedules/[id]` |
| `GET schedules/{id}/versions` | `/scheduling/schedules/[id]` |
| `GET schedule-versions/{id}` | `/scheduling/versions/[id]` |
| `GET schedule-versions/{id}/entries` | `/scheduling/versions/[id]`, compare |

## F4 — Operations, reporting, import and audit

| Backend endpoint | Consumed by |
| --- | --- |
| `POST schedule-versions/{id}/validate-manual-edit` | `/scheduling/versions/[id]/edit` |
| `POST schedule-versions/{id}/manual-edit` | `/scheduling/versions/[id]/edit` |
| `GET schedule-versions/{id}/workflow-validation` | `/scheduling/versions/[id]/workflow` |
| `POST schedule-versions/{id}/submit` | workflow page |
| `POST schedule-versions/{id}/review` | workflow page (college admin) |
| `POST schedule-versions/{id}/approve` | workflow page (college admin) |
| `POST schedule-versions/{id}/publish` | workflow page (college admin, college schedule) |
| `GET published-schedules/current` | `/published`, `/my-timetable` |
| `GET published-schedules/current/analytics` | `/reports/published` |
| `GET published-schedules/current/export/xlsx` | `/published`, `/reports/published` |
| `GET published-schedules/current/export/pdf` | `/published`, `/reports/published` |
| `GET schedule-versions/{id}/analytics` | `/reports/version/[id]` |
| `GET schedule-versions/{id}/export/xlsx` | `/reports/version/[id]` |
| `GET schedule-versions/{id}/export/pdf` | `/reports/version/[id]` |
| `GET imports/semester-plan/template` | `/imports/semester-plan` |
| `POST imports/semester-plan/validate` | `/imports/semester-plan` |
| `POST imports/semester-plan/apply` | `/imports/semester-plan` |
| `GET audit-events` | `/audit` |
| `GET audit-events/{id}` | `/audit/[id]` |

## F5 — Hardening (no new backend surface)

F5 adds no backend call. It adds the frontend's own health endpoints, hardens the existing
proxy, and verifies the whole surface above with request-level role journeys.

## Deliberately unused

| Backend capability | Reason |
| --- | --- |
| Hard delete endpoints | The accepted API exposes none; lifecycle is deactivation. |
| Logout/token blacklist | Not exposed by Backend API v1.0.0; logout is client-session termination. |
| Pagination | List endpoints are unpaginated; the frontend filters locally rather than inventing paging. |
