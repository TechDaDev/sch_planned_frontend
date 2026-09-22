'use client';

import { useMemo } from 'react';

import { useSession } from '@/components/providers/session-provider';
import type { CurrentUser } from '@/lib/auth/types';
import { buildFormContext, type FormContext } from '@/lib/academic/forms';
import {
  toCapabilityUser,
  type AcademicCapabilityUser,
} from '@/lib/academic/permissions';

export interface AcademicUserView {
  user: CurrentUser | null;
  capability: AcademicCapabilityUser | null;
  context: FormContext;
}

/**
 * Session user reduced to the fields academic capability checks need.
 *
 * Reading the session once per page keeps capability checks consistent with the
 * authenticated shell that already resolved the session.
 */
export function useAcademicUser(): AcademicUserView {
  const { user } = useSession();
  return useMemo(() => {
    const capability = user ? toCapabilityUser(user) : null;
    return { user, capability, context: buildFormContext(capability) };
  }, [user]);
}
