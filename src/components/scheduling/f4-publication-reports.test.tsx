// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { SessionProvider } from '@/components/providers/session-provider';
import { ToastProvider } from '@/components/providers/toast-provider';
import { PublishedTimetableScreen } from '@/components/scheduling/published-timetable-screen';
import {
  PublishedReportScreen,
  ReportsLandingScreen,
  VersionReportScreen,
} from '@/components/scheduling/reports-screens';
import { EXPORT_MEDIA_TYPES } from '@/lib/scheduling/exports';
import { PDF_FONT_UNAVAILABLE_MESSAGE, ROOM_AVAILABILITY_MISSING_LABEL } from '@/lib/scheduling/constants';
import { currentUserPayload, binaryResponse, installFetchMock, jsonResponse } from '@/test/fetch-mock';
import { BIOAI_DEPARTMENT, scheduleVersionDetail } from '@/test/scheduling-fixtures';
import {
  analyticsResult,
  departmentScope,
  publishedSchedule,
  roomUsage,
} from '@/test/f4-fixtures';

const PROXY = '/api/backend';
const SESSION_URL = '/api/auth/session';

const COLLEGE_ADMIN = currentUserPayload({ role: 'COLLEGE_ADMIN', department: null });
const DEPARTMENT_ADMIN = currentUserPayload({
  role: 'DEPARTMENT_ADMIN',
  department: { id: BIOAI_DEPARTMENT.id, name: BIOAI_DEPARTMENT.name, code: BIOAI_DEPARTMENT.code },
});
const SCHEDULER = currentUserPayload({
  role: 'SCHEDULER',
  department: { id: BIOAI_DEPARTMENT.id, name: BIOAI_DEPARTMENT.name, code: BIOAI_DEPARTMENT.code },
});
const VIEWER = currentUserPayload({
  role: 'VIEWER',
  department: { id: BIOAI_DEPARTMENT.id, name: BIOAI_DEPARTMENT.name, code: BIOAI_DEPARTMENT.code },
});
const INSTRUCTOR = currentUserPayload({
  role: 'INSTRUCTOR',
  department: { id: BIOAI_DEPARTMENT.id, name: BIOAI_DEPARTMENT.name, code: BIOAI_DEPARTMENT.code },
});

const SEMESTERS = [
  {
    id: 8,
    number: 1,
    start_date: '2026-09-01',
    end_date: '2027-01-15',
    academic_year: { id: 3, start_year: 2026, end_year: 2027 },
    is_active: true,
    created_at: '2026-09-01T08:00:00Z',
    updated_at: '2026-09-01T08:00:00Z',
  },
  {
    id: 9,
    number: 2,
    start_date: '2027-02-01',
    end_date: '2027-06-15',
    academic_year: { id: 3, start_year: 2026, end_year: 2027 },
    is_active: false,
    created_at: '2026-09-01T08:00:00Z',
    updated_at: '2026-09-01T08:00:00Z',
  },
];

const PUBLISHED_URL = `${PROXY}/published-schedules/current?semester=8`;
const PUBLISHED_ANALYTICS_URL = `${PROXY}/published-schedules/current/analytics?semester=8`;

function renderScreen(element: React.ReactElement) {
  return render(
    <SessionProvider>
      <ToastProvider>{element}</ToastProvider>
    </SessionProvider>,
  );
}

function baseRoutes(account: unknown) {
  return [
    { url: SESSION_URL, handler: () => jsonResponse({ user: account }) },
    { url: `${PROXY}/semesters`, handler: () => jsonResponse(SEMESTERS) },
  ];
}

