#!/usr/bin/env node
/**
 * Production smoke test.
 *
 * Starts the real built application (`next start`) against a controlled stub backend and
 * asserts the release-critical behaviour over HTTP: redirects for anonymous visitors,
 * health endpoints, security headers, and the same-origin guard on mutations.
 *
 * It requires `npm run build` to have run, needs no browser automation and no real
 * Django project, and always stops the servers it started.
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import process from 'node:process';

const APP_PORT = Number(process.env.SMOKE_APP_PORT ?? 3210);
const BACKEND_PORT = Number(process.env.SMOKE_BACKEND_PORT ?? 8210);
const APP_ORIGIN = `http://127.0.0.1:${APP_PORT}`;
const BACKEND_URL = `http://127.0.0.1:${BACKEND_PORT}`;
const START_TIMEOUT_MS = 60_000;

const results = [];
let backendReady = true;

function record(name, passed, detail = '') {
  results.push({ name, passed, detail });
  const mark = passed ? 'PASS' : 'FAIL';
  process.stdout.write(`${mark}  ${name}${detail && !passed ? ` — ${detail}` : ''}\n`);
}

function assertEqual(name, actual, expected) {
  record(name, actual === expected, `expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}

function assertTrue(name, condition, detail = '') {
  record(name, condition === true, detail);
}

/** Stub backend: answers the readiness probe and nothing else. */
function startStubBackend() {
  const server = http.createServer((request, response) => {
    if (request.url?.startsWith('/api/health/ready/')) {
      if (backendReady) {
        response.writeHead(200, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ status: 'ok', detail: 'internal-stub-detail' }));
        return;
      }
      response.writeHead(503, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ status: 'unavailable', detail: 'db-internal:5432' }));
      return;
    }
    response.writeHead(404, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ detail: 'Not found.' }));
  });
  return new Promise((resolve) => {
    server.listen(BACKEND_PORT, '127.0.0.1', () => resolve(server));
  });
}

