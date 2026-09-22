'use client';

import * as React from 'react';

import { Input } from '@/components/ui/input';
import { formatSemester } from '@/lib/academic/formatters';
import type { Department, Semester } from '@/lib/academic/types';
import type { ValidationScope } from '@/lib/scheduling/types';

/** `2026–2027 · First semester`, with inactive semesters stated in words. */
export function semesterOptionLabel(semester: Semester): string {
  return semester.is_active
    ? formatSemester(semester)
    : `${formatSemester(semester)} (inactive)`;
}

/** `BIOAI — Biomedical AI`, with inactive departments stated in words. */
export function departmentOptionLabel(department: Department): string {
  return department.is_active
    ? `${department.code} — ${department.name}`
    : `${department.code} — ${department.name} (inactive)`;
}

export interface SemesterSelectProps {
  id: string;
  semesters: readonly Semester[];
  value: number | null;
  onChange: (value: number | null) => void;
  isLoading?: boolean;
  label?: string;
  disabled?: boolean;
}

/** Semester selector. The id is never used as the primary label. */
export function SemesterSelect({
  id,
  semesters,
  value,
  onChange,
  isLoading = false,
  label = 'Semester',
  disabled = false,
}: SemesterSelectProps) {
  return (
    <div className="text-sm">
      <label htmlFor={id} className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <select
        id={id}
        className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-2 text-sm"
        value={value === null ? '' : String(value)}
        disabled={disabled || isLoading}
        onChange={(event) =>
          onChange(event.target.value === '' ? null : Number(event.target.value))
        }
      >
        <option value="">{isLoading ? 'Loading semesters…' : 'Select a semester'}</option>
        {semesters.map((semester) => (
          <option key={semester.id} value={semester.id}>
            {semesterOptionLabel(semester)}
          </option>
        ))}
      </select>
    </div>
  );
}

export interface DepartmentSelectProps {
  id: string;
  departments: readonly Department[];
  value: number | null;
  onChange: (value: number | null) => void;
  isLoading?: boolean;
  /** When set, the department is fixed and no foreign department is offered. */
  fixedDepartment?: { id: number; name: string; code: string } | null;
  label?: string;
}

/**
 * Department selector.
 *
 * A department administrator or scheduler is fixed to its own department and
 * gets a read-only value instead of a dropdown, so a foreign department can never
 * be selected from the interface.
 */
export function DepartmentSelect({
  id,
  departments,
  value,
  onChange,
  isLoading = false,
  fixedDepartment = null,
  label = 'Department',
}: DepartmentSelectProps) {
  if (fixedDepartment) {
    return (
      <div className="text-sm">
        <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
        <p className="mt-1 flex h-10 items-center rounded-md border border-line bg-surface-muted px-3">
          {fixedDepartment.code} — {fixedDepartment.name}
        </p>
        <input type="hidden" id={id} value={fixedDepartment.id} readOnly />
      </div>
    );
  }

  return (
    <div className="text-sm">
      <label htmlFor={id} className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </label>
      <select
        id={id}
        className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-2 text-sm"
        value={value === null ? '' : String(value)}
        disabled={isLoading}
        onChange={(event) =>
          onChange(event.target.value === '' ? null : Number(event.target.value))
        }
      >
        <option value="">{isLoading ? 'Loading departments…' : 'Select a department'}</option>
        {departments.map((department) => (
          <option key={department.id} value={department.id}>
            {departmentOptionLabel(department)}
          </option>
        ))}
      </select>
    </div>
  );
}

export interface ScopeSelectProps {
  id: string;
  value: ValidationScope;
  onChange: (value: ValidationScope) => void;
  /** College-wide options are only offered to a college administrator. */
  allowCollege: boolean;
  disabled?: boolean;
}

export function ScopeSelect({
  id,
  value,
  onChange,
  allowCollege,
  disabled = false,
}: ScopeSelectProps) {
  return (
    <div className="text-sm">
      <label htmlFor={id} className="text-xs uppercase tracking-wide text-muted-foreground">
        Scope
      </label>
      <select
        id={id}
        className="mt-1 h-10 w-full rounded-md border border-line bg-surface px-2 text-sm"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value as ValidationScope)}
      >
        <option value="DEPARTMENT">One department</option>
        {allowCollege ? <option value="COLLEGE">Whole college</option> : null}
      </select>
    </div>
  );
}

export interface TimeLimitInputProps {
  id: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  /** Shown as the default of the scope, since the backend applies it server-side. */
  backendDefault: number;
  disabled?: boolean;
}

/**
 * Optional solver time limit.
 *
 * Only the documented range is offered, and nothing else is exposed: the seed,
 * the worker count and solver logging are fixed server-side and are never sent.
 */
export function TimeLimitInput({
  id,
  value,
  onChange,
  min,
  max,
  backendDefault,
  disabled = false,
}: TimeLimitInputProps) {
  const invalid = value < min || value > max;
  return (
    <div className="text-sm">
      <label htmlFor={id} className="text-xs uppercase tracking-wide text-muted-foreground">
        Solver time limit (seconds, optional)
      </label>
      <Input
        id={id}
        className="mt-1"
        type="number"
        min={min}
        max={max}
        step={1}
        value={value}
        invalid={invalid}
        disabled={disabled}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <p className="mt-1 text-xs text-muted-foreground">
        Accepted range {min}–{max}; the backend default is {backendDefault}. The difference
        between the limit and the actual run time is normal.
      </p>
      {invalid ? (
        <p className="mt-1 text-xs text-danger" role="alert">
          Enter a value between {min} and {max}.
        </p>
      ) : null}
    </div>
  );
}
