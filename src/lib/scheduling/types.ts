/**
 * Scheduling domain models.
 *
 * Field names mirror the accepted backend exactly (`scheduling/serializers.py`,
 * Backend API v1.0.0). The scheduling API is read-only plus two generation
 * actions: there is no update or delete representation, so no such DTO exists
 * here either.
 *
 * Three representations are kept apart on purpose:
 * - the **preview** payload of `POST /api/scheduling/generate[-college]/`, which
 *   is never stored;
 * - the **persisted** payload of the schedule and version read APIs, whose every
 *   display value is a snapshot taken when the version was written;
 * - the frontend-owned `TimetableSession`, produced from either of the two so a
 *   single visualization can render both.
 */

import type {
  CourseSummary,
  DepartmentSummary,
  IsoDateTime,
  SemesterSummary,
} from '@/lib/academic/types';

export type {
  CourseSummary,
  DepartmentSummary,
  IsoDateTime,
  SemesterSummary,
};

// --- Enumerations (backend choices, never translated before being sent) ----

/** `scheduling.services.validation.ValidationScope`. */
export type ValidationScope = 'COLLEGE' | 'DEPARTMENT';

/** `scheduling.services.validation.issues.Severity`. */
export type Severity = 'ERROR' | 'WARNING';

/**
 * `scheduling.services.solver.result.SolverStatus`.
 *
 * `OPTIMAL` and `FEASIBLE` carry placements; the other three never do.
 */
export type SolverStatus =
  | 'OPTIMAL'
  | 'FEASIBLE'
  | 'INFEASIBLE'
  | 'MODEL_INVALID'
  | 'UNKNOWN';

/** `scheduling.models.ScheduleScope`. */
export type ScheduleScope = 'DEPARTMENT' | 'COLLEGE';

/** `scheduling.models.ScheduleStatus`. */
export type ScheduleStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'REVIEWED'
  | 'APPROVED'
  | 'PUBLISHED';

/** `scheduling.models.ScheduleVersionSource`. */
export type ScheduleVersionSource =
  | 'DEPARTMENT_GENERATION'
  | 'COLLEGE_GENERATION'
  | 'MANUAL_EDIT';

/** Refusal reasons of the generation and draft endpoints. */
export type GenerationRejectionReason =
  | 'PRE_SCHEDULING_VALIDATION_FAILED'
  | 'CANDIDATE_BUILD_FAILED'
  | 'GENERATION_RESULT_INCOMPLETE';

// --- Readiness (Phase 7) --------------------------------------------------

/**
 * Semester identity of a scheduling response.
 *
 * Unlike `SemesterSummary`, `academic_year` is the human label (`"2026-2027"`)
 * and the id is a separate field, so both are typed explicitly.
 */
export interface ValidationSemester {
  id: number;
  number: number;
  academic_year: string;
  academic_year_id: number;
}

/** Scalar values a validation or generation issue may carry. */
export type IssueDetails = Record<string, unknown>;

export interface ValidationIssue {
  code: string;
  severity: Severity;
  message: string;
  entity_type: string;
  entity_id?: number | null;
  details?: IssueDetails;
}

export interface ValidationSummary {
  components_checked: number;
  errors: number;
  warnings: number;
}

export interface PreSchedulingValidationResult {
  ready: boolean;
  scope: ValidationScope;
  semester: ValidationSemester;
  department?: DepartmentSummary | null;
  summary: ValidationSummary;
  issues: ValidationIssue[];
}

export interface ValidationRequest {
  semester: number;
  scope: ValidationScope;
  /** Required for `DEPARTMENT`, and never sent for `COLLEGE`. */
  department?: number;
}

// --- Generation (Phases 9 and 10) ----------------------------------------

export interface SolverReport {
  status: SolverStatus;
  objective_value?: number | null;
  wall_time_seconds: number;
  num_conflicts: number;
  num_branches: number;
  message?: string;
}

export interface GenerationSummary {
  components: number;
  sessions: number;
  candidates: number;
  placements: number;
}

export interface CollegeGenerationSummary {
  departments: number;
  components: number;
  sessions: number;
  candidates: number;
  placements: number;
}

