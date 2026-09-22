'use client';

import { X } from 'lucide-react';
import { useEffect, useState } from 'react';

import { SidebarNav } from '@/components/app-shell/sidebar-nav';
import { TopBar } from '@/components/app-shell/top-bar';
import type { CurrentUser } from '@/lib/auth/types';
import { ROLE_LABELS } from '@/lib/roles';

interface AppShellProps {
  user: CurrentUser;
  children: React.ReactNode;
}

function Brand() {
  return (
    <div className="px-1">
      <p className="text-sm font-semibold text-white">Academic Schedule Planner</p>
      <p className="text-xs text-sidebar-muted">College operations</p>
    </div>
  );
}

export function AppShell({ user, children }: AppShellProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  useEffect(() => {
    if (!isDrawerOpen) {
      return;
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsDrawerOpen(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isDrawerOpen]);

  return (
    <div className="min-h-screen lg:flex">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-3 focus:py-2 focus:text-sm"
      >
        Skip to main content
      </a>

      <aside className="hidden w-64 shrink-0 flex-col gap-6 bg-sidebar px-3 py-5 lg:flex">
        <Brand />
        <SidebarNav role={user.role} />
        <p className="mt-auto px-3 text-xs text-sidebar-muted">
          {ROLE_LABELS[user.role]} access
        </p>
      </aside>

      {isDrawerOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setIsDrawerOpen(false)}
          />
          <div
            id="app-navigation-drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Main navigation"
            className="relative flex h-full w-72 flex-col gap-6 bg-sidebar px-3 py-5"
          >
            <div className="flex items-start justify-between gap-2">
              <Brand />
              <button
                type="button"
                aria-label="Close navigation menu"
                className="rounded-md p-1 text-sidebar-foreground hover:bg-white/10"
                onClick={() => setIsDrawerOpen(false)}
              >
                <X aria-hidden="true" className="size-5" />
              </button>
            </div>
            <SidebarNav role={user.role} onNavigate={() => setIsDrawerOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar
          user={user}
          isDrawerOpen={isDrawerOpen}
          onOpenSidebar={() => setIsDrawerOpen(true)}
        />
        <main id="main-content" className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}
