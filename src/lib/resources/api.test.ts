import { describe, expect, it } from 'vitest';

import {
  RESOURCE_ENDPOINTS,
  breakPeriodsApi,
  calendarExceptionsApi,
  instructorAccessApi,
  instructorAvailabilityApi,
  instructorPreferencesApi,
  instructorsApi,
  resourcePath,
  roomAccessApi,
  roomAvailabilityApi,
  roomCapabilityAssignmentsApi,
  roomCapabilitiesApi,
  roomRequirementCapabilitiesApi,
  roomRequirementsApi,
  roomTypesApi,
  roomsApi,
  teachingAssignmentsApi,
  timeSlotsApi,
  workingDaysApi,
} from '@/lib/resources/api';
import { ApiClientError } from '@/lib/api/errors';
import { installFetchMock, jsonResponse } from '@/test/fetch-mock';
import {
  breakPeriodRow,
  instructorAccessRow,
  instructorAvailabilityRow,
  instructorPreferenceRow,
  instructorRow,
  roomAccessRow,
  roomAvailabilityRow,
  roomCapabilityAssignmentRow,
  roomCapabilityRow,
  roomRequirementRow,
  roomRow,
  roomTypeRow,
  teachingAssignmentRow,
  timeSlotRow,
  workingDayRow,
} from '@/test/resource-fixtures';

const PROXY = '/api/backend';

const ALL_APIS = {
  instructorsApi,
  instructorAccessApi,
  instructorAvailabilityApi,
  instructorPreferencesApi,
  teachingAssignmentsApi,
  roomTypesApi,
  roomCapabilitiesApi,
  roomsApi,
  roomAccessApi,
  roomCapabilityAssignmentsApi,
  roomAvailabilityApi,
  roomRequirementsApi,
  roomRequirementCapabilitiesApi,
  workingDaysApi,
  timeSlotsApi,
  breakPeriodsApi,
  calendarExceptionsApi,
} as const;

describe('resource endpoints', () => {
  it('matches the accepted backend routes exactly', () => {
    expect(RESOURCE_ENDPOINTS).toEqual({
      instructors: 'instructors',
      instructorDepartmentAccess: 'instructor-department-access',
      instructorAvailability: 'instructor-availability',
      instructorPreferences: 'instructor-preferences',
      teachingAssignments: 'teaching-assignments',
      roomTypes: 'room-types',
      roomCapabilities: 'room-capabilities',
      rooms: 'rooms',
      roomDepartmentAccess: 'room-department-access',
      roomCapabilityAssignments: 'room-capability-assignments',
      roomAvailability: 'room-availability',
      teachingComponentRoomRequirements: 'teaching-component-room-requirements',
      teachingComponentCapabilityRequirements: 'teaching-component-capability-requirements',
      workingDays: 'working-days',
      timeSlots: 'time-slots',
      breakPeriods: 'break-periods',
      calendarExceptions: 'calendar-exceptions',
    });
  });

  it('builds collection and detail paths', () => {
    expect(resourcePath('rooms')).toBe('rooms');
    expect(resourcePath('rooms', 22)).toBe('rooms/22');
  });

  it('lists every F2 collection through the same-origin proxy', async () => {
    const mock = installFetchMock(
      Object.values(RESOURCE_ENDPOINTS).map((endpoint) => ({
        url: `${PROXY}/${endpoint}`,
        handler: () => jsonResponse([]),
      })),
    );

    await Promise.all(
      Object.values(ALL_APIS).map((api) =>
        (api as { list: (filters?: object, signal?: AbortSignal) => Promise<unknown[]> }).list(),
      ),
    );

    expect(mock.calls).toHaveLength(Object.keys(RESOURCE_ENDPOINTS).length);
    expect(mock.calls.every((call) => call.method === 'GET')).toBe(true);
  });
});

