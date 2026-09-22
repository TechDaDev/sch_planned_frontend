'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useSession } from '@/components/providers/session-provider';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { buildPostLoginPath } from '@/lib/navigation/redirect';

const USERNAME_ID = 'login-username';
const PASSWORD_ID = 'login-password';
const USERNAME_ERROR_ID = 'login-username-error';
const PASSWORD_ERROR_ID = 'login-password-error';
const FORM_ERROR_ID = 'login-form-error';

export function LoginForm() {
  const { signIn, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextTarget = buildPostLoginPath(searchParams.get('next'));

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (status === 'authenticated') {
      router.replace(nextTarget);
    }
  }, [status, nextTarget, router]);

  const usernameError = fieldErrors?.username?.[0] ?? null;
  const passwordError = fieldErrors?.password?.[0] ?? null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);
    setFieldErrors(null);

    const trimmedUsername = username.trim();
    if (trimmedUsername.length === 0 || password.length === 0) {
      setFormError('Enter both your username and password.');
      return;
    }

    setIsSubmitting(true);
    const result = await signIn({ username: trimmedUsername, password });
    setIsSubmitting(false);

    if (result.ok) {
      router.replace(nextTarget);
      router.refresh();
      return;
    }

    setFormError(result.message);
    setFieldErrors(result.fieldErrors ?? null);
  }

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <section className="flex flex-1 items-center justify-center bg-sidebar px-6 py-12 text-sidebar-foreground lg:px-12">
        <div className="max-w-md">
          <p className="text-xs font-medium uppercase tracking-wide text-sidebar-muted">
            College operations
          </p>
          <h1 className="mt-3 text-2xl font-semibold text-white sm:text-3xl">
            College Academic Schedule Planner
          </h1>
          <p className="mt-4 text-sm text-sidebar-muted">
            Plan academic structure, teaching resources and timetables, and follow the
            approvals workflow. Access is granted by the college administration.
          </p>
        </div>
      </section>

      <section className="flex flex-1 items-center justify-center px-4 py-10 sm:px-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Sign in</CardTitle>
            <CardDescription>
              Use the account issued by your college administrator.
            </CardDescription>
          </CardHeader>
          <CardBody>
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {formError ? (
                <Alert tone="danger" id={FORM_ERROR_ID}>
                  {formError}
                </Alert>
              ) : null}

              <div className="space-y-1.5">
                <label htmlFor={USERNAME_ID} className="block text-sm font-medium">
                  Username
                </label>
                <Input
                  id={USERNAME_ID}
                  name="username"
                  type="text"
                  autoComplete="username"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                  invalid={usernameError !== null}
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  aria-describedby={
                    usernameError ? USERNAME_ERROR_ID : formError ? FORM_ERROR_ID : undefined
                  }
                />
                {usernameError ? (
                  <p id={USERNAME_ERROR_ID} className="text-sm text-danger">
                    {usernameError}
                  </p>
                ) : null}
              </div>

              <div className="space-y-1.5">
                <label htmlFor={PASSWORD_ID} className="block text-sm font-medium">
                  Password
                </label>
                <Input
                  id={PASSWORD_ID}
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  required
                  invalid={passwordError !== null}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  aria-describedby={
                    passwordError ? PASSWORD_ERROR_ID : formError ? FORM_ERROR_ID : undefined
                  }
                />
                {passwordError ? (
                  <p id={PASSWORD_ERROR_ID} className="text-sm text-danger">
                    {passwordError}
                  </p>
                ) : null}
              </div>

              <Button type="submit" className="w-full" isLoading={isSubmitting}>
                {isSubmitting ? 'Signing in…' : 'Sign in'}
              </Button>

              <p className="text-xs text-muted-foreground">
                Accounts are created and managed by the college administration; this system
                has no self-registration.
              </p>
            </form>
          </CardBody>
        </Card>
      </section>
    </div>
  );
}