export interface GenerationCourse {
  id: number;
  code: string;
  name: string;
}

export interface GenerationOffering {
  id: number;
  offering_code: string;
}

export interface GenerationComponent {
  id: number;
  component_type: string;
  label?: string;
}

/** One occupied teaching period of a preview placement. */
export interface GenerationSlot {
  id: number;
  sequence: number;
  label?: string;
  start_time: string;
  end_time: string;
}

export interface GenerationRoom {
  id: number;
  code: string;
  name: string;
}

export interface GenerationInstructor {
  id: number;
  full_name: string;
  assignment_role?: string | null;
}

export interface GenerationGroup {
  id: number;
  code: string;
  name: string;
}

/**
 * One scheduled session in a preview.
 *
 * A multi-period session carries every occupied slot in `slots`; `start_time`
 * and `end_time` span the whole block, so it stays one event.
 */
export interface GenerationPlacement {
  session_id: string;
  course: GenerationCourse;
  offering: GenerationOffering;
  teaching_component: GenerationComponent;
  day_of_week: number;
  day_display: string;
  slots: GenerationSlot[];
  start_time: string;
  end_time: string;
  room?: GenerationRoom | null;
  instructors: GenerationInstructor[];
  student_groups: GenerationGroup[];
  penalty: number;
}

/** College placements additionally name the department managing the component. */
export interface CollegeGenerationPlacement extends GenerationPlacement {
  managing_department?: DepartmentSummary | null;
}

export interface SessionCandidateCount {
  session_id: string;
  component_id: number;
  candidate_count: number;
}

export interface GenerationDiagnostics {
  components: number;
  sessions: number;
  candidates: number;
  min_candidates_per_session: number;
  max_candidates_per_session: number;
  sessions_with_fewest_candidates: SessionCandidateCount[];
  sessions_without_candidates?: string[];
}

export interface CollegeGenerationDiagnostics extends GenerationDiagnostics {
  departments: number;
  department_breakdown: GenerationDepartmentBuildCount[];
}

export interface GenerationDepartmentBuildCount {
  department: DepartmentSummary;
  components: number;
  sessions: number;
  candidates: number;
}

export interface GenerationDepartmentSummary extends GenerationDepartmentBuildCount {
  placements: number;
}

export interface DepartmentGenerationRequest {
  semester: number;
  department: number;
  max_time_seconds?: number;
}

/** Alias kept for the generic case; the department form is the common one. */
export type GenerationRequest = DepartmentGenerationRequest;

export interface CollegeGenerationRequest {
  semester: number;
  max_time_seconds?: number;
}

/** HTTP 200 with `generated: true`: a solved preview, never persisted. */
export interface DepartmentGenerationResult {
  generated: boolean;
  persisted: boolean;
  message?: string;
  semester: ValidationSemester;
  department?: DepartmentSummary | null;
  validation?: PreSchedulingValidationResult;
  solver?: SolverReport | null;
  summary?: GenerationSummary | null;
  placements?: GenerationPlacement[];
  generation_issues?: ValidationIssue[];
  diagnostics?: GenerationDiagnostics | null;
}

export interface CollegeGenerationResult {
  generated: boolean;
  persisted: boolean;
  scope: ValidationScope;
  message?: string;
  semester: ValidationSemester;
  validation?: PreSchedulingValidationResult;
  solver?: SolverReport | null;
  summary?: CollegeGenerationSummary | null;
  department_summaries?: GenerationDepartmentSummary[];
  placements?: CollegeGenerationPlacement[];
  generation_issues?: ValidationIssue[];
  diagnostics?: CollegeGenerationDiagnostics | null;
}

/** HTTP 409: generation was refused before or while building the problem. */
export interface GenerationRejectedResult {
  generated: boolean;
  persisted: boolean;
  reason: GenerationRejectionReason;
  message?: string;
  semester: ValidationSemester;
  department?: DepartmentSummary | null;
  validation?: PreSchedulingValidationResult | null;
  generation_issues?: ValidationIssue[];
  diagnostics?: GenerationDiagnostics | null;
}