/** jsdom implements neither object-URL call, so both are stubbed for downloads. */
function stubObjectUrls() {
  Object.defineProperty(URL, 'createObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(() => 'blob:mock'),
  });
  Object.defineProperty(URL, 'revokeObjectURL', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  });
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('official timetable', () => {
  it('renders the pointer version and its stored snapshot values', async () => {
    installFetchMock([...baseRoutes(COLLEGE_ADMIN), { url: PUBLISHED_URL, handler: () => jsonResponse(publishedSchedule()) }]);

    renderScreen(<PublishedTimetableScreen />);

    expect(await screen.findByText('V3')).toBeVisible();
    expect(screen.getByText('r.salim')).toBeVisible();
    // The stored snapshot, not the live course name.
    expect(screen.getByText(/Machine Learning \(stored snapshot\)/)).toBeVisible();
  });

  it('states that the published-version pointer decides what is official', async () => {
    installFetchMock([...baseRoutes(COLLEGE_ADMIN), { url: PUBLISHED_URL, handler: () => jsonResponse(publishedSchedule()) }]);

    renderScreen(<PublishedTimetableScreen />);

    expect(
      await screen.findByText(/published-version pointer, so a newer draft never replaces it/i),
    ).toBeVisible();
  });

  it('never asks for a status filter instead of the pointer', async () => {
    const mock = installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      { url: PUBLISHED_URL, handler: () => jsonResponse(publishedSchedule()) },
    ]);

    renderScreen(<PublishedTimetableScreen />);
    await screen.findByText('V3');

    expect(mock.calls.every((call) => !call.url.includes('status='))).toBe(true);
  });

  it('treats a semester with no publication as an empty state, not a draft', async () => {
    const mock = installFetchMock([
      ...baseRoutes(COLLEGE_ADMIN),
      { url: PUBLISHED_URL, handler: () => jsonResponse({ detail: 'Not found.' }, 404) },
    ]);

    renderScreen(<PublishedTimetableScreen />);

    expect(await screen.findByText('No official timetable has been published yet')).toBeVisible();
    expect(screen.getByText(/A draft is not a publication/)).toBeVisible();
    // No fallback request to a version, entry or draft endpoint was made.
    expect(mock.calls.some((call) => call.url.includes('/schedule-versions'))).toBe(false);
  });

  it('shows the managing department of each session of a college-wide publication', async () => {
    const user = userEvent.setup();
    installFetchMock([
      ...baseRoutes(DEPARTMENT_ADMIN),
      {
        url: PUBLISHED_URL,
        handler: () =>
          jsonResponse(
            publishedSchedule({
              schedule: {
                id: 300,
                scope: 'COLLEGE',
                semester: { id: 8, number: 1, academic_year: { id: 3, start_year: 2026, end_year: 2027 } },
                department: null,
              },
            }),
          ),
      },
    ]);

    renderScreen(<PublishedTimetableScreen />);
    await screen.findByText('V3');
    await user.click(screen.getByRole('button', { name: 'List' }));

    expect(await screen.findByText('Managing department')).toBeVisible();
    expect(screen.getAllByText('BIOAI').length).toBeGreaterThan(0);
  });

  it('restricts the management view to a department account', async () => {
    installFetchMock(baseRoutes(currentUserPayload({ role: 'DEPARTMENT_ADMIN', department: null })));

    renderScreen(<PublishedTimetableScreen />);

    expect(await screen.findByText(/No department is assigned to this account/i)).toBeVisible();
  });
});

describe('instructor timetable', () => {
  it('reads the same published endpoint with instructor copy and no exports', async () => {
    installFetchMock([
      ...baseRoutes(INSTRUCTOR),
      { url: PUBLISHED_URL, handler: () => jsonResponse(publishedSchedule()) },
    ]);

    renderScreen(<PublishedTimetableScreen instructorView />);

    expect(await screen.findByText('Your published sessions')).toBeVisible();
    expect(screen.queryByText('Export the official timetable')).toBeNull();
    expect(screen.queryByText('Official published timetable')).toBeNull();
    expect(screen.queryByRole('link', { name: 'Open this version' })).toBeNull();
  });

  it('reports a semester in which the instructor teaches nothing', async () => {
    installFetchMock([
      ...baseRoutes(INSTRUCTOR),
      { url: PUBLISHED_URL, handler: () => jsonResponse(publishedSchedule({ entries: [] })) },
    ]);

    renderScreen(<PublishedTimetableScreen instructorView />);

    expect(
      await screen.findByText('No published session is assigned to you in this semester.'),
    ).toBeVisible();
  });
});

