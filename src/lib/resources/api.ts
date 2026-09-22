/**
 * Resource API layer.
 *
 * All seventeen F2 collections plus the calendar endpoints, reached through the
 * same-origin BFF. No component in this module knows about the backend host, the
 * cookies or the Authorization header.
 *
 * Query parameters are limited to the exact-match filters the backend documents
 * (`QueryParameterFilterMixin.filter_fields`); nothing else is ever sent.
 */

import {
  collectionPath,
  createRecord,
  getRecord,
  listCollection,
  patchRecord,
  type ListOptions,
} from '@/lib/api/resource';
import type {
  BreakPeriod,
  BreakPeriodWrite,
  CalendarException,
  CalendarExceptionWrite,
  InstructorAvailability,
  InstructorAvailabilityWrite,
  InstructorDepartmentAccess,
  InstructorDepartmentAccessWrite,
  InstructorPreference,
  InstructorPreferenceWrite,
  InstructorProfile,
  InstructorProfileWrite,
  Room,
  RoomAvailability,
  RoomAvailabilityWrite,
  RoomCapability,
  RoomCapabilityAssignment,
  RoomCapabilityAssignmentWrite,
  RoomCapabilityWrite,
  RoomDepartmentAccess,
  RoomDepartmentAccessWrite,
  RoomType,
  RoomTypeWrite,
  RoomWrite,
  TeachingAssignment,
  TeachingAssignmentWrite,
  TeachingComponentCapabilityRequirement,
  TeachingComponentCapabilityRequirementWrite,
  TeachingComponentRoomRequirement,
  TeachingComponentRoomRequirementWrite,
  TimeSlot,
  TimeSlotWrite,
  WorkingDay,
  WorkingDayWrite,
} from '@/lib/resources/types';

/** Backend endpoint segments, relative to the `/api/` prefix. */
export const RESOURCE_ENDPOINTS = {
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
} as const;

export type ResourceEndpoint = (typeof RESOURCE_ENDPOINTS)[keyof typeof RESOURCE_ENDPOINTS];

export function resourcePath(endpoint: ResourceEndpoint, id?: number): string {
  return collectionPath(endpoint, id);
}

export function listResource<T>(
  endpoint: ResourceEndpoint,
  options: ListOptions = {},
): Promise<T[]> {
  return listCollection<T>(endpoint, options);
}

export function getResource<T>(
  endpoint: ResourceEndpoint,
  id: number,
  signal?: AbortSignal,
): Promise<T> {
  return getRecord<T>(endpoint, id, signal);
}

export function createResource<TRead>(
  endpoint: ResourceEndpoint,
  payload: unknown,
  signal?: AbortSignal,
): Promise<TRead> {
  return createRecord<TRead>(endpoint, payload, signal);
}

export function patchResource<TRead>(
  endpoint: ResourceEndpoint,
  id: number,
  payload: unknown,
  signal?: AbortSignal,
): Promise<TRead> {
  return patchRecord<TRead>(endpoint, id, payload, signal);
}

// --- Documented filter shapes --------------------------------------------

export type InstructorFilters = {
  primary_department?: number;
  sharing_scope?: string;
  is_active?: boolean;
};

export type InstructorAccessFilters = {
  instructor?: number;
  department?: number;
  is_active?: boolean;
};

export type InstructorWindowFilters = {
  instructor?: number;
  semester?: number;
  day_of_week?: number;
  preference_type?: string;
  is_active?: boolean;
};

export type AssignmentFilters = {
  instructor?: number;
  teaching_component?: number;
  assignment_role?: string;
  is_active?: boolean;
};

export type RoomFilters = {
  owner_department?: number;
  room_type?: number;
  sharing_scope?: string;
  is_active?: boolean;
};

export type RoomAccessFilters = {
  room?: number;
  department?: number;
  is_active?: boolean;
};

export type RelationshipFilters = {
  room?: number;
  capability?: number;
  room_requirement?: number;
};

export type RoomWindowFilters = {
  room?: number;
  semester?: number;
  day_of_week?: number;
  is_active?: boolean;
};

export type RoomRequirementFilters = {
  teaching_component?: number;
  required_room_type?: number;
  is_active?: boolean;
};

export type WorkingDayFilters = {
  semester?: number;
  day_of_week?: number;
  is_active?: boolean;
};