export interface CollegeGenerationRejectedResult extends GenerationRejectedResult {
  scope: ValidationScope;
  diagnostics?: CollegeGenerationDiagnostics | null;
}

// --- Persisted schedules (Phase 11) --------------------------------------

export interface ScheduleUserSummary {
  id: number;
  username: string;
  role: string;
}

/** What a schedule is: its semester and its scope. */
export interface ScheduleIdentity {
  id: number;
  scope: ScheduleScope;
  semester: SemesterSummary;
  department?: DepartmentSummary | null;
}

export interface ScheduleVersionSummary {
  id: number;
  version_number: number;
  status: ScheduleStatus;
  source: ScheduleVersionSource;
  parent_version?: number | null;
  created_by?: ScheduleUserSummary | null;
  notes?: string;
  solver_status?: string | null;
  objective_value?: number | null;
  entry_count: number;
  created_at: IsoDateTime;
}

export interface ScheduleSummary extends ScheduleIdentity {
  version_count: number;
  latest_version_number: number | null;
  latest_version_status: ScheduleStatus | null;
  created_at: IsoDateTime;
  updated_at: IsoDateTime;
}

export interface ScheduleDetail extends ScheduleSummary {
  latest_version?: ScheduleVersionSummary | null;
  /** Authoritative publication pointer; `null` until F4 publishes a version. */
  published_version?: number | null;
  published_version_number?: number | null;
  published_at?: IsoDateTime | null;
}

export interface ScheduleVersionDetail extends ScheduleVersionSummary {
  schedule: ScheduleIdentity;
  solver_wall_time_seconds?: number | null;
  solver_num_conflicts?: number | null;
  solver_num_branches?: number | null;
  validation_summary?: IssueDetails;
  generation_summary?: IssueDetails;
  submitted_by?: ScheduleUserSummary | null;
  submitted_at?: IsoDateTime | null;
  reviewed_by?: ScheduleUserSummary | null;
  reviewed_at?: IsoDateTime | null;
  approved_by?: ScheduleUserSummary | null;
  approved_at?: IsoDateTime | null;
  published_by?: ScheduleUserSummary | null;
  published_at?: IsoDateTime | null;
  is_published_current?: boolean;
}

// --- Persisted entries ----------------------------------------------------

/** One occupied period of a persisted entry, rendered from its snapshot. */
export interface ScheduleEntryTimeSlot {
  id: number;
  position: number;
  sequence: number;
  label?: string;
  start_time: string;
  end_time: string;
}

export interface ScheduleEntryInstructor {
  id: number;
  full_name: string;
  assignment_role?: string;
}

export interface ScheduleEntryStudentGroup {
  id: number;
  code: string;
  name: string;
  department?: DepartmentSummary | null;
}

/**
 * One persisted weekly session.
 *
 * Every descriptive value is a **snapshot** stored with the version. The UI must
 * render these values and never substitute a live course, room, department,
 * instructor or group name.
 */
export interface ScheduleEntry {
  id: number;
  session_id: string;
  candidate_id: string;
  session_ordinal: number;
  course: GenerationCourse;
  offering: GenerationOffering;
  teaching_component: GenerationComponent;
  managing_department: DepartmentSummary;
  day_of_week: number;
  day_display: string;
  start_time: string;
  end_time: string;
  time_slots: ScheduleEntryTimeSlot[];
  room?: GenerationRoom | null;
  instructors: ScheduleEntryInstructor[];
  student_groups: ScheduleEntryStudentGroup[];
  penalty: number;
}

/** Exact-match entry filters the backend documents on the entries action. */
export type EntryFilters = {
  managing_department?: number;
  teaching_component?: number;
  room?: number;
  day_of_week?: number;
};

/**
 * Exact-match schedule collection filters.
 *
 * Declared as a type alias rather than an interface so the shape is assignable
 * to the client's `QueryParams` index signature.
 */
export type ScheduleFilters = {
  semester?: number;
  scope?: ScheduleScope;
  department?: number;
};

// --- Draft generation (generate and persist) -----------------------------

