/**
 * Scheduling constants: backend enum values, display labels, routes and the
 * accepted time-limit ranges.
 *
 * Values are never translated before being sent to the backend; labels exist for
 * presentation only, so a display string can never leak into a request payload.
 */

import type {
  GenerationRejectionReason,
  ScheduleScope,
  ScheduleStatus,
  ScheduleVersionSource,
  SessionChangeKind,
  Severity,
  SolverStatus,
  ValidationScope,
} from '@/lib/scheduling/types';

export interface Option<TValue extends string> {
  value: TValue;
  label: string;
}

// --- Time limits ----------------------------------------------------------

/** Department generation: `1`–`120` seconds, backend default `30`. */
export const DEPARTMENT_TIME_LIMIT = {
  min: 1,
  max: 120,
  default: 30,
} as const;

/** College-wide generation: `1`–`300` seconds, backend default `60`. */
export const COLLEGE_TIME_LIMIT = {
  min: 1,
  max: 300,
  default: 60,
} as const;

/** `scheduling.serializers.SCHEDULE_NOTES_MAX_LENGTH`. */
export const NOTES_MAX_LENGTH = 2000;

/** `academics.models.Weekday` order: Sunday first, Thursday last. */
export const WEEKDAY_ORDER: readonly number[] = [0, 1, 2, 3, 4];

export const WEEKDAY_LABELS: Record<number, string> = {
  0: 'Sunday',
  1: 'Monday',
  2: 'Tuesday',
  3: 'Wednesday',
  4: 'Thursday',
};

// --- Enum labels ----------------------------------------------------------

export const SEVERITY_LABELS: Record<Severity, string> = {
  ERROR: 'Error',
  WARNING: 'Warning',
};

export const VALIDATION_SCOPE_LABELS: Record<ValidationScope, string> = {
  COLLEGE: 'College-wide',
  DEPARTMENT: 'Department',
};

export const SCHEDULE_SCOPE_LABELS: Record<ScheduleScope, string> = {
  COLLEGE: 'College-wide',
  DEPARTMENT: 'Department',
};

/**
 * Solver status labels.
 *
 * `FEASIBLE` is deliberately a different label from `OPTIMAL`: a valid timetable
 * was found, but optimality was not proven.
 */
export const SOLVER_STATUS_LABELS: Record<SolverStatus, string> = {
  OPTIMAL: 'Optimal (optimum proven)',
  FEASIBLE: 'Feasible (valid timetable, optimum not proven)',
  INFEASIBLE: 'No timetable found',
  MODEL_INVALID: 'Model invalid',
  UNKNOWN: 'No result within the solve outcome',
};

/** One-line explanation shown next to a solver status. */
export const SOLVER_STATUS_HELP: Record<SolverStatus, string> = {
  OPTIMAL: 'A valid timetable was produced and proven optimal.',
  FEASIBLE: 'A valid timetable was produced; the solver did not prove it optimal.',
  INFEASIBLE: 'The solver proved that no timetable exists for the current data.',
  MODEL_INVALID: 'The solver model was invalid, so no timetable was produced.',
  UNKNOWN: 'The solve ended without a successful result.',
};

export const SCHEDULE_STATUS_LABELS: Record<ScheduleStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  REVIEWED: 'Reviewed',
  APPROVED: 'Approved',
  PUBLISHED: 'Published',
};

/**
 * Badge tones for version statuses.
 *
 * Every tone is paired with the status label, so a lifecycle state is never
 * communicated by colour alone.
 */
export const SCHEDULE_STATUS_TONES: Record<
  ScheduleStatus,
  'neutral' | 'info' | 'success' | 'warning' | 'danger'
> = {
  DRAFT: 'neutral',
  SUBMITTED: 'info',
  REVIEWED: 'info',
  APPROVED: 'success',
  PUBLISHED: 'success',
};

export const SCHEDULE_VERSION_SOURCE_LABELS: Record<ScheduleVersionSource, string> = {
  DEPARTMENT_GENERATION: 'Department generation',
  COLLEGE_GENERATION: 'College generation',
  MANUAL_EDIT: 'Manual edit',
};

