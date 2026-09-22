/**
 * Protected route prefixes.
 *
 * A single source of truth for two different checks: the Next.js proxy uses it to send a
 * visitor without an auth cookie to the login page, and the UI capability layer uses it
 * to decide whether a role may open a path at all. Keeping one list means a new module
 * cannot be protected by the proxy while staying reachable by direct URL for a role that
 * should not have it, or the other way round.
 *
 * The prefix check is deliberately path-aware: `/audit` and `/audit/9f0f` are covered,
 * `/audit-trail` is not.
 */

export const PROTECTED_PREFIXES: readonly string[] = [
  '/dashboard',
  '/academic',
  '/resources',
  '/scheduling',
  '/published',
  '/reports',
  '/audit',
  '/imports',
  '/my-timetable',
  '/forbidden',
];

export function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}