export interface DepartmentDraftRequest {
  semester: number;
  department: number;
  max_time_seconds?: number;
  notes?: string;
}

export interface CollegeDraftRequest {
  semester: number;
  /** Never submitted: the endpoint is the college scope. */
  max_time_seconds?: number;
  notes?: string;
}

export interface DepartmentDraftResult {
  generated: boolean;
  persisted: boolean;
  scope: ScheduleScope;
  message?: string;
  semester: ValidationSemester;
  department?: DepartmentSummary | null;
  validation?: PreSchedulingValidationResult;
  solver?: SolverReport | null;
  summary?: GenerationSummary | null;
  schedule?: ScheduleSummary | null;
  version?: ScheduleVersionSummary | null;
  placements?: GenerationPlacement[];
  generation_issues?: ValidationIssue[];
  diagnostics?: GenerationDiagnostics | null;
}

export interface CollegeDraftResult extends DepartmentDraftResult {
  summary?: CollegeGenerationSummary | null;
  placements?: CollegeGenerationPlacement[];
  diagnostics?: CollegeGenerationDiagnostics | null;
}

export interface DraftRejectedResult {
  generated: boolean;
  persisted: boolean;
  scope: ScheduleScope;
  reason: GenerationRejectionReason;
  message?: string;
  semester: ValidationSemester;
  department?: DepartmentSummary | null;
  validation?: PreSchedulingValidationResult | null;
  generation_issues?: ValidationIssue[];
  diagnostics?: GenerationDiagnostics | null;
}

// --- Frontend timetable domain -------------------------------------------

/** Where a rendered timetable came from; drives the labels shown to a user. */
export type TimetableSource = 'PREVIEW' | 'PERSISTED';

export interface TimetableSlot {
  /** Stable key for rendering (`position` for entries, `sequence` for previews). */
  key: string;
  /** Backend period id, used to build a manual-edit proposal. */
  id?: number | null;
  sequence: number;
  label: string;
  startTime: string;
  endTime: string;
}

export interface TimetableInstructor {
  id: number;
  fullName: string;
  assignmentRole: string | null;
}

export interface TimetableGroup {
  id: number;
  code: string;
  name: string;
  department: DepartmentSummary | null;
}

/**
 * One physical weekly session, normalized from a preview placement or a
 * persisted entry.
 *
 * A joint session serving several student groups stays **one** session: the
 * groups are listed, never duplicated into several events.
 */
export interface TimetableSession {
  /** `session_id` is the scheduling identity of the session. */
  sessionId: string;
  course: GenerationCourse;
  offering: GenerationOffering;
  teachingComponent: GenerationComponent;
  managingDepartment: DepartmentSummary | null;
  dayOfWeek: number;
  dayDisplay: string;
  startTime: string;
  endTime: string;
  slots: TimetableSlot[];
  room: GenerationRoom | null;
  instructors: TimetableInstructor[];
  studentGroups: TimetableGroup[];
  penalty: number;
  source: TimetableSource;
  /** Persisted-entry identity, absent for a preview. */
  entryId?: number;
  candidateId?: string;
  sessionOrdinal?: number;
}

// --- Comparison -----------------------------------------------------------

/** How one session differs between two versions of the same schedule. */
export type SessionChangeKind =
  | 'UNCHANGED'
  | 'TIME_CHANGED'
  | 'ROOM_CHANGED'
  | 'TIME_AND_ROOM_CHANGED'
  | 'CONTENT_CHANGED'
  | 'PENALTY_CHANGED'
  | 'ADDED'
  | 'REMOVED';

export interface SessionChange {
  sessionId: string;
  kind: SessionChangeKind;
  before: TimetableSession | null;
  after: TimetableSession | null;
}

export interface TimetableComparison {
  changes: SessionChange[];
  unchangedCount: number;
  changedCount: number;
  addedCount: number;
  removedCount: number;
}

// --- Validated manual editing (F4) ---------------------------------------

/** Refusal reasons of the manual-edit endpoints (HTTP 409). */
export type ManualEditRejectionReason =
  | 'MANUAL_EDIT_VALIDATION_FAILED'
  | 'BASE_VERSION_NOT_DRAFT'
  | 'STALE_BASE_VERSION';