describe('resource reads', () => {
  it('returns instructor rows with a null linked account and no token data', async () => {
    installFetchMock([
      {
        url: `${PROXY}/instructors`,
        handler: () => jsonResponse([instructorRow()]),
      },
    ]);

    const instructors = await instructorsApi.list();

    expect(instructors[0]?.user).toBeNull();
    expect(instructors[0]?.sharing_scope).toBe('PRIVATE');
  });

  it('sends only documented filters', async () => {
    const mock = installFetchMock([
      {
        url: `${PROXY}/instructor-availability?instructor=1&semester=8&is_active=true`,
        handler: () => jsonResponse([instructorAvailabilityRow()]),
      },
    ]);

    await instructorAvailabilityApi.list({
      instructor: 1,
      semester: 8,
      is_active: true,
    });

    expect(mock.calls[0]?.url).toBe(
      `${PROXY}/instructor-availability?instructor=1&semester=8&is_active=true`,
    );
  });

  it('omits empty filter values entirely', async () => {
    const mock = installFetchMock([
      {
        url: `${PROXY}/rooms`,
        handler: () => jsonResponse([roomRow()]),
      },
    ]);

    await roomsApi.list({ is_active: undefined, sharing_scope: undefined });

    expect(mock.calls[0]?.url).toBe(`${PROXY}/rooms`);
  });

  it('rejects an unexpected non-array payload', async () => {
    installFetchMock([
      { url: `${PROXY}/rooms`, handler: () => jsonResponse({ results: [] }) },
    ]);

    await expect(roomsApi.list()).rejects.toMatchObject({
      status: 500,
      code: 'unexpected_response',
    });
  });
});

describe('resource writes', () => {
  it('creates an instructor with POST and never sends a user id', async () => {
    const mock = installFetchMock([
      {
        url: `${PROXY}/instructors`,
        method: 'POST',
        handler: () => jsonResponse(instructorRow(), 201),
      },
    ]);

    await instructorsApi.create({
      full_name: 'Rana Salim',
      staff_code: 'I-1042',
      academic_title: 'Assistant Lecturer',
      primary_department: 2,
      sharing_scope: 'PRIVATE',
      max_weekly_hours: '18.00',
      max_daily_hours: '5.00',
      is_active: true,
    });

    const body = String(mock.calls[0]?.init.body);
    expect(mock.calls[0]?.method).toBe('POST');
    expect(body).not.toContain('"user"');
    expect(body).toContain('"primary_department":2');
  });

  it('patches a room with PATCH', async () => {
    const mock = installFetchMock([
      {
        url: `${PROXY}/rooms/22`,
        method: 'PATCH',
        handler: () => jsonResponse(roomRow({ capacity: 40 })),
      },
    ]);

    const updated = await roomsApi.update(22, { capacity: 40 });

    expect(updated.capacity).toBe(40);
    expect(mock.calls[0]?.init.body).toBe(JSON.stringify({ capacity: 40 }));
  });

  it('patches a sharing grant', async () => {
    const mock = installFetchMock([
      {
        url: `${PROXY}/room-department-access/23`,
        method: 'PATCH',
        handler: () => jsonResponse(roomAccessRow({ is_active: false })),
      },
    ]);

    await roomAccessApi.update(23, { is_active: false });

    expect(mock.calls[0]?.init.body).toBe(JSON.stringify({ is_active: false }));
  });

  it('exposes no delete helper and never issues DELETE', async () => {
    for (const [name, api] of Object.entries(ALL_APIS)) {
      expect(Object.keys(api), `${name} must not expose a delete helper`).not.toContain(
        'delete',
      );
      expect(Object.keys(api)).not.toContain('remove');
    }

    const mock = installFetchMock([
      {
        url: `${PROXY}/room-capability-assignments`,
        method: 'POST',
        handler: () => jsonResponse(roomCapabilityAssignmentRow(), 201),
      },
      {
        url: `${PROXY}/teaching-assignments/5`,
        method: 'PATCH',
        handler: () => jsonResponse(teachingAssignmentRow({ is_active: false })),
      },
    ]);

    await roomCapabilityAssignmentsApi.create({ room: 22, capability: 21 });
    await teachingAssignmentsApi.update(5, { is_active: false });

    expect(mock.calls.every((call) => call.method !== 'DELETE')).toBe(true);
  });
});

