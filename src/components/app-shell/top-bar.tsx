'use client';

import { LogOut, Menu } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { useSession } from '@/components/providers/session-provider';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { getRoleLabel } from '@/lib/roles';
import type { CurrentUser } from '@/lib/auth/types';

interface TopBarProps {
  user: CurrentUser;
  onOpenSidebar: () => void;
  isDrawerOpen: boolean;
}

export function TopBar({ user, onOpenSidebar, isDrawerOpen }: TopBarProps) {
  const { logout } = useSession();
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleLogout() {
    setIsSigningOut(true);
    await logout();
    router.replace('/login');
    router.refresh();
  }

  return (
    <header className="flex h-16 items-center justify-between gap-3 border-b border-line bg-surface px-4 sm:px-6">
      <div className="flex min-w-0 items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          className="lg:hidden"
          aria-label="Open navigation menu"
          aria-expanded={isDrawerOpen}
          aria-controls="app-navigation-drawer"
          onClick={onOpenSidebar}
        >
          <Menu aria-hidden="true" className="size-5" />
        </Button>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{user.full_name}</p>
          <p className="truncate text-xs text-muted-foreground">@{user.username}</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-3">
        <Badge tone="info" title="Application role">
          {getRoleLabel(user.role)}
        </Badge>
        <Badge
          tone={user.department ? 'neutral' : 'warning'}
          title="Department assignment"
          className="hidden sm:inline-flex"
        >
          {user.department ? user.department.name : 'No department'}
        </Badge>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleLogout}
          isLoading={isSigningOut}
        >
          <LogOut aria-hidden="true" className="size-4" />
          <span className="hidden sm:inline">Sign out</span>
        </Button>
      </div>
    </header>
  );
}