export type WorkingDayChildFilters = {
  working_day?: number;
  is_active?: boolean;
};

export type CalendarExceptionFilters = {
  semester?: number;
  date?: string;
  exception_type?: string;
  scope_type?: string;
  department?: number;
  instructor?: number;
  room?: number;
  student_group?: number;
  is_active?: boolean;
};

// --- Typed API objects ----------------------------------------------------

export const instructorsApi = {
  list: (filters: InstructorFilters = {}, signal?: AbortSignal) =>
    listResource<InstructorProfile>(RESOURCE_ENDPOINTS.instructors, {
      query: filters,
      signal,
    }),
  create: (payload: InstructorProfileWrite, signal?: AbortSignal) =>
    createResource<InstructorProfile>(RESOURCE_ENDPOINTS.instructors, payload, signal),
  update: (id: number, payload: Partial<InstructorProfileWrite>, signal?: AbortSignal) =>
    patchResource<InstructorProfile>(RESOURCE_ENDPOINTS.instructors, id, payload, signal),
};

export const instructorAccessApi = {
  list: (filters: InstructorAccessFilters = {}, signal?: AbortSignal) =>
    listResource<InstructorDepartmentAccess>(
      RESOURCE_ENDPOINTS.instructorDepartmentAccess,
      { query: filters, signal },
    ),
  create: (payload: InstructorDepartmentAccessWrite, signal?: AbortSignal) =>
    createResource<InstructorDepartmentAccess>(
      RESOURCE_ENDPOINTS.instructorDepartmentAccess,
      payload,
      signal,
    ),
  update: (
    id: number,
    payload: Partial<InstructorDepartmentAccessWrite>,
    signal?: AbortSignal,
  ) =>
    patchResource<InstructorDepartmentAccess>(
      RESOURCE_ENDPOINTS.instructorDepartmentAccess,
      id,
      payload,
      signal,
    ),
};

export const instructorAvailabilityApi = {
  list: (filters: InstructorWindowFilters = {}, signal?: AbortSignal) =>
    listResource<InstructorAvailability>(RESOURCE_ENDPOINTS.instructorAvailability, {
      query: filters,
      signal,
    }),
  create: (payload: InstructorAvailabilityWrite, signal?: AbortSignal) =>
    createResource<InstructorAvailability>(
      RESOURCE_ENDPOINTS.instructorAvailability,
      payload,
      signal,
    ),
  update: (
    id: number,
    payload: Partial<InstructorAvailabilityWrite>,
    signal?: AbortSignal,
  ) =>
    patchResource<InstructorAvailability>(
      RESOURCE_ENDPOINTS.instructorAvailability,
      id,
      payload,
      signal,
    ),
};

export const instructorPreferencesApi = {
  list: (filters: InstructorWindowFilters = {}, signal?: AbortSignal) =>
    listResource<InstructorPreference>(RESOURCE_ENDPOINTS.instructorPreferences, {
      query: filters,
      signal,
    }),
  create: (payload: InstructorPreferenceWrite, signal?: AbortSignal) =>
    createResource<InstructorPreference>(
      RESOURCE_ENDPOINTS.instructorPreferences,
      payload,
      signal,
    ),
  update: (
    id: number,
    payload: Partial<InstructorPreferenceWrite>,
    signal?: AbortSignal,
  ) =>
    patchResource<InstructorPreference>(
      RESOURCE_ENDPOINTS.instructorPreferences,
      id,
      payload,
      signal,
    ),
};

export const teachingAssignmentsApi = {
  list: (filters: AssignmentFilters = {}, signal?: AbortSignal) =>
    listResource<TeachingAssignment>(RESOURCE_ENDPOINTS.teachingAssignments, {
      query: filters,
      signal,
    }),
  create: (payload: TeachingAssignmentWrite, signal?: AbortSignal) =>
    createResource<TeachingAssignment>(
      RESOURCE_ENDPOINTS.teachingAssignments,
      payload,
      signal,
    ),
  update: (id: number, payload: Partial<TeachingAssignmentWrite>, signal?: AbortSignal) =>
    patchResource<TeachingAssignment>(
      RESOURCE_ENDPOINTS.teachingAssignments,
      id,
      payload,
      signal,
    ),
};