describe('read/write representation split', () => {
  it('writes a working day with a semester id and reads back a summary', async () => {
    const mock = installFetchMock([
      {
        url: `${PROXY}/working-days`,
        method: 'POST',
        handler: () => jsonResponse(workingDayRow(), 201),
      },
    ]);

    const created = await workingDaysApi.create({
      semester: 8,
      day_of_week: 0,
      start_time: '08:00',
      end_time: '16:00',
      is_active: true,
    });

    expect(mock.calls[0]?.init.body).toBe(
      JSON.stringify({
        semester: 8,
        day_of_week: 0,
        start_time: '08:00',
        end_time: '16:00',
        is_active: true,
      }),
    );
    expect(created.semester).toMatchObject({ id: 8, number: 1 });
    expect(created.day_of_week_code).toBe('SUNDAY');
  });

  it('reads derived values that are never submitted', async () => {
    installFetchMock([
      {
        url: `${PROXY}/teaching-component-room-requirements`,
        handler: () => jsonResponse([roomRequirementRow()]),
      },
    ]);

    const requirements = await roomRequirementsApi.list();

    expect(requirements[0]?.expected_student_count).toBe(35);
    expect(requirements[0]?.effective_minimum_capacity).toBe(40);
    expect(requirements[0]?.required_capabilities).toHaveLength(1);
  });

  it('reads time slots with a derived duration', async () => {
    installFetchMock([
      { url: `${PROXY}/time-slots`, handler: () => jsonResponse([timeSlotRow()]) },
    ]);

    const [slot] = await timeSlotsApi.list();

    expect(slot?.duration_minutes).toBe(90);
    expect(slot?.working_day).toMatchObject({ id: 30, day_of_week: 0 });
  });
});

