'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { NAV_ICONS } from '@/components/app-shell/nav-icons';
import { getNavigationForRole } from '@/lib/navigation/navigation';
import { cn } from '@/lib/utils/cn';
import type { UserRole } from '@/lib/roles';

interface SidebarNavProps {
  role: UserRole;
  onNavigate?: () => void;
}

export function SidebarNav({ role, onNavigate }: SidebarNavProps) {
  const pathname = usePathname();
  const items = getNavigationForRole(role);

  if (items.length === 0) {
    return (
      <p className="px-3 py-2 text-sm text-sidebar-muted">
        No modules are available for this account role.
      </p>
    );
  }

  return (
    <nav aria-label="Main navigation" className="flex flex-col gap-1">
      {items.map((item) => {
        const Icon = NAV_ICONS[item.iconKey];
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onNavigate}
            aria-current={isActive ? 'page' : undefined}
            title={item.description}
            className={cn(
              'flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors',
              isActive
                ? 'bg-sidebar-active text-white'
                : 'text-sidebar-foreground hover:bg-white/10',
            )}
          >
            <Icon aria-hidden="true" className="size-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