export const roomTypesApi = {
  list: (filters: { is_active?: boolean } = {}, signal?: AbortSignal) =>
    listResource<RoomType>(RESOURCE_ENDPOINTS.roomTypes, { query: filters, signal }),
  create: (payload: RoomTypeWrite, signal?: AbortSignal) =>
    createResource<RoomType>(RESOURCE_ENDPOINTS.roomTypes, payload, signal),
  update: (id: number, payload: Partial<RoomTypeWrite>, signal?: AbortSignal) =>
    patchResource<RoomType>(RESOURCE_ENDPOINTS.roomTypes, id, payload, signal),
};

export const roomCapabilitiesApi = {
  list: (filters: { is_active?: boolean } = {}, signal?: AbortSignal) =>
    listResource<RoomCapability>(RESOURCE_ENDPOINTS.roomCapabilities, {
      query: filters,
      signal,
    }),
  create: (payload: RoomCapabilityWrite, signal?: AbortSignal) =>
    createResource<RoomCapability>(RESOURCE_ENDPOINTS.roomCapabilities, payload, signal),
  update: (id: number, payload: Partial<RoomCapabilityWrite>, signal?: AbortSignal) =>
    patchResource<RoomCapability>(RESOURCE_ENDPOINTS.roomCapabilities, id, payload, signal),
};

export const roomsApi = {
  list: (filters: RoomFilters = {}, signal?: AbortSignal) =>
    listResource<Room>(RESOURCE_ENDPOINTS.rooms, { query: filters, signal }),
  create: (payload: RoomWrite, signal?: AbortSignal) =>
    createResource<Room>(RESOURCE_ENDPOINTS.rooms, payload, signal),
  update: (id: number, payload: Partial<RoomWrite>, signal?: AbortSignal) =>
    patchResource<Room>(RESOURCE_ENDPOINTS.rooms, id, payload, signal),
};

export const roomAccessApi = {
  list: (filters: RoomAccessFilters = {}, signal?: AbortSignal) =>
    listResource<RoomDepartmentAccess>(RESOURCE_ENDPOINTS.roomDepartmentAccess, {
      query: filters,
      signal,
    }),
  create: (payload: RoomDepartmentAccessWrite, signal?: AbortSignal) =>
    createResource<RoomDepartmentAccess>(
      RESOURCE_ENDPOINTS.roomDepartmentAccess,
      payload,
      signal,
    ),
  update: (id: number, payload: Partial<RoomDepartmentAccessWrite>, signal?: AbortSignal) =>
    patchResource<RoomDepartmentAccess>(
      RESOURCE_ENDPOINTS.roomDepartmentAccess,
      id,
      payload,
      signal,
    ),
};

export const roomCapabilityAssignmentsApi = {
  list: (filters: RelationshipFilters = {}, signal?: AbortSignal) =>
    listResource<RoomCapabilityAssignment>(
      RESOURCE_ENDPOINTS.roomCapabilityAssignments,
      { query: filters, signal },
    ),
  create: (payload: RoomCapabilityAssignmentWrite, signal?: AbortSignal) =>
    createResource<RoomCapabilityAssignment>(
      RESOURCE_ENDPOINTS.roomCapabilityAssignments,
      payload,
      signal,
    ),
  update: (
    id: number,
    payload: Partial<RoomCapabilityAssignmentWrite>,
    signal?: AbortSignal,
  ) =>
    patchResource<RoomCapabilityAssignment>(
      RESOURCE_ENDPOINTS.roomCapabilityAssignments,
      id,
      payload,
      signal,
    ),
};

export const roomAvailabilityApi = {
  list: (filters: RoomWindowFilters = {}, signal?: AbortSignal) =>
    listResource<RoomAvailability>(RESOURCE_ENDPOINTS.roomAvailability, {
      query: filters,
      signal,
    }),
  create: (payload: RoomAvailabilityWrite, signal?: AbortSignal) =>
    createResource<RoomAvailability>(
      RESOURCE_ENDPOINTS.roomAvailability,
      payload,
      signal,
    ),
  update: (id: number, payload: Partial<RoomAvailabilityWrite>, signal?: AbortSignal) =>
    patchResource<RoomAvailability>(
      RESOURCE_ENDPOINTS.roomAvailability,
      id,
      payload,
      signal,
    ),
};