describe('resource backend errors', () => {
  it('preserves DRF field errors, including the window overlap message', async () => {
    installFetchMock([
      {
        url: `${PROXY}/instructor-availability`,
        method: 'POST',
        handler: () =>
          jsonResponse(
            {
              start_time:
                'This window overlaps another active availability end time for that weekday.',
              non_field_errors: ['Unexpected server rule.'],
            },
            400,
          ),
      },
    ]);

    const error = await instructorAvailabilityApi
      .create({
        instructor: 1,
        semester: 8,
        day_of_week: 0,
        start_time: '08:00',
        end_time: '12:00',
        is_active: true,
      })
      .catch((cause: unknown) => cause as ApiClientError);

    const apiError = (error as ApiClientError).toApiError();
    expect(apiError.status).toBe(400);
    expect(apiError.fieldErrors?.start_time?.[0]).toContain('overlaps');
    expect(apiError.fieldErrors?.non_field_errors).toEqual(['Unexpected server rule.']);
  });

  it('surfaces the ineligible instructor refusal', async () => {
    installFetchMock([
      {
        url: `${PROXY}/teaching-assignments`,
        method: 'POST',
        handler: () =>
          jsonResponse(
            {
              instructor:
                'This instructor is not allowed to teach in the managing department of the offering.',
            },
            400,
          ),
      },
    ]);

    const error = await teachingAssignmentsApi
      .create({
        teaching_component: 10,
        instructor: 1,
        assignment_role: 'PRIMARY',
        is_active: true,
      })
      .catch((cause: unknown) => cause as ApiClientError);

    expect((error as ApiClientError).fieldErrors?.instructor?.[0]).toContain(
      'not allowed to teach',
    );
  });

  it('surfaces the single-primary refusal', async () => {
    installFetchMock([
      {
        url: `${PROXY}/teaching-assignments`,
        method: 'POST',
        handler: () =>
          jsonResponse(
            {
              assignment_role:
                'This teaching component already has an active primary instructor.',
            },
            400,
          ),
      },
    ]);

    const error = await teachingAssignmentsApi
      .create({
        teaching_component: 10,
        instructor: 1,
        assignment_role: 'PRIMARY',
        is_active: true,
      })
      .catch((cause: unknown) => cause as ApiClientError);

    expect((error as ApiClientError).fieldErrors?.assignment_role?.[0]).toContain(
      'already has an active primary instructor',
    );
  });

  it('keeps 403, 404, 409 and 500 statuses intact', async () => {
    for (const [status, message] of [
      [403, 'You may only manage records in your own department.'],
      [404, 'Not found.'],
      [409, 'The request conflicts with the current state.'],
      [500, 'Internal Server Error'],
    ] as const) {
      installFetchMock([
        {
          url: `${PROXY}/rooms/22`,
          method: 'PATCH',
          handler: () => jsonResponse({ detail: message }, status),
        },
      ]);

      await expect(roomsApi.update(22, { capacity: 10 })).rejects.toMatchObject({
        status,
        detail: message,
      });
    }
  });

  it('preserves the exception scope/target refusal', async () => {
    installFetchMock([
      {
        url: `${PROXY}/calendar-exceptions`,
        method: 'POST',
        handler: () =>
          jsonResponse(
            {
              scope_type: 'Only college administrators may manage college-wide exceptions.',
            },
            400,
          ),
      },
    ]);

    const error = await calendarExceptionsApi
      .create({
        semester: 8,
        date: '2026-10-01',
        exception_type: 'HOLIDAY',
        scope_type: 'COLLEGE',
        title: 'Founding day',
        description: '',
        start_time: null,
        end_time: null,
        is_active: true,
      })
      .catch((cause: unknown) => cause as ApiClientError);

    expect((error as ApiClientError).fieldErrors?.scope_type?.[0]).toContain(
      'college administrators',
    );
  });

  it('keeps relationship rows free of an is_active field in their payloads', async () => {
    const mock = installFetchMock([
      {
        url: `${PROXY}/room-capability-assignments`,
        method: 'POST',
        handler: () => jsonResponse(roomCapabilityAssignmentRow(), 201),
      },
      {
        url: `${PROXY}/teaching-component-capability-requirements`,
        method: 'POST',
        handler: () =>
          jsonResponse(
            {
              id: 27,
              room_requirement: {
                id: 26,
                teaching_component: { id: 10, component_type: 'THEORY', label: '' },
                minimum_capacity: null,
              },
              capability: { id: 21, name: 'Computers', code: 'COMPUTERS' },
              created_at: '2026-09-01T08:00:00Z',
            },
            201,
          ),
      },
    ]);

    await roomCapabilityAssignmentsApi.create({ room: 22, capability: 21 });
    await roomRequirementCapabilitiesApi.create({
      room_requirement: 26,
      capability: 21,
    });

    expect(mock.calls[0]?.init.body).toBe(
      JSON.stringify({ room: 22, capability: 21 }),
    );
    expect(String(mock.calls[1]?.init.body)).not.toContain('is_active');
  });

  it('reads instructor preferences with their display values', async () => {
    installFetchMock([
      {
        url: `${PROXY}/instructor-preferences`,
        handler: () => jsonResponse([instructorPreferenceRow()]),
      },
    ]);

    const [preference] = await instructorPreferencesApi.list();

    expect(preference?.preference_type).toBe('AVOID');
    expect(preference?.preference_type_display).toBe('Avoid');
  });
});

describe('fixture sanity', () => {
  it('covers the shapes the screens rely on', () => {
    expect(instructorAccessRow().department.id).toBe(99);
    expect(breakPeriodRow().working_day.id).toBe(30);
    expect(roomTypeRow().code).toBe('LECTURE_HALL');
    expect(roomCapabilityRow().code).toBe('COMPUTERS');
    expect(roomAvailabilityRow().room.id).toBe(22);
  });
});