export const GENERATION_REJECTION_LABELS: Record<GenerationRejectionReason, string> = {
  PRE_SCHEDULING_VALIDATION_FAILED: 'Configuration not ready',
  CANDIDATE_BUILD_FAILED: 'No placement candidates',
  GENERATION_RESULT_INCOMPLETE: 'Generation result incomplete',
};

export const GENERATION_REJECTION_HELP: Record<GenerationRejectionReason, string> = {
  PRE_SCHEDULING_VALIDATION_FAILED:
    'Readiness validation reported blocking errors, so generation never started.',
  CANDIDATE_BUILD_FAILED:
    'At least one session had no placement candidate, so the solver never ran.',
  GENERATION_RESULT_INCOMPLETE:
    'Generation completed without a complete timetable, so nothing was stored.',
};

export const SESSION_CHANGE_LABELS: Record<SessionChangeKind, string> = {
  UNCHANGED: 'Unchanged',
  TIME_CHANGED: 'Time changed',
  ROOM_CHANGED: 'Room changed',
  TIME_AND_ROOM_CHANGED: 'Time and room changed',
  CONTENT_CHANGED: 'Content changed',
  PENALTY_CHANGED: 'Penalty changed',
  ADDED: 'Added',
  REMOVED: 'Removed',
};

export const VALIDATION_SCOPE_OPTIONS: readonly Option<ValidationScope>[] = [
  { value: 'DEPARTMENT', label: 'One department' },
  { value: 'COLLEGE', label: 'Whole college' },
];

export const SCHEDULE_SCOPE_OPTIONS: readonly Option<ScheduleScope>[] = [
  { value: 'DEPARTMENT', label: 'Department' },
  { value: 'COLLEGE', label: 'College-wide' },
];

// --- Copy that states what the feature does and does not do ---------------

/**
 * Readiness is a stored-data check, not the solver: saying "feasible" here would
 * claim something validation never computes.
 */
export const READINESS_READY_MESSAGE = 'Configuration is ready for generation.';

export const READINESS_NOT_READY_MESSAGE =
  'Blocking errors were found. Generation cannot start until they are fixed.';

export const READINESS_SCOPE_NOTE =
  'Readiness validation checks stored data only. It does not place sessions, resolve collisions, assign rooms, prove feasibility or apply calendar exceptions to the recurring weekly grid.';

export const PREVIEW_ONLY_MESSAGE =
  'Preview only. No schedule version is saved.';

export const PERSIST_DRAFT_MESSAGE =
  'The server performs a new validated generation run and stores its result as the next immutable draft version.';

export const NEW_VERSION_MESSAGE = 'New immutable draft version created.';

export const IMMUTABILITY_MESSAGE =
  'Stored schedules and versions are immutable. Regenerating appends a new version instead of changing an existing one.';

export const SNAPSHOT_MESSAGE =
  'Every value below is the snapshot stored with this version. Renaming a course, room, department, instructor or group later does not change it.';

export const GENERATION_DURATION_NOTE =
  'Generation runs on the server and can take from seconds up to the time limit. The backend does not stream progress, so no percentage is shown.';

/** Shown when a department-scoped schedule has no department summary. */
export const DEPARTMENT_SCOPED_PLACEHOLDER = 'Department schedule';

/** Scheduling workspace routes. */
export const SCHEDULING_ROUTES = {
  overview: '/scheduling',
  readiness: '/scheduling/readiness',
  generate: '/scheduling/generate',
  schedules: '/scheduling/schedules',
  compare: '/scheduling/compare',
  scheduleDetail: (id: number | string) => `/scheduling/schedules/${id}`,
  versionDetail: (id: number | string) => `/scheduling/versions/${id}`,
} as const;

/** Roles that may run validation and generation (`CanRunPreSchedulingValidation`). */
export const SCHEDULING_OPERATIONAL_ROLES = [
  'COLLEGE_ADMIN',
  'DEPARTMENT_ADMIN',
  'SCHEDULER',
] as const;

/** Roles that may read persisted schedules (`SCHEDULE_READ_ROLES`). */
export const SCHEDULE_READ_ROLES = [
  'COLLEGE_ADMIN',
  'DEPARTMENT_ADMIN',
  'SCHEDULER',
  'VIEWER',
] as const;
