import { describe, expect, it } from 'vitest';

import {
  canAccessResourcesModule,
  canCreateExceptionForScope,
  canManageCalendarException,
  canManageCalendarGrid,
  canManageInstructor,
  canManageInstructorSharing,
  canManageInstructorWindows,
  canManageResources,
  canManageRoom,
  canManageRoomAvailability,
  canManageRoomCapabilityAssignment,
  canManageRoomRequirement,
  canManageRoomSharing,
  canManageTeachingAssignment,
  canManageVocabulary,
  componentOwnedRowBadge,
  isSchedulerReadOnly,
  shareableResourceBadge,
} from '@/lib/resources/permissions';
import {
  CS_DEPARTMENT_ID,
  BIOAI_DEPARTMENT_ID,
  resourceCollegeAdmin,
  resourceDepartmentAdmin,
  resourceInstructorUser,
  resourceOtherDepartmentAdmin,
  resourceScheduler,
  resourceUnassignedDepartmentAdmin,
  resourceViewer,
} from '@/test/resource-fixtures';

describe('resource capability — college administrator', () => {
  it('manages every F2 resource', () => {
    expect(canAccessResourcesModule(resourceCollegeAdmin)).toBe(true);
    expect(canManageResources(resourceCollegeAdmin)).toBe(true);
    expect(canManageVocabulary(resourceCollegeAdmin)).toBe(true);
    expect(canManageCalendarGrid(resourceCollegeAdmin)).toBe(true);
    expect(canManageInstructor(resourceCollegeAdmin, BIOAI_DEPARTMENT_ID)).toBe(true);
    expect(canManageInstructorSharing(resourceCollegeAdmin, CS_DEPARTMENT_ID)).toBe(true);
    expect(canManageInstructorWindows(resourceCollegeAdmin, CS_DEPARTMENT_ID)).toBe(true);
    expect(canManageRoom(resourceCollegeAdmin, CS_DEPARTMENT_ID)).toBe(true);
    expect(canManageRoomSharing(resourceCollegeAdmin, CS_DEPARTMENT_ID)).toBe(true);
    expect(
      canManageRoomCapabilityAssignment(resourceCollegeAdmin, CS_DEPARTMENT_ID),
    ).toBe(true);
    expect(canManageRoomAvailability(resourceCollegeAdmin, CS_DEPARTMENT_ID)).toBe(true);
    expect(canManageTeachingAssignment(resourceCollegeAdmin, CS_DEPARTMENT_ID)).toBe(true);
    expect(canManageRoomRequirement(resourceCollegeAdmin, CS_DEPARTMENT_ID)).toBe(true);
    expect(canCreateExceptionForScope(resourceCollegeAdmin, 'COLLEGE')).toBe(true);
    expect(canManageCalendarException(resourceCollegeAdmin, null, 'COLLEGE')).toBe(true);
  });

  it('marks owned and shared rows distinctly', () => {
    expect(
      shareableResourceBadge(resourceCollegeAdmin, {
        ownerDepartmentId: BIOAI_DEPARTMENT_ID,
        sharingScope: 'PRIVATE',
      }),
    ).toBe('owned');
  });
});

describe('resource capability — department administrator', () => {
  it('manages its own instructors and rooms', () => {
    expect(canAccessResourcesModule(resourceDepartmentAdmin)).toBe(true);
    expect(canManageResources(resourceDepartmentAdmin)).toBe(true);
    expect(canManageInstructor(resourceDepartmentAdmin, BIOAI_DEPARTMENT_ID)).toBe(true);
    expect(canManageRoom(resourceDepartmentAdmin, BIOAI_DEPARTMENT_ID)).toBe(true);
    expect(
      canManageTeachingAssignment(resourceDepartmentAdmin, BIOAI_DEPARTMENT_ID),
    ).toBe(true);
    expect(
      canManageRoomRequirement(resourceDepartmentAdmin, BIOAI_DEPARTMENT_ID),
    ).toBe(true);
    expect(
      shareableResourceBadge(resourceDepartmentAdmin, {
        ownerDepartmentId: BIOAI_DEPARTMENT_ID,
        sharingScope: 'PRIVATE',
      }),
    ).toBe('owned');
  });

  it('cannot write another department instructor or room', () => {
    expect(canManageInstructor(resourceDepartmentAdmin, CS_DEPARTMENT_ID)).toBe(false);
    expect(canManageInstructorSharing(resourceDepartmentAdmin, CS_DEPARTMENT_ID)).toBe(
      false,
    );
    expect(canManageInstructorWindows(resourceDepartmentAdmin, CS_DEPARTMENT_ID)).toBe(
      false,
    );
    expect(canManageRoom(resourceDepartmentAdmin, CS_DEPARTMENT_ID)).toBe(false);
    expect(canManageRoomSharing(resourceDepartmentAdmin, CS_DEPARTMENT_ID)).toBe(false);
    expect(canManageRoomAvailability(resourceDepartmentAdmin, CS_DEPARTMENT_ID)).toBe(
      false,
    );
  });

  it('labels a selectable shared foreign resource as shared', () => {
    expect(
      shareableResourceBadge(resourceDepartmentAdmin, {
        ownerDepartmentId: CS_DEPARTMENT_ID,
        sharingScope: 'SELECTED_DEPARTMENTS',
      }),
    ).toBe('shared');
  });

  it('treats a college-wide foreign resource as college-wide', () => {
    expect(
      shareableResourceBadge(resourceDepartmentAdmin, {
        ownerDepartmentId: CS_DEPARTMENT_ID,
        sharingScope: 'COLLEGE_WIDE',
      }),
    ).toBe('college-wide');
  });

  it('never calls a joint-visible private instructor "shared"', () => {
    // Visibility through a teaching assignment does not mean the department may
    // schedule the instructor.
    expect(
      shareableResourceBadge(resourceDepartmentAdmin, {
        ownerDepartmentId: CS_DEPARTMENT_ID,
        sharingScope: 'PRIVATE',
      }),
    ).toBe('read-only');
  });

  it('cannot change college-wide vocabulary or the time grid', () => {
    expect(canManageVocabulary(resourceDepartmentAdmin)).toBe(false);
    expect(canManageCalendarGrid(resourceDepartmentAdmin)).toBe(false);
  });

  it('manages only exceptions whose target it owns', () => {
    expect(canCreateExceptionForScope(resourceDepartmentAdmin, 'COLLEGE')).toBe(false);
    expect(canCreateExceptionForScope(resourceDepartmentAdmin, 'DEPARTMENT')).toBe(true);
    expect(canCreateExceptionForScope(resourceDepartmentAdmin, 'ROOM')).toBe(true);

    expect(
      canManageCalendarException(resourceDepartmentAdmin, BIOAI_DEPARTMENT_ID, 'DEPARTMENT'),
    ).toBe(true);
    // A shared foreign instructor or room stays visible without granting
    // authority over its exceptions.
    expect(
      canManageCalendarException(resourceDepartmentAdmin, CS_DEPARTMENT_ID, 'INSTRUCTOR'),
    ).toBe(false);
    expect(
      canManageCalendarException(resourceDepartmentAdmin, CS_DEPARTMENT_ID, 'ROOM'),
    ).toBe(false);
    expect(canManageCalendarException(resourceDepartmentAdmin, null, 'COLLEGE')).toBe(false);
  });

  it('cannot manage another department admin resources', () => {
    expect(canManageInstructor(resourceOtherDepartmentAdmin, BIOAI_DEPARTMENT_ID)).toBe(
      false,
    );
    expect(canManageRoom(resourceOtherDepartmentAdmin, BIOAI_DEPARTMENT_ID)).toBe(false);
  });
});

