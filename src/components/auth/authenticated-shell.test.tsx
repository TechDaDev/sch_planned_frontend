// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthenticatedShell } from '@/components/auth/authenticated-shell';
import { SessionProvider } from '@/components/providers/session-provider';
import { installFetchMock, jsonResponse } from '@/test/fetch-mock';
import { BIOAI_DEPARTMENT } from '@/test/scheduling-fixtures';

/**
 * The authenticated gate every protected route sits behind.
 *
 * These are the session and error journeys a user can actually experience: a valid
 * session, an expired one, an outage, a path the role does not own and an account with
 * no department. The shell must never render protected content before the session is
 * known, and must never sign a user out because the server was unavailable.
 */
const SESSION_URL = '/api/auth/session';

const replace = vi.fn();
let pathname = '/dashboard';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: (target: string) => replace(target), push: vi.fn() }),
  usePathname: () => pathname,
}));

const ACCOUNTS = {
  collegeAdmin: {
    id: 1,
    username: 'c.admin',
    email: 'c.admin@example.edu',
    first_name: 'Cara',
    last_name: 'Admin',
    full_name: 'Cara Admin',
    role: 'COLLEGE_ADMIN',
    department: null,
  },
  departmentAdmin: {
    id: 2,
    username: 'd.admin',
    email: 'd.admin@example.edu',
    first_name: 'Dana',
    last_name: 'Admin',
    full_name: 'Dana Admin',
    role: 'DEPARTMENT_ADMIN',
    department: { id: BIOAI_DEPARTMENT.id, name: BIOAI_DEPARTMENT.name, code: 'BIOAI' },
  },
  viewer: {
    id: 3,
    username: 'v.iewer',
    email: 'v.iewer@example.edu',
    first_name: 'Vera',
    last_name: 'Viewer',
    full_name: 'Vera Viewer',
    role: 'VIEWER',
    department: { id: BIOAI_DEPARTMENT.id, name: BIOAI_DEPARTMENT.name, code: 'BIOAI' },
  },
  departmentlessAdmin: {
    id: 4,
    username: 'n.admin',
    email: 'n.admin@example.edu',
    first_name: 'Nadia',
    last_name: 'Admin',
    full_name: 'Nadia Admin',
    role: 'DEPARTMENT_ADMIN',
    department: null,
  },
} as const;

function renderShell() {
  return render(
    <SessionProvider>
      <AuthenticatedShell>
        <p>Protected module content</p>
      </AuthenticatedShell>
    </SessionProvider>,
  );
}

beforeEach(() => {
  replace.mockClear();
  pathname = '/dashboard';
});

describe('valid session', () => {
  it('renders the protected content inside the shell', async () => {
    installFetchMock([{ url: SESSION_URL, handler: () => jsonResponse({ user: ACCOUNTS.collegeAdmin }) }]);

    renderShell();

    expect(await screen.findByText('Protected module content')).toBeVisible();
    expect(replace).not.toHaveBeenCalled();
  });

  it('never flashes protected content before the session is known', () => {
    installFetchMock([{ url: SESSION_URL, handler: () => new Promise<Response>(() => {}) }]);

    renderShell();

    expect(screen.getByText(/Restoring your session/)).toBeVisible();
    expect(screen.queryByText('Protected module content')).toBeNull();
  });
});

describe('expired session', () => {
  it('returns the user to the login page with the intended path and renders nothing protected', async () => {
    pathname = '/scheduling';
    installFetchMock([
      {
        url: SESSION_URL,
        handler: () => jsonResponse({ code: 'session_expired', detail: 'Expired.' }, 401),
      },
    ]);

    renderShell();

    await waitFor(() => {
      expect(replace).toHaveBeenCalledWith('/login?next=%2Fscheduling');
    });
    expect(screen.queryByText('Protected module content')).toBeNull();
  });

  it('never loops: the redirect happens once per unauthenticated resolution', async () => {
    installFetchMock([
      { url: SESSION_URL, handler: () => jsonResponse({ code: 'unauthenticated', detail: 'No.' }, 401) },
    ]);

    renderShell();

    await waitFor(() => {
      expect(replace).toHaveBeenCalled();
    });
    expect(replace.mock.calls).toHaveLength(1);
  });
});

describe('backend outage', () => {
  it('shows a temporary-unavailable state with retry and does not sign the user out', async () => {
    installFetchMock([
      {
        url: SESSION_URL,
        handler: () =>
          jsonResponse({ code: 'backend_unavailable', detail: 'Unavailable.' }, 503),
      },
    ]);

    renderShell();

    expect(await screen.findByText('Session unavailable')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeVisible();
    // A 503 is not an authentication failure: no redirect, no protected content.
    expect(replace).not.toHaveBeenCalled();
    expect(screen.queryByText('Protected module content')).toBeNull();
  });

  it('recovers when the retry succeeds', async () => {
    let attempt = 0;
    installFetchMock([
      {
        url: SESSION_URL,
        handler: () => {
          attempt += 1;
          return attempt === 1
            ? jsonResponse({ code: 'backend_unavailable', detail: 'Unavailable.' }, 503)
            : jsonResponse({ user: ACCOUNTS.collegeAdmin });
        },
      },
    ]);

    renderShell();
    const retry = await screen.findByRole('button', { name: 'Try again' });
    retry.click();

    expect(await screen.findByText('Protected module content')).toBeVisible();
  });
});

describe('path the role does not own', () => {
  it('refuses the module inside the shell instead of rendering it', async () => {
    pathname = '/audit';
    installFetchMock([{ url: SESSION_URL, handler: () => jsonResponse({ user: ACCOUNTS.viewer }) }]);

    renderShell();

    expect(await screen.findByText('Not available for your role')).toBeVisible();
    expect(screen.queryByText('Protected module content')).toBeNull();
    expect(replace).not.toHaveBeenCalled();
  });

  it('lets a role render the module it does own', async () => {
    pathname = '/scheduling';
    installFetchMock([
      { url: SESSION_URL, handler: () => jsonResponse({ user: ACCOUNTS.departmentAdmin }) },
    ]);

    renderShell();

    expect(await screen.findByText('Protected module content')).toBeVisible();
  });
});

describe('departmentless account', () => {
  it('restricts a department-scoped module', async () => {
    pathname = '/scheduling';
    installFetchMock([
      { url: SESSION_URL, handler: () => jsonResponse({ user: ACCOUNTS.departmentlessAdmin }) },
    ]);

    renderShell();

    expect(await screen.findByText(/No department is assigned to this account/)).toBeVisible();
    expect(screen.queryByText('Protected module content')).toBeNull();
  });

  it('still renders a module that is not department-scoped', async () => {
    pathname = '/dashboard';
    installFetchMock([
      { url: SESSION_URL, handler: () => jsonResponse({ user: ACCOUNTS.departmentlessAdmin }) },
    ]);

    renderShell();

    expect(await screen.findByText('Protected module content')).toBeVisible();
  });
});
