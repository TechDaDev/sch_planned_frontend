'use client';

import * as React from 'react';

import { Alert } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Card, CardBody, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  DEPARTMENT_SCOPE_NOTICE,
  NO_COMPOSITE_SCORE_NOTICE,
  ROOM_AVAILABILITY_MISSING_LABEL,
  ROOM_UTILIZATION_BASIS_NOTICE,
  ROOM_UTILIZATION_MISMATCH_NOTICE,
} from '@/lib/scheduling/constants';
import {
  formatDecimal,
  formatHours,
  formatNumber,
  formatReference,
  maxValue,
  roomUtilizationExceedsAvailability,
  roomUtilizationView,
  sortDepartmentLoad,
  sortInstructorWorkload,
  sortRoomUsage,
  sortStudentGroupLoad,
  startHourDistribution,
  summaryEntries,
  weekdayDistribution,
} from '@/lib/scheduling/analytics';
import { formatDay, formatScheduleStatus, formatVersionSource } from '@/lib/scheduling/formatters';
import type { ScheduleAnalyticsResult } from '@/lib/scheduling/types';

/** Simple inline bar; the numeric value is always printed next to it. */
function DistributionRow({
  label,
  value,
  largest,
}: {
  label: string;
  value: number;
  largest: number;
}) {
  const width = largest > 0 ? Math.round((value / largest) * 100) : 0;
  return (
    <tr className="border-b border-line last:border-0">
      <th scope="row" className="px-2 py-1 text-left font-normal">
        {label}
      </th>
      <td className="px-2 py-1">
        <span
          aria-hidden="true"
          className="mr-2 inline-block h-2 rounded-sm bg-primary align-middle"
          style={{ width: `${width}%`, minWidth: value > 0 ? '2px' : '0' }}
        />
        {value}
      </td>
    </tr>
  );
}

function NumberRow({
  label,
  value,
  hint,
}: {
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="text-sm">
        {value}
        {hint ? <span className="block text-xs text-muted-foreground">{hint}</span> : null}
      </dd>
    </div>
  );
}

export interface AnalyticsReportProps {
  report: ScheduleAnalyticsResult;
  title?: string;
}

/**
 * One analytics report, rendered from the response alone.
 *
 * Every descriptive value is a snapshot reference the backend sent, so a rename in the
 * live academic or resource data never rewrites a report. Room utilization is the one
 * figure computed from current configuration, and its basis is stated on every row.
 * No composite score is shown, because the backend computes none.
 */
