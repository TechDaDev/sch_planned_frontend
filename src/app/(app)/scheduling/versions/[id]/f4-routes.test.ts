import { describe, expect, it } from 'vitest';

import AuditDetailPage from '@/app/(app)/audit/[id]/page';
import VersionReportPage from '@/app/(app)/reports/version/[id]/page';
import VersionEditPage from '@/app/(app)/scheduling/versions/[id]/edit/page';
import VersionWorkflowPage from '@/app/(app)/scheduling/versions/[id]/workflow/page';

/**
 * The F4 dynamic routes.
 *
 * Ids arrive as strings. A numeric id addresses one stored version; anything else
 * cannot, so the route answers through `notFound()` instead of asking the backend a
 * malformed question. Audit ids are opaque UUID strings, so they are passed through
 * unchanged and a malformed value simply produces the backend's not-found answer.
 */
describe('version route parameters', () => {
  const pages = [
    { name: 'edit', page: VersionEditPage },
    { name: 'workflow', page: VersionWorkflowPage },
    { name: 'version report', page: VersionReportPage },
  ] as const;

  for (const { name, page } of pages) {
    it(`passes a numeric id through on the ${name} route`, async () => {
      const element = await page({ params: Promise.resolve({ id: '501' }) });

      expect(element).toBeTruthy();
      expect((element as { props: { versionId: number } }).props.versionId).toBe(501);
    });

    it(`refuses a non-numeric id on the ${name} route`, async () => {
      await expect(page({ params: Promise.resolve({ id: 'not-a-number' }) })).rejects.toThrow();
    });

    it(`refuses a zero or negative id on the ${name} route`, async () => {
      await expect(page({ params: Promise.resolve({ id: '0' }) })).rejects.toThrow();
      await expect(page({ params: Promise.resolve({ id: '-3' }) })).rejects.toThrow();
    });
  }
});

describe('audit detail route parameter', () => {
  it('passes the opaque id through unchanged', async () => {
    const element = await AuditDetailPage({
      params: Promise.resolve({ id: '0f5b2c1e-7a4d-4f6e-9c8b-1d2e3f4a5b6c' }),
    });

    expect((element as { props: { eventId: string } }).props.eventId).toBe(
      '0f5b2c1e-7a4d-4f6e-9c8b-1d2e3f4a5b6c',
    );
  });
});
