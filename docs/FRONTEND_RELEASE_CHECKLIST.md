# Frontend Release Checklist

Frontend **v1.0.0** release candidate against **Backend API v1.0.0**.
Run every step from the repository root on the release commit.

---

## 1. Runtime

| Item | Requirement |
| --- | --- |
| Node | **Node 24 LTS** is the production target (`.nvmrc`). Next.js 16 itself requires >= 20.9. |
| npm | The version recorded in the release report. |
| Install | `npm ci` — exactly the lockfile, no `npm install`. |

Passing the gate on Node 22 is acceptable evidence that the code is compatible; it is not
a substitute for running it once on Node 24 in the deployment environment.

## 2. Gate commands

```bash
npm ci
npm run lint
npm run typecheck
npm run test:run
npm run build
npm run smoke:production
npm audit
```

| Command | Expected result |
| --- | --- |
| `npm run lint` | No errors and no warnings. |
| `npm run typecheck` | `tsc --noEmit` clean, strict mode. |
| `npm run test:run` | The full suite passes; the count is recorded in the release report. |
| `npm run build` | Production build succeeds and the route list is unchanged in kind: the product routes stay statically optimized, only dynamic routes are server-rendered. |
| `npm run smoke:production` | All smoke assertions pass against the real built server. Requires `npm run build` first. |
| `npm audit` | No HIGH or CRITICAL production vulnerability. Never use `npm audit fix --force` to hide one. |

`npm run smoke:production` starts `next start` on a controlled local port with a stub
backend, exercises the release-critical HTTP behaviour and stops both servers. It needs no
browser automation and no real Django project.

## 3. Configuration

| Variable | Rule |
| --- | --- |
| `BACKEND_API_URL` | **Required in production.** Must be an absolute `http(s)` URL with a host, no embedded credentials and no fragment. A trailing slash is stripped. Development may omit it and falls back to `http://127.0.0.1:8000`; production never assumes a host and fails closed instead. |
| `NEXT_PUBLIC_BACKEND_API_URL` | Must not exist. No backend host, token or secret may be exposed to browser code. |

See `.env.example` for the documented placeholder.

## 4. Security checks

| Check | Expected |
| --- | --- |
| Content-Security-Policy | Present on every response; contains no `'unsafe-eval'` and no wildcard in production; keeps `default-src 'self'` and `connect-src 'self'`. |
| `X-Content-Type-Options` | `nosniff`. |
| `Referrer-Policy` | `strict-origin-when-cross-origin`. |
| `X-Frame-Options` | `DENY`, reinforced by `frame-ancestors 'none'`. |
| `Permissions-Policy` | Camera, microphone, geolocation and payment disabled. |
| `X-Powered-By` | Absent (`poweredByHeader: false`). |
| HSTS | **Not set.** It depends on HTTPS and domain topology and is finalized at deployment. |
| Same-origin mutation guard | A cross-site `POST`/`PUT`/`PATCH`/`DELETE` on `/api/auth/*` or `/api/backend/*` answers `403` and never reaches Django. Reads are unaffected. |
| Auth cookies | `HttpOnly`, `Secure` in production, `SameSite=Lax`, `Path=/`; deletion cookies carry matching attributes. |
| Token exposure | No JWT in `localStorage`, `sessionStorage`, `IndexedDB`, a readable cookie or React state. |
| Proxy hygiene | Client `Authorization`, `Cookie`, `Host` and `X-Forwarded-*` are never forwarded; token endpoints are not proxied; traversal and scheme/host injection are rejected; exactly one refresh retry. |
| Cache | Session and data responses are `no-store`. |
| Error bodies | No stack trace, exception message, environment value, internal path or backend URL reaches a browser, including on a configuration failure. |
| Download filenames | A `Content-Disposition` name is sanitized: no directory component, no control character, no reserved device name. File bytes are unchanged. |
| Logging | No `console.log`/`debug`/`info` in production source; no log call carries a token, cookie, password or workbook body. |
| Secrets | No tracked `SECRET_KEY`, token, password, private key or real `.env` value. `.env.example` holds placeholders only. |

## 5. Health checks

| Endpoint | Publishing guidance |
| --- | --- |
| `GET /api/health/live` | Liveness. `200` means the process is serving. It checks no dependency, so it must not be used to decide whether to restart the service because of a backend outage. |
| `GET /api/health/ready` | Readiness. `200` with `{"status":"ok"}` means this frontend and its backend dependency are both usable. `503` with `{"status":"unavailable"}` means the backend is unreachable, not ready, or the backend host is not configured. |

Both are public and `no-store`. Point the load balancer at `live` and traffic routing at
`ready`.

## 6. Behavioural checks

- Anonymous `GET /` and `GET /dashboard` redirect to `/login`; `/login` answers `200`.
- An expired session performs exactly one refresh; a rejected refresh clears the cookies
  and returns the user to login with no redirect loop.
- A backend outage (`503` on `/api/auth/session`) shows a temporary-unavailable state with
  retry and **does not** clear valid cookies.
- `401` and `403` stay distinct: only `401` returns the user to login.
- Out-of-scope objects stay `404` without revealing scope.
- Structured `409` refusals for generation, manual edit and workflow remain readable.
- Instructor accounts reach only the dashboard and My Timetable.
- A department-scoped account with no department is restricted, never given college-wide
  data.
- Every navigation destination resolves to a real page; no placeholder, demo or
  diagnostic route exists.

## 7. Artefact checks

- No tracked `.env`, `node_modules`, `.next`, `coverage`, downloaded `.xlsx`/`.pdf`,
  temporary diagnostic file or backup archive.
- Package version is `1.0.0` in both `package.json` and the lockfile.
- No Git tag and no GitHub Release is created by this checklist.
- `docs/FINAL_FRONTEND_ARCHITECTURE.md`, `docs/DEPLOYMENT_READINESS.md` and
  `docs/BACKEND_API_COVERAGE.md` describe the released state.

## 8. Accessibility checks

Checked by hand and by test; no automated accessibility runner is part of the gate (see
section 12 of `docs/FINAL_FRONTEND_ARCHITECTURE.md` for that decision).

- Keyboard only: reach every route, filter, form field, dialog and export without a
  pointer.
- The skip link is the first focusable element and moves focus to `#main-content`.
- The mobile drawer opens from the menu button, traps nothing, and closes on `Escape`.
- Confirmation dialogs move focus inside on open, cancel on `Escape`, keep `Tab` inside,
  and return focus to the control that opened them. A destructive confirmation starts on
  the cancel action.
- Focus is always visible while tabbing; no control is reachable but invisible.
- Status is readable as text; colour is never the only carrier of meaning.
- Wide tables and the timetable grid scroll horizontally instead of clipping.