describe('resource capability — scheduler', () => {
  it('reads the module without any mutation capability', () => {
    expect(canAccessResourcesModule(resourceScheduler)).toBe(true);
    expect(isSchedulerReadOnly(resourceScheduler)).toBe(true);
    expect(canManageResources(resourceScheduler)).toBe(false);
    expect(canManageVocabulary(resourceScheduler)).toBe(false);
    expect(canManageCalendarGrid(resourceScheduler)).toBe(false);
    expect(canManageInstructor(resourceScheduler, BIOAI_DEPARTMENT_ID)).toBe(false);
    expect(canManageRoom(resourceScheduler, BIOAI_DEPARTMENT_ID)).toBe(false);
    expect(canManageTeachingAssignment(resourceScheduler, BIOAI_DEPARTMENT_ID)).toBe(
      false,
    );
    expect(canCreateExceptionForScope(resourceScheduler, 'DEPARTMENT')).toBe(false);
    expect(canManageCalendarException(resourceScheduler, BIOAI_DEPARTMENT_ID, 'ROOM')).toBe(
      false,
    );
  });

  it('sees every row as read-only', () => {
    expect(
      shareableResourceBadge(resourceScheduler, {
        ownerDepartmentId: BIOAI_DEPARTMENT_ID,
        sharingScope: 'PRIVATE',
      }),
    ).toBe('read-only');
    expect(componentOwnedRowBadge(resourceScheduler, BIOAI_DEPARTMENT_ID)).toBe(
      'external-owner',
    );
  });
});

describe('resource capability — denied roles and fail-closed cases', () => {
  it('denies the module to viewers and instructors', () => {
    expect(canAccessResourcesModule(resourceViewer)).toBe(false);
    expect(canAccessResourcesModule(resourceInstructorUser)).toBe(false);
    expect(canManageResources(resourceViewer)).toBe(false);
    expect(canManageResources(resourceInstructorUser)).toBe(false);
  });

  it('restricts a department administrator without a department', () => {
    expect(canAccessResourcesModule(resourceUnassignedDepartmentAdmin)).toBe(true);
    expect(canManageResources(resourceUnassignedDepartmentAdmin)).toBe(true);
    expect(
      canManageInstructor(resourceUnassignedDepartmentAdmin, BIOAI_DEPARTMENT_ID),
    ).toBe(false);
    expect(canManageRoom(resourceUnassignedDepartmentAdmin, CS_DEPARTMENT_ID)).toBe(false);
    expect(
      canManageTeachingAssignment(resourceUnassignedDepartmentAdmin, BIOAI_DEPARTMENT_ID),
    ).toBe(false);
    expect(
      canCreateExceptionForScope(resourceUnassignedDepartmentAdmin, 'DEPARTMENT'),
    ).toBe(false);
    expect(canCreateExceptionForScope(resourceUnassignedDepartmentAdmin, 'COLLEGE')).toBe(
      false,
    );
  });

  it('fails closed without a user or without an owner', () => {
    expect(canAccessResourcesModule(null)).toBe(false);
    expect(canManageResources(null)).toBe(false);
    expect(canManageInstructor(null, BIOAI_DEPARTMENT_ID)).toBe(false);
    expect(canManageRoom(resourceCollegeAdmin, null)).toBe(false);
    expect(canManageInstructor(resourceCollegeAdmin, undefined)).toBe(false);
  });
});