describe('reports landing', () => {
  it('lists both report families for a report role', async () => {
    installFetchMock(baseRoutes(SCHEDULER));

    renderScreen(<ReportsLandingScreen />);

    expect(await screen.findByText('Version analytics and exports')).toBeVisible();
    expect(screen.getByText('Published analytics and exports')).toBeVisible();
  });

  it('refuses reports to an instructor', async () => {
    installFetchMock(baseRoutes(INSTRUCTOR));

    renderScreen(<ReportsLandingScreen />);

    expect(await screen.findByText(/Reports are not available for your role/i)).toBeVisible();
  });
});

describe('version report', () => {
  const REPORT_URL = `${PROXY}/schedule-versions/501/analytics`;
  const VERSION_URL = `${PROXY}/schedule-versions/501`;

  it('renders the analytics of the exact version, with the version identity', async () => {
    installFetchMock([
      ...baseRoutes(VIEWER),
      { url: REPORT_URL, handler: () => jsonResponse(analyticsResult()) },
      { url: VERSION_URL, handler: () => jsonResponse(scheduleVersionDetail()) },
    ]);

    renderScreen(<VersionReportScreen versionId={501} />);

    expect(await screen.findByText('Version analytics')).toBeVisible();
    expect(screen.getByText('V1')).toBeVisible();
    expect(screen.getByText(/2026–2027 · First semester/)).toBeVisible();
    expect(screen.getByText('12.0 h')).toBeVisible();
  });

  it('states that there is no composite score', async () => {
    installFetchMock([
      ...baseRoutes(VIEWER),
      { url: REPORT_URL, handler: () => jsonResponse(analyticsResult()) },
      { url: VERSION_URL, handler: () => jsonResponse(scheduleVersionDetail()) },
    ]);

    renderScreen(<VersionReportScreen versionId={501} />);

    expect(
      (await screen.findAllByText(/There is no combined quality, efficiency or score value/i)).length,
    ).toBeGreaterThan(0);
    expect(screen.queryByText(/overall score/i)).toBeNull();
  });

  it('states a missing room denominator in words and never shows 0%', async () => {
    installFetchMock([
      ...baseRoutes(VIEWER),
      {
        url: REPORT_URL,
        handler: () =>
          jsonResponse(
            analyticsResult({
              room_utilization: [
                roomUsage({ available_minutes: null, available_hours: null, utilization_percent: null }),
              ],
            }),
          ),
      },
      { url: VERSION_URL, handler: () => jsonResponse(scheduleVersionDetail()) },
    ]);

    renderScreen(<VersionReportScreen versionId={501} />);

    expect(await screen.findByText(ROOM_AVAILABILITY_MISSING_LABEL)).toBeVisible();
    expect(screen.queryByText('0.0%')).toBeNull();
  });

  it('reports utilization above 100 without clamping it', async () => {
    installFetchMock([
      ...baseRoutes(VIEWER),
      {
        url: REPORT_URL,
        handler: () =>
          jsonResponse(
            analyticsResult({
              room_utilization: [
                roomUsage({
                  occupied_minutes: 900,
                  occupied_hours: 15,
                  available_minutes: 600,
                  available_hours: 10,
                  utilization_percent: 150,
                  configuration_mismatch: true,
                }),
              ],
            }),
          ),
      },
      { url: VERSION_URL, handler: () => jsonResponse(scheduleVersionDetail()) },
    ]);

    renderScreen(<VersionReportScreen versionId={501} />);

    expect(await screen.findByText('150.0%')).toBeVisible();
    expect(screen.getByText('exceeds current availability')).toBeVisible();
    expect(
      screen.getByText(/is reported above 100 and is not clamped/i),
    ).toBeVisible();
  });

  it('keeps managed and participating department figures apart', async () => {
    installFetchMock([
      ...baseRoutes(DEPARTMENT_ADMIN),
      {
        url: REPORT_URL,
        handler: () => jsonResponse(analyticsResult({ department_scope: departmentScope() })),
      },
      { url: VERSION_URL, handler: () => jsonResponse(scheduleVersionDetail()) },
    ]);

    renderScreen(<VersionReportScreen versionId={501} />);

    expect(await screen.findByText('Department scope')).toBeVisible();
    expect(screen.getByText('Managed sessions')).toBeVisible();
    expect(screen.getByText('Participating sessions')).toBeVisible();
    expect(screen.getByText(/are never added together/i)).toBeVisible();
  });

  it('refuses version analytics to an instructor', async () => {
    installFetchMock(baseRoutes(INSTRUCTOR));

    renderScreen(<VersionReportScreen versionId={501} />);

    expect(
      await screen.findByText(/Version analytics are not available for your role/i),
    ).toBeVisible();
  });

  it('reports a version outside the caller scope as not found', async () => {
    installFetchMock([
      ...baseRoutes(VIEWER),
      { url: REPORT_URL, handler: () => jsonResponse({ detail: 'Not found.' }, 404) },
      { url: VERSION_URL, handler: () => jsonResponse({ detail: 'Not found.' }, 404) },
    ]);

    renderScreen(<VersionReportScreen versionId={501} />);

    expect(await screen.findByText('Report could not be loaded')).toBeVisible();
    expect(screen.getByText(/existence is not revealed/i)).toBeVisible();
  });

  it('labels the analysed version with its own status and source', async () => {
    installFetchMock([
      ...baseRoutes(VIEWER),
      {
        url: REPORT_URL,
        handler: () =>
          jsonResponse(
            analyticsResult({
              version: {
                ...analyticsResult().version,
                id: 501,
                version_number: 4,
                status: 'PUBLISHED',
                source: 'MANUAL_EDIT',
                published_at: '2026-09-21T12:00:00Z',
              },
            }),
          ),
      },
      { url: VERSION_URL, handler: () => jsonResponse(scheduleVersionDetail({ version_number: 4 })) },
    ]);

    renderScreen(<VersionReportScreen versionId={501} />);

    expect(await screen.findByText(/V4 · Published · Manual edit/)).toBeVisible();
  });
});