function startApp() {
  // The server is started directly rather than through a package-manager wrapper, so the
  // process this script holds is the process that must stop afterwards.
  const nextBin = path.join(process.cwd(), 'node_modules', 'next', 'dist', 'bin', 'next');
  const child = spawn(process.execPath, [nextBin, 'start', '--port', String(APP_PORT)], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      NODE_ENV: 'production',
      BACKEND_API_URL: BACKEND_URL,
      // No NEXT_PUBLIC backend value exists on purpose.
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const logs = [];
  child.stdout.on('data', (chunk) => logs.push(String(chunk)));
  child.stderr.on('data', (chunk) => logs.push(String(chunk)));
  return { child, logs };
}

async function waitForApp() {
  const deadline = Date.now() + START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${APP_ORIGIN}/api/health/live`);
      if (response.ok) {
        return true;
      }
    } catch {
      // Not listening yet.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}

async function main() {
  if (!existsSync(path.join(process.cwd(), '.next', 'BUILD_ID'))) {
    process.stderr.write('No production build found. Run `npm run build` first.\n');
    process.exit(1);
  }

  const stub = await startStubBackend();
  const { child, logs } = startApp();

  try {
    if (!(await waitForApp())) {
      record('application server started', false, logs.join('').slice(-500));
      return;
    }
    record('application server started', true);

    // Liveness and readiness.
    const live = await fetch(`${APP_ORIGIN}/api/health/live`);
    const liveBody = await live.json();
    assertEqual('GET /api/health/live → 200', live.status, 200);
    assertEqual('liveness body is the documented value', liveBody.status, 'ok');
    assertEqual(
      'liveness is no-store',
      live.headers.get('cache-control')?.includes('no-store'),
      true,
    );
    assertTrue(
      'liveness leaks no internal detail',
      !JSON.stringify(liveBody).includes('127.0.0.1'),
    );

    const ready = await fetch(`${APP_ORIGIN}/api/health/ready`);
    const readyBody = await ready.json();
    assertEqual('GET /api/health/ready with a ready backend → 200', ready.status, 200);
    assertEqual('readiness body is the documented value', readyBody.status, 'ok');
    assertTrue(
      'readiness hides the backend host',
      !JSON.stringify(readyBody).includes('127.0.0.1') &&
        !JSON.stringify(readyBody).includes(String(BACKEND_PORT)),
    );

    backendReady = false;
    const unready = await fetch(`${APP_ORIGIN}/api/health/ready`);
    const unreadyBody = await unready.json();
    assertEqual('GET /api/health/ready with an unready backend → 503', unready.status, 503);
    assertEqual('unready body is the documented value', unreadyBody.status, 'unavailable');
    assertTrue(
      'unreadiness leaks no infrastructure detail',
      !JSON.stringify(unreadyBody).includes('db-internal') &&
        !JSON.stringify(unreadyBody).includes('5432'),
    );
    backendReady = true;

    // Anonymous navigation.
    const login = await fetch(`${APP_ORIGIN}/login`, { redirect: 'manual' });
    assertEqual('GET /login → 200', login.status, 200);

    const root = await fetch(`${APP_ORIGIN}/`, { redirect: 'manual' });
    assertTrue('GET / without a cookie redirects', [302, 307, 308].includes(root.status), `got ${root.status}`);
    assertTrue(
      'GET / redirects to the login page',
      (root.headers.get('location') ?? '').includes('/login'),
      root.headers.get('location') ?? '(no location)',
    );

    const dashboard = await fetch(`${APP_ORIGIN}/dashboard`, { redirect: 'manual' });
    assertTrue(
      'GET /dashboard without a cookie redirects',
      [302, 307, 308].includes(dashboard.status),
      `got ${dashboard.status}`,
    );
    assertTrue(
      'GET /dashboard redirects to the login page with the intended path',
      (dashboard.headers.get('location') ?? '').includes('/login'),
      dashboard.headers.get('location') ?? '(no location)',
    );

    // Security headers.
    const secure = await fetch(`${APP_ORIGIN}/login`);
    const csp = secure.headers.get('content-security-policy') ?? '';
    assertTrue('Content-Security-Policy is present', csp.length > 0);
    assertTrue('CSP has no unsafe-eval in production', !csp.includes('unsafe-eval'));
    assertTrue("CSP keeps connect-src 'self'", csp.includes("connect-src 'self'"));
    assertTrue('CSP forbids framing', csp.includes("frame-ancestors 'none'"));
    assertTrue('CSP has no wildcard', !csp.includes('*'));
    assertEqual('X-Content-Type-Options', secure.headers.get('x-content-type-options'), 'nosniff');
    assertEqual('X-Frame-Options', secure.headers.get('x-frame-options'), 'DENY');
    assertEqual(
      'Referrer-Policy',
      secure.headers.get('referrer-policy'),
      'strict-origin-when-cross-origin',
    );
    assertTrue(
      'Permissions-Policy is present',
      (secure.headers.get('permissions-policy') ?? '').includes('camera=()'),
    );
    assertTrue('X-Powered-By is absent', secure.headers.get('x-powered-by') === null);

    // Same-origin mutation protection.
    const crossSite = await fetch(`${APP_ORIGIN}/api/auth/logout`, {
      method: 'POST',
      headers: { 'sec-fetch-site': 'cross-site', origin: 'https://evil.example' },
      redirect: 'manual',
    });
    assertEqual('cross-site logout is refused', crossSite.status, 403);
    assertTrue(
      'cross-site refusal sets no cookie',
      crossSite.headers.getSetCookie().length === 0,
    );

    const foreignOrigin = await fetch(`${APP_ORIGIN}/api/auth/logout`, {
      method: 'POST',
      headers: { origin: 'https://evil.example' },
      redirect: 'manual',
    });
    assertEqual('mismatched Origin is refused', foreignOrigin.status, 403);

    const sameOrigin = await fetch(`${APP_ORIGIN}/api/auth/logout`, {
      method: 'POST',
      headers: { origin: APP_ORIGIN, 'content-type': 'application/json' },
      body: '{}',
      redirect: 'manual',
    });
    const cleared = sameOrigin.headers.getSetCookie().join(' ');
    assertEqual('same-origin logout is accepted', sameOrigin.status, 200);
    assertTrue('logout clears both cookies', cleared.includes('sch_access=') && cleared.includes('sch_refresh='));
    assertTrue('logout cookies are HttpOnly', cleared.includes('HttpOnly'));

    // A read is never blocked by the mutation guard.
    const read = await fetch(`${APP_ORIGIN}/api/health/live`, {
      headers: { 'sec-fetch-site': 'cross-site' },
    });
    assertEqual('a read is never treated as a mutation', read.status, 200);
  } finally {
    await stopChild(child);
    await new Promise((resolve) => stub.close(resolve));
  }

  const failed = results.filter((result) => !result.passed);
  process.stdout.write(
    `\n${results.length - failed.length}/${results.length} smoke assertions passed.\n`,
  );
  // Exit explicitly: a server child may hold a handle open even after it is stopped.
  process.exit(failed.length > 0 ? 1 : 0);
}

/** Stop the application server, escalating only if it does not exit promptly. */
async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) {
    return;
  }
  const exited = new Promise((resolve) => child.once('exit', resolve));
  child.kill('SIGTERM');
  const timedOut = await Promise.race([
    exited.then(() => false),
    new Promise((resolve) => setTimeout(() => resolve(true), 5_000)),
  ]);
  if (timedOut) {
    child.kill('SIGKILL');
    await exited;
  }
}

await main();
