# Deployment Readiness

Frontend **v1.0.0** release candidate against **Backend API v1.0.0**.

This document states what is ready, what is deliberately not created yet, and what the
deployment step must supply. It contains no invented service name, host or domain.

---

## 1. What is ready

- The frontend **code** is deployment-ready: hardening, health endpoints, same-origin
  mutation protection, configuration failure handling and the full release gate are in
  place and verified.
- The production build is a standard Next.js 16 server build (`npm run build`), started by
  `next start`.
- A deterministic release gate exists (`docs/FRONTEND_RELEASE_CHECKLIST.md`), including a
  smoke test that exercises the built server over HTTP.

## 2. What does not exist yet, by design

| Item | Status |
| --- | --- |
| Railway project, service or variables | **Not created.** Deployment is out of scope for this phase. |
| `railway.json`, `Dockerfile`, `Procfile` | **Not added.** |
| Production domain | **Not known.** |
| HTTPS termination and certificates | **Deployment responsibility.** |
| HSTS | **Not enabled**, because `preload`/`includeSubDomains` cannot be chosen without domain knowledge. |
| Production `BACKEND_API_URL` value | **Must be supplied at deployment.** |
| PostgreSQL or any database configuration | **Backend responsibility.** The frontend holds no database setting. |

## 3. What deployment must supply

1. **`BACKEND_API_URL`** — the absolute base URL of the Django service, including scheme
   and host, without embedded credentials and without a trailing requirement. Example of
   the *shape* only: `https://<backend-host>`. The frontend fails closed if this is missing
   or invalid in a production runtime, and will not silently target localhost.
2. **Node 24 LTS** as the runtime.
3. A build step (`npm ci` then `npm run build`) and a start command (`next start`).
4. Health wiring: liveness probe on `/api/health/live`, readiness probe on
   `/api/health/ready`.
5. Reverse proxy behaviour that preserves the client `Host` header and terminates TLS in
   front of the application. The frontend never trusts `X-Forwarded-*` for authorization,
   and its same-origin guard compares the request `Origin` host against the host the
   request was delivered to, so a proxy that rewrites `Host` must keep the browser-facing
   host consistent with the origin the browser used.

## 4. Service topology

The frontend and the backend remain **separate services**. The frontend never connects to
the backend database, never holds backend credentials beyond the user's own session, and
never exposes the backend host to the browser. All cross-service traffic is
server-to-server from the Next.js process, over the same-origin BFF.

## 5. Environment matrix

| Environment | `BACKEND_API_URL` | Cookies | CSP |
| --- | --- | --- | --- |
| Development | Optional; falls back to `http://127.0.0.1:8000` | Not `Secure` | Scripts and styles `'unsafe-inline'`, plus `'unsafe-eval'` for framework tooling |
| Production | **Required**, absolute `http(s)` URL with a host | `Secure`, `HttpOnly`, `SameSite=Lax`, `Path=/` | `'unsafe-inline'` for scripts and styles, **never** `'unsafe-eval'`, no wildcard, `connect-src 'self'` |

## 6. Health endpoint semantics for operators

| Endpoint | 200 | 503 |
| --- | --- | --- |
| `/api/health/live` | The process is running. | The process is not serving. |
| `/api/health/ready` | The frontend and the backend dependency are usable. | The backend is unreachable, not ready, or the backend host is not configured. Readiness always depends on backend readiness. |

Neither endpoint reveals a host, a path, an environment value or a version. Both are
`no-store`, so a probe result is never cached as an artifact.

Recommended wiring: restart decisions use `live` only; traffic admission uses `ready`. A
backend outage then removes the instance from rotation without restarting a healthy
frontend process.

## 7. Remaining deployment-specific work

- Choose the domain and enable HSTS with the topology that justifies it.
- Pin the production `BACKEND_API_URL` and confirm the backend is reachable from the
  frontend service.
- Confirm the reverse proxy passes the browser-facing `Host` and does not require the
  `X-Forwarded-*` headers for correctness.
- Decide whether the deployment needs source maps; the release candidate ships with
  `productionBrowserSourceMaps: false`.
- Reproduce the full release gate on Node 24 in the deployment environment.
