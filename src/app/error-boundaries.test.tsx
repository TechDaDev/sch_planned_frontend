// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import GlobalError from '@/app/error';
import RootError from '@/app/global-error';
import NotFound from '@/app/not-found';

/**
 * Error boundaries.
 *
 * A catastrophic failure must show a controlled application message, offer a way back,
 * and never expose an exception message, a stack trace or a digest's contents. These
 * tests pass a deliberately hostile error to prove that nothing from it is rendered.
 */
const HOSTILE = Object.assign(
  new Error('connect ECONNREFUSED 127.0.0.1:8000 for user d.admin with token eyJhbGciOi'),
  { digest: '1234567890abcdef' },
);

describe('route error boundary', () => {
  it('shows a controlled message and never the exception', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { container } = render(<GlobalError error={HOSTILE} reset={vi.fn()} />);

    expect(screen.getByText('Something went wrong')).toBeVisible();
    const text = container.textContent ?? '';
    expect(text).not.toContain('ECONNREFUSED');
    expect(text).not.toContain('127.0.0.1');
    expect(text).not.toContain('d.admin');
    expect(text).not.toContain('eyJhbGciOi');
    expect(text).not.toContain('connect');
  });

  it('offers retry and a way back to the dashboard', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reset = vi.fn();
    const user = userEvent.setup();

    render(<GlobalError error={HOSTILE} reset={reset} />);
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(reset).toHaveBeenCalledTimes(1);
    // A rendering failure is not an authentication problem, so the user is not sent to
    // the login page.
    expect(screen.getByRole('link', { name: 'Go to dashboard' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
  });

  it('shows only the correlation digest as a reference', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<GlobalError error={HOSTILE} reset={vi.fn()} />);

    expect(screen.getByText('Reference: 1234567890abcdef')).toBeVisible();
  });

  it('omits the reference when no digest exists', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<GlobalError error={new Error('boom')} reset={vi.fn()} />);

    expect(screen.queryByText(/Reference:/)).toBeNull();
  });
});

describe('root error boundary', () => {
  it('renders its own document and a controlled message', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // The root boundary replaces the whole document, which a fragment container cannot
    // express, so the structure is asserted from the rendered markup.
    const markup = renderToString(<RootError error={HOSTILE} reset={vi.fn()} />);

    expect(markup).toContain('<html');
    expect(markup).toContain('<body');
    expect(markup).toContain('<main');
    expect(markup).not.toContain('ECONNREFUSED');
    expect(markup).not.toContain('eyJhbGciOi');
  });

  it('shows the controlled message in the browser', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});

    const { container } = render(<RootError error={HOSTILE} reset={vi.fn()} />);

    expect(container.querySelector('main')).not.toBeNull();
    expect(screen.getByText('The application could not start')).toBeVisible();
    const text = container.textContent ?? '';
    expect(text).not.toContain('ECONNREFUSED');
    expect(text).not.toContain('eyJhbGciOi');
  });

  it('offers retry and the dashboard', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const reset = vi.fn();
    const user = userEvent.setup();

    render(<RootError error={HOSTILE} reset={reset} />);
    await user.click(screen.getByRole('button', { name: 'Try again' }));

    expect(reset).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('link', { name: 'Go to dashboard' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
  });
});

describe('not found page', () => {
  it('explains the state and offers a way back', () => {
    render(<NotFound />);

    expect(screen.getByText('Page not found')).toBeVisible();
    expect(screen.getByRole('link', { name: 'Go to dashboard' })).toHaveAttribute(
      'href',
      '/dashboard',
    );
    expect(screen.getByRole('link', { name: 'Sign in' })).toHaveAttribute('href', '/login');
  });
});