export const roomRequirementsApi = {
  list: (filters: RoomRequirementFilters = {}, signal?: AbortSignal) =>
    listResource<TeachingComponentRoomRequirement>(
      RESOURCE_ENDPOINTS.teachingComponentRoomRequirements,
      { query: filters, signal },
    ),
  create: (payload: TeachingComponentRoomRequirementWrite, signal?: AbortSignal) =>
    createResource<TeachingComponentRoomRequirement>(
      RESOURCE_ENDPOINTS.teachingComponentRoomRequirements,
      payload,
      signal,
    ),
  update: (
    id: number,
    payload: Partial<TeachingComponentRoomRequirementWrite>,
    signal?: AbortSignal,
  ) =>
    patchResource<TeachingComponentRoomRequirement>(
      RESOURCE_ENDPOINTS.teachingComponentRoomRequirements,
      id,
      payload,
      signal,
    ),
};

export const roomRequirementCapabilitiesApi = {
  list: (filters: RelationshipFilters = {}, signal?: AbortSignal) =>
    listResource<TeachingComponentCapabilityRequirement>(
      RESOURCE_ENDPOINTS.teachingComponentCapabilityRequirements,
      { query: filters, signal },
    ),
  create: (payload: TeachingComponentCapabilityRequirementWrite, signal?: AbortSignal) =>
    createResource<TeachingComponentCapabilityRequirement>(
      RESOURCE_ENDPOINTS.teachingComponentCapabilityRequirements,
      payload,
      signal,
    ),
  update: (
    id: number,
    payload: Partial<TeachingComponentCapabilityRequirementWrite>,
    signal?: AbortSignal,
  ) =>
    patchResource<TeachingComponentCapabilityRequirement>(
      RESOURCE_ENDPOINTS.teachingComponentCapabilityRequirements,
      id,
      payload,
      signal,
    ),
};

export const workingDaysApi = {
  list: (filters: WorkingDayFilters = {}, signal?: AbortSignal) =>
    listResource<WorkingDay>(RESOURCE_ENDPOINTS.workingDays, { query: filters, signal }),
  create: (payload: WorkingDayWrite, signal?: AbortSignal) =>
    createResource<WorkingDay>(RESOURCE_ENDPOINTS.workingDays, payload, signal),
  update: (id: number, payload: Partial<WorkingDayWrite>, signal?: AbortSignal) =>
    patchResource<WorkingDay>(RESOURCE_ENDPOINTS.workingDays, id, payload, signal),
};

export const timeSlotsApi = {
  list: (filters: WorkingDayChildFilters = {}, signal?: AbortSignal) =>
    listResource<TimeSlot>(RESOURCE_ENDPOINTS.timeSlots, { query: filters, signal }),
  create: (payload: TimeSlotWrite, signal?: AbortSignal) =>
    createResource<TimeSlot>(RESOURCE_ENDPOINTS.timeSlots, payload, signal),
  update: (id: number, payload: Partial<TimeSlotWrite>, signal?: AbortSignal) =>
    patchResource<TimeSlot>(RESOURCE_ENDPOINTS.timeSlots, id, payload, signal),
};

export const breakPeriodsApi = {
  list: (filters: WorkingDayChildFilters = {}, signal?: AbortSignal) =>
    listResource<BreakPeriod>(RESOURCE_ENDPOINTS.breakPeriods, { query: filters, signal }),
  create: (payload: BreakPeriodWrite, signal?: AbortSignal) =>
    createResource<BreakPeriod>(RESOURCE_ENDPOINTS.breakPeriods, payload, signal),
  update: (id: number, payload: Partial<BreakPeriodWrite>, signal?: AbortSignal) =>
    patchResource<BreakPeriod>(RESOURCE_ENDPOINTS.breakPeriods, id, payload, signal),
};

export const calendarExceptionsApi = {
  list: (filters: CalendarExceptionFilters = {}, signal?: AbortSignal) =>
    listResource<CalendarException>(RESOURCE_ENDPOINTS.calendarExceptions, {
      query: filters,
      signal,
    }),
  create: (payload: CalendarExceptionWrite, signal?: AbortSignal) =>
    createResource<CalendarException>(
      RESOURCE_ENDPOINTS.calendarExceptions,
      payload,
      signal,
    ),
  update: (id: number, payload: Partial<CalendarExceptionWrite>, signal?: AbortSignal) =>
    patchResource<CalendarException>(
      RESOURCE_ENDPOINTS.calendarExceptions,
      id,
      payload,
      signal,
    ),
};
