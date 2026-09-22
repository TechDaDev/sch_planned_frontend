import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { NAV_ITEMS, getNavigationForRole } from '@/lib/navigation/navigation';

/**
 * Route inventory.
 *
 * The route tree is read from disk, so this test fails when a menu item points at a page
 * that does not exist, when a placeholder page survives into the release, or when two
 * menu items claim the same label with different destinations.
 */
const APP_DIR = path.resolve(process.cwd(), 'src/app');
const ROUTE_GROUPS = ['(app)', '(public)'];

function collectPageRoutes(dir: string, prefix = ''): string[] {
  const routes: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      // Route groups and private folders do not contribute a URL segment.
      const contributes = !entry.startsWith('(') && !entry.startsWith('_');
      routes.push(...collectPageRoutes(full, contributes ? `${prefix}/${entry}` : prefix));
      continue;
    }
    if (entry === 'page.tsx') {
      routes.push(prefix.length === 0 ? '/' : prefix);
    }
  }
  return routes;
}

function collectApiRoutes(dir: string, prefix = '/api'): string[] {
  const routes: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      routes.push(...collectApiRoutes(full, `${prefix}/${entry}`));
      continue;
    }
    if (entry === 'route.ts') {
      routes.push(prefix);
    }
  }
  return routes;
}

const pageRoutes = [
  ...ROUTE_GROUPS.flatMap((group) => collectPageRoutes(path.join(APP_DIR, group))),
  '/',
  '/not-found-check',
];
const apiRoutes = collectApiRoutes(path.join(APP_DIR, 'api'));

function pageFileFor(route: string): string | null {
  for (const group of ROUTE_GROUPS) {
    const candidate = path.join(APP_DIR, group, route === '/' ? '' : route, 'page.tsx');
    try {
      if (statSync(candidate).isFile()) {
        return candidate;
      }
    } catch {
      // Not in this route group; keep looking.
    }
  }
  return null;
}

describe('navigation destinations exist', () => {
  it('has a page file for every navigation item', () => {
    for (const item of NAV_ITEMS) {
      expect(pageFileFor(item.href), `missing page for ${item.href}`).not.toBeNull();
    }
  });

  it('uses unique hrefs so no label points at two destinations', () => {
    const hrefs = NAV_ITEMS.map((item) => item.href);

    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it('uses unique labels so the menu cannot show a duplicate', () => {
    const labels = NAV_ITEMS.map((item) => item.label);

    expect(new Set(labels).size).toBe(labels.length);
  });

  it('offers every navigation item to at least one role', () => {
    for (const item of NAV_ITEMS) {
      const visible = ['COLLEGE_ADMIN', 'DEPARTMENT_ADMIN', 'SCHEDULER', 'VIEWER', 'INSTRUCTOR']
        .some((role) => getNavigationForRole(role).some((entry) => entry.href === item.href));

      expect(visible, `${item.href} is offered to no role`).toBe(true);
    }
  });
});

describe('route inventory stays intentional', () => {
  it('contains every product route', () => {
    const required = [
      '/dashboard',
      '/academic',
      '/resources',
      '/scheduling',
      '/published',
      '/reports',
      '/imports/semester-plan',
      '/audit',
      '/my-timetable',
      '/forbidden',
      '/login',
    ];

    for (const route of required) {
      expect(pageRoutes, `missing route ${route}`).toContain(route);
    }
  });

  it('contains no diagnostic, demo, seed or temporary route', () => {
    const suspect = pageRoutes.filter((route) =>
      /(demo|diagnostic|debug|seed|tmp|temp|test|playground|sandbox|example|sample|scratch)/i.test(
        route,
      ),
    );

    expect(suspect).toEqual([]);
  });

  it('keeps the public API surface deliberate', () => {
    // Auth, the generic proxy and the two health endpoints are the whole surface.
    expect(apiRoutes.filter((route) => route.startsWith('/api/auth')).sort()).toEqual([
      '/api/auth/login',
      '/api/auth/logout',
      '/api/auth/session',
    ]);
    expect(apiRoutes.filter((route) => route.startsWith('/api/health')).sort()).toEqual([
      '/api/health/live',
      '/api/health/ready',
    ]);
    expect(apiRoutes.filter((route) => route.startsWith('/api/backend'))).toHaveLength(1);
  });
});

describe('no placeholder page survives', () => {
  const FORBIDDEN = [
    'ModulePlaceholder',
    'Delivered in a later phase',
    'coming soon',
    'not implemented yet',
    'will be implemented in Frontend',
  ];

  it('has no phase placeholder marker in any page file', () => {
    const offenders: string[] = [];
    for (const group of ROUTE_GROUPS) {
      walk(path.join(APP_DIR, group), (file) => {
        if (!file.endsWith('.tsx') || file.endsWith('.test.tsx')) {
          return;
        }
        const source = readFileSync(file, 'utf8');
        for (const marker of FORBIDDEN) {
          if (source.includes(marker)) {
            offenders.push(`${path.relative(APP_DIR, file)} (${marker})`);
          }
        }
      });
    }

    expect(offenders).toEqual([]);
  });
});

function walk(dir: string, visit: (file: string) => void): void {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      walk(full, visit);
      continue;
    }
    visit(full);
  }
}