export function AnalyticsReport({ report, title = 'Analytics' }: AnalyticsReportProps) {
  const { summary, quality } = report;
  const weekdayRows = weekdayDistribution(quality.sessions_by_weekday, formatDay);
  const hourRows = startHourDistribution(quality.sessions_by_start_hour);
  const largestWeekday = maxValue(weekdayRows);
  const largestHour = maxValue(hourRows);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>
            {report.version.semester_label} · {report.version.scope === 'COLLEGE' ? 'College-wide' : 'Department'} ·
            V{report.version.version_number} · {formatScheduleStatus(report.version.status)} ·{' '}
            {formatVersionSource(report.version.source)}
          </CardDescription>
        </CardHeader>
        <CardBody>
          <dl className="grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-5">
            {summaryEntries(report).map((entry) => (
              <NumberRow key={entry.label} label={entry.label} value={entry.value} />
            ))}
          </dl>
          <p className="mt-3 text-xs text-muted-foreground">
            Scheduled minutes are authoritative integer arithmetic; hours are derived from
            them. {NO_COMPOSITE_SCORE_NOTICE}
          </p>
        </CardBody>
      </Card>

      {report.department_scope ? (
        <Card>
          <CardHeader>
            <CardTitle>Department scope</CardTitle>
            <CardDescription>{DEPARTMENT_SCOPE_NOTICE}</CardDescription>
          </CardHeader>
          <CardBody>
            <dl className="grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
              <NumberRow
                label="Department"
                value={formatReference(report.department_scope.department)}
              />
              <NumberRow
                label="Managed sessions"
                value={formatNumber(report.department_scope.managed_session_count)}
              />
              <NumberRow
                label="Participating sessions"
                value={formatNumber(report.department_scope.participating_session_count)}
              />
              <NumberRow
                label="Total visible sessions"
                value={formatNumber(report.department_scope.total_visible_session_count)}
              />
              <NumberRow
                label="Managed minutes"
                value={formatNumber(report.department_scope.managed_minutes)}
              />
              <NumberRow
                label="Managed hours"
                value={formatHours(report.department_scope.managed_hours)}
              />
              <NumberRow
                label="Participating minutes"
                value={formatNumber(report.department_scope.participating_minutes)}
              />
              <NumberRow
                label="Participating hours"
                value={formatHours(report.department_scope.participating_hours)}
              />
            </dl>
          </CardBody>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Department load</CardTitle>
          <CardDescription>Snapshot department names, from the analysed version.</CardDescription>
        </CardHeader>
        <CardBody className="overflow-x-auto">
          {report.department_load.length === 0 ? (
            <p className="text-sm text-muted-foreground">No department appears in this report.</p>
          ) : (
            <table className="w-full min-w-[48rem] border-collapse text-sm">
              <caption className="sr-only">Scheduled load per managing department</caption>
              <thead>
                <tr className="border-b border-line text-left">
                  {['Department', 'Components', 'Sessions', 'Hours', 'Courses', 'Instructors', 'Rooms', 'Groups', 'Joint sessions'].map(
                    (header) => (
                      <th key={header} scope="col" className="px-2 py-1 font-medium text-muted-foreground">
                        {header}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {sortDepartmentLoad(report.department_load).map((row) => (
                  <tr key={`${row.department.id ?? row.department.code}`} className="border-b border-line last:border-0">
                    <th scope="row" className="px-2 py-1 text-left font-normal">
                      {formatReference(row.department)}
                    </th>
                    <td className="px-2 py-1">{row.component_count}</td>
                    <td className="px-2 py-1">{row.session_count}</td>
                    <td className="px-2 py-1">{formatHours(row.scheduled_hours)}</td>
                    <td className="px-2 py-1">{row.unique_courses}</td>
                    <td className="px-2 py-1">{row.unique_instructors}</td>
                    <td className="px-2 py-1">{row.unique_rooms}</td>
                    <td className="px-2 py-1">{row.unique_student_groups}</td>
                    <td className="px-2 py-1">{row.joint_session_count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Instructor workload</CardTitle>
          <CardDescription>
            A shared instructor appears once: the backend merges the departments they teach
            for.
          </CardDescription>
        </CardHeader>
        <CardBody className="overflow-x-auto">
          {report.instructor_workload.length === 0 ? (
            <p className="text-sm text-muted-foreground">No instructor appears in this report.</p>
          ) : (
            <table className="w-full min-w-[52rem] border-collapse text-sm">
              <caption className="sr-only">Scheduled workload per instructor</caption>
              <thead>
                <tr className="border-b border-line text-left">
                  {[
                    'Instructor',
                    'Sessions',
                    'Primary',
                    'Assistant',
                    'Hours',
                    'Days',
                    'Max hours/day',
                    'Departments',
                    'Total gap',
                    'Avg gap/day',
                    'Max gap',
                  ].map((header) => (
                    <th key={header} scope="col" className="px-2 py-1 font-medium text-muted-foreground">
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortInstructorWorkload(report.instructor_workload).map((row) => (
                  <tr
                    key={`${row.instructor.id ?? row.instructor.code}`}
                    className="border-b border-line last:border-0"
                  >
                    <th scope="row" className="px-2 py-1 text-left font-normal">
                      {formatReference(row.instructor)}
                    </th>
                    <td className="px-2 py-1">{row.session_count}</td>
                    <td className="px-2 py-1">{row.primary_session_count}</td>
                    <td className="px-2 py-1">{row.assistant_session_count}</td>
                    <td className="px-2 py-1">{formatHours(row.scheduled_hours)}</td>
                    <td className="px-2 py-1">{row.days_used}</td>
                    <td className="px-2 py-1">{formatHours(row.max_daily_scheduled_hours)}</td>
                    <td className="px-2 py-1">{row.department_codes.join(', ') || formatNumber(row.department_count)}</td>
                    <td className="px-2 py-1">{formatNumber(row.total_gap_minutes)} min</td>
                    <td className="px-2 py-1">
                      {formatDecimal(row.average_gap_minutes_per_active_day)} min
                    </td>
                    <td className="px-2 py-1">{formatNumber(row.max_gap_minutes)} min</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Room utilization</CardTitle>
          <CardDescription>{ROOM_UTILIZATION_BASIS_NOTICE}</CardDescription>
        </CardHeader>
        <CardBody className="space-y-3 overflow-x-auto">
          {report.room_utilization.some((room) => room.configuration_mismatch) ? (
            <Alert tone="warning" title="Availability changed since this version was generated">
              {ROOM_UTILIZATION_MISMATCH_NOTICE}
            </Alert>
          ) : null}
          {report.room_utilization.length === 0 ? (
            <p className="text-sm text-muted-foreground">No room appears in this report.</p>
          ) : (
            <table className="w-full min-w-[48rem] border-collapse text-sm">
              <caption className="sr-only">Room utilization against current availability</caption>
              <thead>
                <tr className="border-b border-line text-left">
                  {['Room', 'Sessions', 'Occupied', 'Slots', 'Days', 'Basis', 'Available', 'Utilization'].map(
                    (header) => (
                      <th key={header} scope="col" className="px-2 py-1 font-medium text-muted-foreground">
                        {header}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {sortRoomUsage(report.room_utilization).map((row) => {
                  const view = roomUtilizationView(row);
                  return (
                    <tr key={`${row.room.id ?? row.room.code}`} className="border-b border-line last:border-0">
                      <th scope="row" className="px-2 py-1 text-left font-normal">
                        {formatReference(row.room)}
                      </th>
                      <td className="px-2 py-1">{row.session_count}</td>
                      <td className="px-2 py-1">{formatHours(row.occupied_hours)}</td>
                      <td className="px-2 py-1">{row.occupied_slot_count}</td>
                      <td className="px-2 py-1">{row.days_used}</td>
                      <td className="px-2 py-1 text-xs text-muted-foreground">{row.utilization_basis}</td>
                      <td className="px-2 py-1">
                        {row.available_minutes === null || row.available_minutes === undefined
                          ? ROOM_AVAILABILITY_MISSING_LABEL
                          : view.availabilityLabel}
                      </td>
                      <td className="px-2 py-1">
                        {view.utilizationLabel}
                        {roomUtilizationExceedsAvailability(row) ? (
                          <Badge tone="warning" className="ml-2">
                            exceeds current availability
                          </Badge>
                        ) : null}
                        {view.mismatch && !roomUtilizationExceedsAvailability(row) ? (
                          <Badge tone="warning" className="ml-2">
                            configuration mismatch
                          </Badge>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Student group load</CardTitle>
          <CardDescription>Persisted group and department snapshots.</CardDescription>
        </CardHeader>
        <CardBody className="overflow-x-auto">
          {report.student_group_load.length === 0 ? (
            <p className="text-sm text-muted-foreground">No student group appears in this report.</p>
          ) : (
            <table className="w-full min-w-[44rem] border-collapse text-sm">
              <caption className="sr-only">Scheduled load per student group</caption>
              <thead>
                <tr className="border-b border-line text-left">
                  {['Group', 'Department', 'Sessions', 'Hours', 'Days', 'Managing departments', 'Total gap', 'Avg gap/day'].map(
                    (header) => (
                      <th key={header} scope="col" className="px-2 py-1 font-medium text-muted-foreground">
                        {header}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {sortStudentGroupLoad(report.student_group_load).map((row) => (
                  <tr key={`${row.group.id ?? row.group.code}`} className="border-b border-line last:border-0">
                    <th scope="row" className="px-2 py-1 text-left font-normal">
                      {formatReference(row.group)}
                    </th>
                    <td className="px-2 py-1">{formatReference(row.department)}</td>
                    <td className="px-2 py-1">{row.session_count}</td>
                    <td className="px-2 py-1">{formatHours(row.scheduled_hours)}</td>
                    <td className="px-2 py-1">{row.days_used}</td>
                    <td className="px-2 py-1">{row.managing_department_count}</td>
                    <td className="px-2 py-1">{formatNumber(row.total_gap_minutes)} min</td>
                    <td className="px-2 py-1">
                      {formatDecimal(row.average_gap_minutes_per_active_day)} min
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Quality</CardTitle>
          <CardDescription>{NO_COMPOSITE_SCORE_NOTICE}</CardDescription>
        </CardHeader>
        <CardBody className="space-y-4">
          <dl className="grid gap-3 text-sm sm:grid-cols-3 lg:grid-cols-4">
            <NumberRow
              label="Total preference penalty"
              value={formatNumber(quality.total_preference_penalty)}
              hint="Sum of the stored per-placement penalties"
            />
            <NumberRow
              label="Average penalty / session"
              value={formatDecimal(quality.average_preference_penalty_per_session, 2)}
            />
            <NumberRow
              label="Total instructor gap"
              value={`${formatNumber(quality.total_instructor_gap_minutes)} min`}
            />
            <NumberRow
              label="Average instructor gap"
              value={`${formatDecimal(quality.average_instructor_gap_minutes)} min`}
            />
            <NumberRow
              label="Total student-group gap"
              value={`${formatNumber(quality.total_student_group_gap_minutes)} min`}
            />
            <NumberRow
              label="Average student-group gap"
              value={`${formatDecimal(quality.average_student_group_gap_minutes)} min`}
            />
            <NumberRow
              label="Max sessions / instructor / day"
              value={formatNumber(quality.max_sessions_for_one_instructor_day)}
            />
            <NumberRow
              label="Max sessions / group / day"
              value={formatNumber(quality.max_sessions_for_one_group_day)}
            />
          </dl>

          <div className="grid gap-4 sm:grid-cols-2">
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Sessions by weekday</caption>
              <thead>
                <tr className="border-b border-line text-left">
                  <th scope="col" className="px-2 py-1 font-medium text-muted-foreground">
                    Weekday
                  </th>
                  <th scope="col" className="px-2 py-1 font-medium text-muted-foreground">
                    Sessions
                  </th>
                </tr>
              </thead>
              <tbody>
                {weekdayRows.map((row) => (
                  <DistributionRow
                    key={row.label}
                    label={row.label}
                    value={row.value}
                    largest={largestWeekday}
                  />
                ))}
              </tbody>
            </table>

            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Sessions by start hour</caption>
              <thead>
                <tr className="border-b border-line text-left">
                  <th scope="col" className="px-2 py-1 font-medium text-muted-foreground">
                    Start hour
                  </th>
                  <th scope="col" className="px-2 py-1 font-medium text-muted-foreground">
                    Sessions
                  </th>
                </tr>
              </thead>
              <tbody>
                {hourRows.map((row) => (
                  <DistributionRow
                    key={row.label}
                    label={row.label}
                    value={row.value}
                    largest={largestHour}
                  />
                ))}
              </tbody>
            </table>
          </div>

          <p className="text-xs text-muted-foreground">
            The two distributions above are the same figures as text, so the report does not
            depend on reading a bar.
          </p>
        </CardBody>
      </Card>

      <p className="text-xs text-muted-foreground">
        Report of schedule #{report.version.schedule_id} · version {report.version.id}.
        {summary.entry_count === 0 ? ' This version stores no entry.' : ''}
      </p>
    </div>
  );
}