/**
 * One requested relocation of one existing entry.
 *
 * Only the placement moves. `time_slot_ids` and `room_id` are both optional, but at
 * least one must be present, and the backend rejects any other field outright.
 */
export interface ManualEditChange {
  entry_id: number;
  time_slot_ids?: number[];
  room_id?: number | null;
}

/** Request body of both manual-edit endpoints. `changes` must not be empty. */
export interface ManualEditRequest {
  notes?: string;
  changes: ManualEditChange[];
}

/** One reason a proposed timetable was refused, with the rows involved. */
export interface ManualEditIssue {
  code: string;
  message: string;
  entry_id?: number | null;
  conflicting_entry_id?: number | null;
  details?: IssueDetails;
}

export interface ManualEditValidationResult {
  valid: boolean;
  base_version: number;
  summary: { changes: number; errors: number };
  issues: ManualEditIssue[];
}

/** Identity of the version a manual edit produced. */
export interface ManualEditVersion {
  id: number;
  version_number: number;
  status: ScheduleStatus;
  source: ScheduleVersionSource;
  parent_version?: number | null;
}

/** Response body of a stored manual edit; `generated` is deliberately absent. */
export interface ManualEditApplyResult {
  persisted: boolean;
  schedule: number;
  base_version: number;
  version: ManualEditVersion;
  summary: { entries: number; changed_entries: number };
}

/** Response body of a manual edit that stored nothing. */
export interface ManualEditRejectedResult {
  persisted: boolean;
  reason: ManualEditRejectionReason;
  message?: string;
  base_version?: number | null;
  validation?: ManualEditValidationResult | null;
}

// --- Workflow and publication (F4) ---------------------------------------

/** The four explicit workflow operations, each with its own endpoint. */
export type WorkflowAction = 'SUBMIT' | 'REVIEW' | 'APPROVE' | 'PUBLISH';

/** Refusal reasons of a workflow action (HTTP 409). */
export type WorkflowRejectionReason =
  | 'INVALID_TRANSITION'
  | 'STALE_VERSION'
  | 'DEPARTMENT_SCHEDULE_NOT_PUBLISHABLE'
  | 'EMPTY_SCHEDULE_CANNOT_BE_PUBLISHED'
  | 'SCHEDULE_VALIDATION_FAILED';

/** One blocking reason a stored version cannot advance. */
export interface WorkflowIssue {
  code: string;
  /** Always `ERROR`: workflow issues block progression. */
  severity: string;
  message: string;
  entry_id?: number | null;
  conflicting_entry_id?: number | null;
  details?: IssueDetails;
}

export interface WorkflowValidationResult {
  valid: boolean;
  version: number;
  status: ScheduleStatus;
  summary: { entries: number; errors: number };
  issues: WorkflowIssue[];
}

/** Response body of an applied workflow action. */
export interface WorkflowTransitionResult {
  applied: boolean;
  action: string;
  status: ScheduleStatus;
  from_status?: ScheduleStatus | null;
  version: ScheduleVersionDetail;
  validation?: WorkflowValidationResult | null;
}

/** Response body of a refused workflow action. Nothing changed. */
export interface WorkflowRejectedResult {
  applied: boolean;
  action: string;
  reason: WorkflowRejectionReason;
  message?: string;
  status?: ScheduleStatus | null;
  version?: number | null;
  validation?: WorkflowValidationResult | null;
}

/** Identity of the authoritative published version. */
export interface PublishedVersionIdentity {
  id: number;
  version_number: number;
  status: ScheduleStatus;
  published_at?: IsoDateTime | null;
  published_by?: ScheduleUserSummary | null;
}

/** Response body of the official timetable endpoint. */
export interface PublishedScheduleResult {
  semester: SemesterSummary;
  schedule: ScheduleIdentity;
  version: PublishedVersionIdentity;
  entries: ScheduleEntry[];
}

// --- Reports and analytics (F4) ------------------------------------------

