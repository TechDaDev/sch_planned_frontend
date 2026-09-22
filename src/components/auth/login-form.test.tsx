// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { LoginForm } from '@/components/auth/login-form';
import { SessionProvider } from '@/components/providers/session-provider';
import { currentUserPayload, installFetchMock, jsonResponse } from '@/test/fetch-mock';

const navMocks = vi.hoisted(() => ({
  replace: vi.fn(),
  refresh: vi.fn(),
  push: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: navMocks.replace,
    refresh: navMocks.refresh,
    push: navMocks.push,
  }),
  useSearchParams: () => new URLSearchParams('next=/scheduling'),
  usePathname: () => '/login',
}));

const SESSION_URL = '/api/auth/session';
const LOGIN_URL = '/api/auth/login';

beforeEach(() => {
  navMocks.replace.mockReset();
  navMocks.refresh.mockReset();
  navMocks.push.mockReset();
});

function renderLoginForm() {
  return render(
    <SessionProvider>
      <LoginForm />
    </SessionProvider>,
  );
}

describe('LoginForm', () => {
  it('renders accessible labelled fields', async () => {
    installFetchMock([
      {
        url: SESSION_URL,
        handler: () => jsonResponse({ code: 'unauthenticated' }, 401),
      },
    ]);

    renderLoginForm();

    expect(screen.getByLabelText('Username')).toHaveAttribute(
      'autocomplete',
      'username',
    );
    expect(screen.getByLabelText('Password')).toHaveAttribute(
      'autocomplete',
      'current-password',
    );
    expect(screen.getByRole('button', { name: 'Sign in' })).toHaveAttribute(
      'type',
      'submit',
    );
  });

  it('requires both fields before calling the API', async () => {
    const user = userEvent.setup();
    const mock = installFetchMock([
      {
        url: SESSION_URL,
        handler: () => jsonResponse({ code: 'unauthenticated' }, 401),
      },
    ]);

    renderLoginForm();
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Enter both your username and password.',
    );
    expect(mock.countTo(LOGIN_URL)).toBe(0);
    expect(navMocks.replace).not.toHaveBeenCalled();
  });

  it('shows a controlled error for invalid credentials', async () => {
    const user = userEvent.setup();
    installFetchMock([
      {
        url: SESSION_URL,
        handler: () => jsonResponse({ code: 'unauthenticated' }, 401),
      },
      {
        url: LOGIN_URL,
        method: 'POST',
        handler: () =>
          jsonResponse({ code: 'invalid_credentials', detail: 'Invalid username or password.' }, 401),
      },
    ]);

    renderLoginForm();
    await user.type(screen.getByLabelText('Username'), 'r.salim');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Invalid username or password.',
    );
    // The password survives in the form field but is never rendered as text.
    expect(screen.getByLabelText('Password')).toHaveValue('wrong-password');
    expect(document.body.textContent).not.toContain('wrong-password');
    expect(navMocks.replace).not.toHaveBeenCalled();
  });

  it('disables the submit button while the request is in flight', async () => {
    const user = userEvent.setup();
    let resolveLogin: (() => void) | undefined;
    installFetchMock([
      {
        url: SESSION_URL,
        handler: () => jsonResponse({ code: 'unauthenticated' }, 401),
      },
      {
        url: LOGIN_URL,
        method: 'POST',
        handler: () =>
          new Promise<Response>((resolve) => {
            resolveLogin = () =>
              resolve(jsonResponse({ user: currentUserPayload() }, 200));
          }),
      },
    ]);

    renderLoginForm();
    await user.type(screen.getByLabelText('Username'), 'r.salim');
    await user.type(screen.getByLabelText('Password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    const pendingButton = await screen.findByRole('button', { name: /Signing in/ });
    expect(pendingButton).toBeDisabled();

    resolveLogin?.();

    await waitFor(() => {
      expect(navMocks.replace).toHaveBeenCalledWith('/scheduling');
    });
  });

  it('redirects to a safe internal target after a successful sign-in', async () => {
    const user = userEvent.setup();
    installFetchMock([
      {
        url: SESSION_URL,
        handler: () => jsonResponse({ code: 'unauthenticated' }, 401),
      },
      {
        url: LOGIN_URL,
        method: 'POST',
        handler: () => jsonResponse({ user: currentUserPayload() }, 200),
      },
    ]);

    renderLoginForm();
    await user.type(screen.getByLabelText('Username'), 'r.salim');
    await user.type(screen.getByLabelText('Password'), 'secret');
    await user.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => {
      expect(navMocks.replace).toHaveBeenCalledWith('/scheduling');
    });
  });
});