describe('published report', () => {
  it('analyses the current publication of the semester', async () => {
    installFetchMock([
      ...baseRoutes(DEPARTMENT_ADMIN),
      {
        url: PUBLISHED_ANALYTICS_URL,
        handler: () => jsonResponse(analyticsResult({ scope: 'COLLEGE' })),
      },
    ]);

    renderScreen(<PublishedReportScreen />);

    expect(await screen.findByText('Published analytics')).toBeVisible();
    expect(screen.getByLabelText('Semester')).toBeVisible();
  });

  it('states that a draft is not a publication', async () => {
    installFetchMock([
      ...baseRoutes(DEPARTMENT_ADMIN),
      { url: PUBLISHED_ANALYTICS_URL, handler: () => jsonResponse({ detail: 'Not found.' }, 404) },
    ]);

    renderScreen(<PublishedReportScreen />);

    expect(await screen.findByText('No official timetable has been published yet')).toBeVisible();
    expect(screen.getByText(/A draft is not a publication/)).toBeVisible();
  });

  it('refuses published analytics to an instructor', async () => {
    installFetchMock(baseRoutes(INSTRUCTOR));

    renderScreen(<PublishedReportScreen />);

    expect(
      await screen.findByText(/Published analytics are not available for your role/i),
    ).toBeVisible();
  });
});