/** A display reference taken from a version's snapshot columns. */
export interface AnalyticsSnapshotRef {
  id?: number | null;
  code?: string;
  name?: string;
}

/**
 * Which stored version a report describes.
 *
 * `created_at` is when the timetable version was stored and `published_at` when it
 * became official; neither is when the report was generated, because analytics are
 * computed on request and never stored.
 */
export interface AnalyticsVersion {
  schedule_id: number;
  scope: ScheduleScope;
  semester_id: number;
  semester_label: string;
  id: number;
  version_number: number;
  status: ScheduleStatus;
  source: ScheduleVersionSource;
  created_at?: IsoDateTime | null;
  published_at?: IsoDateTime | null;
  published_by?: ScheduleUserSummary | null;
}

export interface AnalyticsSummary {
  entry_count: number;
  session_count: number;
  scheduled_minutes: number;
  scheduled_hours: number;
  unique_courses: number;
  unique_teaching_components: number;
  unique_departments: number;
  unique_instructors: number;
  unique_rooms: number;
  unique_student_groups: number;
  days_used: number;
}

/**
 * How a department-scoped report divides the official timetable.
 *
 * `managed` is the department's own teaching; `participating` is joint sessions
 * another department manages. The two are never added into one local load.
 */
export interface AnalyticsDepartmentScope {
  department: AnalyticsSnapshotRef;
  managed_session_count: number;
  participating_session_count: number;
  total_visible_session_count: number;
  managed_minutes: number;
  managed_hours: number;
  participating_minutes: number;
  participating_hours: number;
}

export interface AnalyticsDepartmentLoad {
  department: AnalyticsSnapshotRef;
  component_count: number;
  session_count: number;
  scheduled_minutes: number;
  scheduled_hours: number;
  unique_courses: number;
  unique_instructors: number;
  unique_rooms: number;
  unique_student_groups: number;
  joint_session_count: number;
}

export interface AnalyticsInstructorWorkload {
  instructor: AnalyticsSnapshotRef;
  session_count: number;
  primary_session_count: number;
  assistant_session_count: number;
  scheduled_minutes: number;
  scheduled_hours: number;
  days_used: number;
  max_daily_scheduled_minutes: number;
  max_daily_scheduled_hours: number;
  department_count: number;
  department_ids: number[];
  department_codes: string[];
  total_gap_minutes: number;
  average_gap_minutes_per_active_day: number;
  max_gap_minutes: number;
}

/**
 * Snapshot usage of one room plus its **current-configuration** denominator.
 *
 * `available_minutes` and `utilization_percent` may be null when today's grid offers
 * no denominator, and `utilization_percent` may exceed 100 rather than being clamped
 * when historical occupancy exceeds current availability.
 */
export interface AnalyticsRoomUsage {
  room: AnalyticsSnapshotRef;
  session_count: number;
  occupied_minutes: number;
  occupied_hours: number;
  occupied_slot_count: number;
  days_used: number;
  utilization_basis: string;
  available_minutes?: number | null;
  available_hours?: number | null;
  utilization_percent?: number | null;
  configuration_mismatch: boolean;
}

export interface AnalyticsStudentGroupLoad {
  group: AnalyticsSnapshotRef;
  department: AnalyticsSnapshotRef;
  session_count: number;
  scheduled_minutes: number;
  scheduled_hours: number;
  days_used: number;
  managing_department_count: number;
  total_gap_minutes: number;
  average_gap_minutes_per_active_day: number;
  max_gap_minutes: number;
}

/** Interpretable quality figures. There is deliberately no composite score. */
export interface AnalyticsQuality {
  total_preference_penalty: number;
  average_preference_penalty_per_session: number;
  total_instructor_gap_minutes: number;
  average_instructor_gap_minutes: number;
  total_student_group_gap_minutes: number;
  average_student_group_gap_minutes: number;
  sessions_by_weekday: Record<string, number>;
  sessions_by_start_hour: Record<string, number>;
  max_sessions_for_one_instructor_day: number;
  max_sessions_for_one_group_day: number;
}

