import type { Metadata } from 'next';
import { Suspense } from 'react';

import { LoginForm } from '@/components/auth/login-form';
import { LoadingScreen } from '@/components/ui/spinner';

export const metadata: Metadata = {
  title: 'Sign in',
};

export default function LoginPage() {
  return (
    <Suspense fallback={<LoadingScreen message="Loading sign in…" />}>
      <LoginForm />
    </Suspense>
  );
}
