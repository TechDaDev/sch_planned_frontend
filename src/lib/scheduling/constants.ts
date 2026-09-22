/**
 * Scheduling constants: backend enum values, display labels, routes and the
 * accepted time-limit ranges.
 *
 * Values are never translated before being sent to the backend; labels exist for
 * presentation only, so a display string can never leak into a request payload.
 */

import type {
  AuditAction,
  GenerationRejectionReason,
  ManualEditRejectionReason,
  ScheduleScope,
  ScheduleStatus,
  ScheduleVersionSource,
  SemesterPlanCreated,
  SessionChangeKind,
  Severity,
  SolverStatus,
  ValidationScope,
  WorkflowAction,
  WorkflowRejectionReason,
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
  versionEdit: (id: number | string) => `/scheduling/versions/${id}/edit`,
  versionWorkflow: (id: number | string) => `/scheduling/versions/${id}/workflow`,
  published: '/published',
  myTimetable: '/my-timetable',
  reports: '/reports',
  versionReport: (id: number | string) => `/reports/version/${id}`,
  publishedReport: '/reports/published',
  importSemesterPlan: '/imports/semester-plan',
  audit: '/audit',
  auditDetail: (id: string) => `/audit/${id}`,
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

/** Roles that may propose and store a manual edit (`SCHEDULE_EDIT_ROLES`). */
export const SCHEDULE_EDIT_ROLES = [
  'COLLEGE_ADMIN',
  'DEPARTMENT_ADMIN',
  'SCHEDULER',
] as const;

/** Roles that may move a version along the workflow (`SCHEDULE_WORKFLOW_ROLES`). */
export const SCHEDULE_WORKFLOW_ROLES = [
  'COLLEGE_ADMIN',
  'DEPARTMENT_ADMIN',
  'SCHEDULER',
] as const;

/** Roles that may read published analytics (`PUBLISHED_ANALYTICS_ROLES`). */
export const PUBLISHED_ANALYTICS_ROLES = [
  'COLLEGE_ADMIN',
  'DEPARTMENT_ADMIN',
  'SCHEDULER',
  'VIEWER',
] as const;

/** Roles that may read the audit trail (`AUDIT_READ_ROLES`). */
export const AUDIT_READ_ROLES = ['COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'] as const;

/** Roles that may import a semester teaching plan (`SEMESTER_PLAN_IMPORT_ROLES`). */
export const SEMESTER_PLAN_IMPORT_ROLES = ['COLLEGE_ADMIN', 'DEPARTMENT_ADMIN'] as const;

/** Roles that may open the reports workspace. */
export const REPORT_ROLES = [
  'COLLEGE_ADMIN',
  'DEPARTMENT_ADMIN',
  'SCHEDULER',
  'VIEWER',
] as const;

// --- Workflow -------------------------------------------------------------

/** `scheduling.services.workflow.service` action names, as the backend reports them. */
export const WORKFLOW_ACTIONS = ['SUBMIT', 'REVIEW', 'APPROVE', 'PUBLISH'] as const;

export const WORKFLOW_ACTION_LABELS: Record<WorkflowAction, string> = {
  SUBMIT: 'Submit for review',
  REVIEW: 'Mark as reviewed',
  APPROVE: 'Approve',
  PUBLISH: 'Publish as official timetable',
};

/** Short verb used on a confirmation button. */
export const WORKFLOW_ACTION_VERBS: Record<WorkflowAction, string> = {
  SUBMIT: 'Submit',
  REVIEW: 'Review',
  APPROVE: 'Approve',
  PUBLISH: 'Publish',
};

/** The single status each action moves a version to. There are no others. */
export const WORKFLOW_TARGET_STATUS: Record<WorkflowAction, ScheduleStatus> = {
  SUBMIT: 'SUBMITTED',
  REVIEW: 'REVIEWED',
  APPROVE: 'APPROVED',
  PUBLISH: 'PUBLISHED',
};

/** The single status each action may be applied from. No backward transitions exist. */
export const WORKFLOW_SOURCE_STATUS: Record<WorkflowAction, ScheduleStatus> = {
  SUBMIT: 'DRAFT',
  REVIEW: 'SUBMITTED',
  APPROVE: 'REVIEWED',
  PUBLISH: 'APPROVED',
};

export const WORKFLOW_REJECTION_LABELS: Record<WorkflowRejectionReason, string> = {
  INVALID_TRANSITION: 'Wrong workflow stage',
  STALE_VERSION: 'A newer version exists',
  DEPARTMENT_SCHEDULE_NOT_PUBLISHABLE: 'Department schedule cannot be published',
  EMPTY_SCHEDULE_CANNOT_BE_PUBLISHED: 'Empty schedule cannot be published',
  SCHEDULE_VALIDATION_FAILED: 'Validation failed',
};

export const WORKFLOW_REJECTION_HELP: Record<WorkflowRejectionReason, string> = {
  INVALID_TRANSITION:
    'This action is not allowed from the version’s current status. Refresh to see the latest stage.',
  STALE_VERSION:
    'A newer version now exists. Refresh the schedule history before acting again.',
  DEPARTMENT_SCHEDULE_NOT_PUBLISHABLE:
    'A department schedule can be approved, but only a college-wide schedule becomes the official timetable.',
  EMPTY_SCHEDULE_CANNOT_BE_PUBLISHED:
    'This version stores no session, so there is nothing to publish.',
  SCHEDULE_VALIDATION_FAILED:
    'The stored timetable no longer passes validation against current configuration.',
};

export const MANUAL_EDIT_REJECTION_LABELS: Record<ManualEditRejectionReason, string> = {
  MANUAL_EDIT_VALIDATION_FAILED: 'Proposed change is invalid',
  BASE_VERSION_NOT_DRAFT: 'Only a draft can be edited',
  STALE_BASE_VERSION: 'A newer version exists',
};

export const MANUAL_EDIT_REJECTION_HELP: Record<ManualEditRejectionReason, string> = {
  MANUAL_EDIT_VALIDATION_FAILED:
    'The proposed timetable was refused. Nothing was stored.',
  BASE_VERSION_NOT_DRAFT:
    'Only the newest DRAFT version of a schedule can be edited. This version has already moved on.',
  STALE_BASE_VERSION:
    'A newer version now exists. Refresh the schedule history before editing again.',
};

// --- Publication ----------------------------------------------------------

/** States that mean a version is (or was) part of the official timetable. */
export const PUBLISHED_STATUS: ScheduleStatus = 'PUBLISHED';

export const OFFICIAL_TIMETABLE_NOTICE =
  'This is the official published timetable. It comes from the schedule’s published-version pointer, so a newer draft never replaces it.';

export const PUBLICATION_POINTER_NOTICE =
  'Several versions may carry the PUBLISHED status over time. The published-version pointer decides which one is official right now.';

export const WORKFLOW_VALIDATION_CURRENT_CONFIG_NOTICE =
  'Workflow validation measures this stored version against today’s configuration. A version that was valid when it was created can be reported here as stale, because components, assignments, group links, room requirements, sharing, availability and the time grid may have changed since. Stored snapshots keep history readable; they do not keep a timetable valid forever.';

export const MANUAL_EDIT_CONTENT_NOTICE =
  'A manual edit moves placement only. The course, offering, component, instructors, student groups, session ordinal and every stored snapshot value stay exactly as the version recorded them.';

export const MANUAL_EDIT_BATCH_NOTICE =
  'All pending changes are validated and applied as one final timetable state. Send a swap as two changes in the same proposal.';

// --- Analytics ------------------------------------------------------------

export const ROOM_UTILIZATION_BASIS_NOTICE =
  'Room utilization compares the stored occupancy of this version with the room availability configured today, so it is not purely historical.';

export const ROOM_AVAILABILITY_MISSING_LABEL = 'Current availability denominator unavailable';

export const ROOM_UTILIZATION_MISMATCH_NOTICE =
  'Historical occupancy exceeds the currently configured availability. The percentage is reported above 100 and is not clamped.';

export const DEPARTMENT_SCOPE_NOTICE =
  'Managed means this department owns the teaching. Participating means the session is a joint session managed elsewhere that this department’s groups attend. The two are separate figures and are never added together.';

export const NO_COMPOSITE_SCORE_NOTICE =
  'These are interpretable figures. There is no combined quality, efficiency or score value, because the backend computes none.';

// --- Exports --------------------------------------------------------------

export const EXPORT_FALLBACK_FILENAMES = {
  versionXlsx: 'schedule_version.xlsx',
  versionPdf: 'schedule_version.pdf',
  publishedXlsx: 'published_schedule.xlsx',
  publishedPdf: 'published_schedule.pdf',
  template: 'semester_teaching_plan_template.xlsx',
} as const;

export const PDF_FONT_UNAVAILABLE_MESSAGE =
  'The server could not resolve a Unicode-capable font, so no PDF was produced. The Excel export is unaffected.';

// --- Imports --------------------------------------------------------------

export const IMPORT_SHEETS = [
  'courses',
  'student_groups',
  'offerings',
  'components',
  'component_group_links',
  'teaching_assignments',
  'room_requirements',
  'requirement_capabilities',
] as const;

/** Counts of the apply response, in the order the contract lists them. */
export const IMPORT_CREATED_FIELDS: readonly {
  key: keyof SemesterPlanCreated;
  label: string;
}[] = [
  { key: 'courses', label: 'Courses' },
  { key: 'student_groups', label: 'Student groups' },
  { key: 'offerings', label: 'Offerings' },
  { key: 'components', label: 'Teaching components' },
  { key: 'component_group_links', label: 'Component / group links' },
  { key: 'teaching_assignments', label: 'Teaching assignments' },
  { key: 'room_requirements', label: 'Room requirements' },
  { key: 'requirement_capabilities', label: 'Required capabilities' },
];

export const IMPORT_SAFETY_NOTICE = [
  'Import creates semester teaching-plan setup only.',
  'It does not import timetable placements.',
  'It does not overwrite existing records: the import is create-only.',
  'It does not create instructors or rooms.',
] as const;

export const IMPORT_REVALIDATION_NOTICE =
  'Apply re-reads and fully re-validates the workbook on the server. The validation result shown here is guidance, never authority.';

export const IMPORT_VALIDATION_STALE_NOTICE =
  'The selected file, department or semester changed since this validation ran. Validate again before applying.';

/** Client-side guard only; the backend remains authoritative. */
export const IMPORT_MAX_FILE_BYTES = 20 * 1024 * 1024;
export const IMPORT_ACCEPTED_EXTENSION = '.xlsx';

// --- Audit ----------------------------------------------------------------

export const AUDIT_ACTION_LABELS: Record<AuditAction, string> = {
  DEPARTMENT_DRAFT_GENERATED: 'Department draft generated',
  COLLEGE_DRAFT_GENERATED: 'College draft generated',
  MANUAL_EDIT_APPLIED: 'Manual edit applied',
  SCHEDULE_SUBMITTED: 'Schedule version submitted',
  SCHEDULE_REVIEWED: 'Schedule version reviewed',
  SCHEDULE_APPROVED: 'Schedule version approved',
  SCHEDULE_PUBLISHED: 'Schedule version published',
  SEMESTER_PLAN_IMPORTED: 'Semester teaching plan imported',
};

export const AUDIT_ACTIONS: readonly AuditAction[] = [
  'DEPARTMENT_DRAFT_GENERATED',
  'COLLEGE_DRAFT_GENERATED',
  'MANUAL_EDIT_APPLIED',
  'SCHEDULE_SUBMITTED',
  'SCHEDULE_REVIEWED',
  'SCHEDULE_APPROVED',
  'SCHEDULE_PUBLISHED',
  'SEMESTER_PLAN_IMPORTED',
];

export const AUDIT_ACTION_OPTIONS: readonly Option<AuditAction>[] = AUDIT_ACTIONS.map(
  (action) => ({ value: action, label: AUDIT_ACTION_LABELS[action] }),
);

export const AUDIT_SNAPSHOT_NOTICE =
  'The actor username and role are the values recorded when the operation happened. They are shown instead of the current account, so the trail still reads correctly after a rename or a removal.';