describe('binary exports', () => {
  it('downloads a version workbook and names the saved file', async () => {
    const user = userEvent.setup();
    stubObjectUrls();
    installFetchMock([
      ...baseRoutes(SCHEDULER),
      { url: `${PROXY}/schedule-versions/501/analytics`, handler: () => jsonResponse(analyticsResult()) },
      { url: `${PROXY}/schedule-versions/501`, handler: () => jsonResponse(scheduleVersionDetail()) },
      {
        url: `${PROXY}/schedule-versions/501/export/xlsx`,
        handler: () =>
          binaryResponse(new Uint8Array([80, 75]), EXPORT_MEDIA_TYPES.xlsx, {
            'content-disposition': 'attachment; filename="version-501.xlsx"',
          }),
      },
    ]);

    renderScreen(<VersionReportScreen versionId={501} />);
    await user.click(await screen.findByRole('button', { name: 'Download Excel (.xlsx)' }));

    expect(await screen.findByText('Downloaded version-501.xlsx.')).toBeVisible();
  });

  it('reports the PDF font condition when the server cannot produce the PDF', async () => {
    const user = userEvent.setup();
    stubObjectUrls();
    installFetchMock([
      ...baseRoutes(SCHEDULER),
      { url: `${PROXY}/schedule-versions/501/analytics`, handler: () => jsonResponse(analyticsResult()) },
      { url: `${PROXY}/schedule-versions/501`, handler: () => jsonResponse(scheduleVersionDetail()) },
      {
        url: `${PROXY}/schedule-versions/501/export/pdf`,
        handler: () => jsonResponse({ detail: 'No Unicode font available.' }, 503),
      },
    ]);

    renderScreen(<VersionReportScreen versionId={501} />);
    await user.click(await screen.findByRole('button', { name: 'Download PDF' }));

    expect(await screen.findByText('PDF could not be produced')).toBeVisible();
    expect(screen.getByText(PDF_FONT_UNAVAILABLE_MESSAGE)).toBeVisible();
  });

  it('reports a refused download without pretending a file arrived', async () => {
    const user = userEvent.setup();
    stubObjectUrls();
    installFetchMock([
      ...baseRoutes(VIEWER),
      { url: `${PROXY}/schedule-versions/501/analytics`, handler: () => jsonResponse(analyticsResult()) },
      { url: `${PROXY}/schedule-versions/501`, handler: () => jsonResponse(scheduleVersionDetail()) },
      {
        url: `${PROXY}/schedule-versions/501/export/xlsx`,
        handler: () => jsonResponse({ detail: 'Forbidden.' }, 403),
      },
    ]);

    renderScreen(<VersionReportScreen versionId={501} />);
    await user.click(await screen.findByRole('button', { name: 'Download Excel (.xlsx)' }));

    expect(await screen.findByText('Download not permitted')).toBeVisible();
    expect(screen.queryByText(/^Downloaded /)).toBeNull();
  });

  it('offers the official-timetable export on the published page only', async () => {
    stubObjectUrls();
    installFetchMock([...baseRoutes(COLLEGE_ADMIN), { url: PUBLISHED_URL, handler: () => jsonResponse(publishedSchedule()) }]);

    renderScreen(<PublishedTimetableScreen />);

    expect(await screen.findByText('Export the official timetable')).toBeVisible();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Download Excel (.xlsx)' })).toBeEnabled();
    });
  });

  it('denies the published export to a role that may not download it', async () => {
    installFetchMock([
      ...baseRoutes(INSTRUCTOR),
      { url: PUBLISHED_URL, handler: () => jsonResponse(publishedSchedule()) },
    ]);

    renderScreen(<PublishedTimetableScreen />);
    await screen.findByText('V3');

    expect(screen.queryByRole('button', { name: 'Download Excel (.xlsx)' })).toBeNull();
    expect(screen.getByText('Your role may not download published exports.')).toBeVisible();
  });
});