/** Response body of both analytics endpoints. */
export interface ScheduleAnalyticsResult {
  scope: ScheduleScope;
  version: AnalyticsVersion;
  summary: AnalyticsSummary;
  department_scope?: AnalyticsDepartmentScope | null;
  department_load: AnalyticsDepartmentLoad[];
  instructor_workload: AnalyticsInstructorWorkload[];
  room_utilization: AnalyticsRoomUsage[];
  student_group_load: AnalyticsStudentGroupLoad[];
  quality: AnalyticsQuality;
}

// --- Semester teaching plan import (F4) ----------------------------------

/** Severity of an import issue. Warnings never block an apply. */
export type ImportSeverity = 'ERROR' | 'WARNING';

/** One reported problem of a workbook, positioned for the person fixing it. */
export interface ImportIssue {
  sheet: string;
  /** Spreadsheet row number, or `0` for a workbook-level issue. */
  row: number;
  column?: string | null;
  code: string;
  severity: ImportSeverity;
  message: string;
  details?: IssueDetails;
}

export interface ImportValidationSummary {
  sheets: number;
  rows: number;
  errors: number;
  warnings: number;
}

/** Response body of the import validate endpoint. Writes nothing. */
export interface SemesterPlanValidationResult {
  valid: boolean;
  summary: ImportValidationSummary;
  issues: ImportIssue[];
}

/** Echo of one authorized scope object of an apply response. */
export interface SemesterPlanImportScope {
  id: number;
  code?: string;
  name?: string;
  number?: number;
  academic_year?: string;
}

/** How many records of each type the apply created. The import is create-only. */
export interface SemesterPlanCreated {
  courses: number;
  student_groups: number;
  offerings: number;
  components: number;
  component_group_links: number;
  teaching_assignments: number;
  room_requirements: number;
  requirement_capabilities: number;
}

/** Response body of the import apply endpoint. */
export interface SemesterPlanApplyResult {
  applied: boolean;
  department?: SemesterPlanImportScope;
  semester?: SemesterPlanImportScope;
  created: SemesterPlanCreated;
  warnings: ImportIssue[];
  summary?: ImportValidationSummary;
  issues?: ImportIssue[];
}

/** Multipart fields of both import endpoints. */
export interface SemesterPlanImportForm {
  department: number;
  semester: number;
  file: File;
}

// --- Audit trail (F4) -----------------------------------------------------

/** `scheduling.models.AuditAction`. */
export type AuditAction =
  | 'DEPARTMENT_DRAFT_GENERATED'
  | 'COLLEGE_DRAFT_GENERATED'
  | 'MANUAL_EDIT_APPLIED'
  | 'SCHEDULE_SUBMITTED'
  | 'SCHEDULE_REVIEWED'
  | 'SCHEDULE_APPROVED'
  | 'SCHEDULE_PUBLISHED'
  | 'SEMESTER_PLAN_IMPORTED';

/**
 * Who performed an audited operation.
 *
 * The snapshot fields are authoritative: `id` is null once the account is removed,
 * while the username and role recorded at the time stay readable.
 */
export interface AuditActor {
  id?: number | null;
  username_snapshot: string;
  role_snapshot: string;
}

export interface AuditScheduleRef {
  id: number;
  scope: ScheduleScope;
  semester_id: number;
  department_id?: number | null;
}

export interface AuditVersionRef {
  id: number;
  version_number: number;
  status: ScheduleStatus;
  source: ScheduleVersionSource;
}

/** One audit event as the read API returns it. */
export interface AuditEvent {
  id: string;
  created_at: IsoDateTime;
  action: AuditAction;
  actor: AuditActor;
  department: DepartmentSummary | null;
  semester: SemesterSummary | null;
  schedule: AuditScheduleRef | null;
  schedule_version: AuditVersionRef | null;
  object_type: string;
  object_id: string;
  request_id: string;
  metadata: IssueDetails;
}

/** The eight documented audit filters. Nothing else is ever sent. */
export type AuditFilters = {
  action?: AuditAction;
  department?: number;
  semester?: number;
  schedule?: number;
  schedule_version?: number;
  actor?: number;
  created_after?: string;
  created_before?: string;
};
