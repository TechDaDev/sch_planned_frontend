// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';

import { TimetableGrid } from '@/components/scheduling/timetable-grid';
import { TimetableList } from '@/components/scheduling/timetable-list';
import { TimetableView } from '@/components/scheduling/timetable-view';
import { sessionFromEntry, sessionFromPlacement } from '@/lib/scheduling/normalization';
import { collegePlacement, placement, scheduleEntry } from '@/test/scheduling-fixtures';

function sundaySession() {
  return sessionFromPlacement(placement({ session_id: 'sun-1', day_of_week: 0, day_display: 'Sunday' }));
}

function wednesdaySession() {
  return sessionFromEntry(
    scheduleEntry({
      session_id: 'wed-1',
      day_of_week: 3,
      day_display: 'Wednesday',
      start_time: '13:00',
      end_time: '16:00',
    }),
  );
}

/** The element the grid positions for one session. */
function eventFor(sessionId: string): HTMLElement {
  const element = document.querySelector<HTMLElement>(`[data-session-id="${sessionId}"]`);
  if (!element) {
    throw new Error(`No grid event for session ${sessionId}`);
  }
  return element;
}

describe('weekly grid', () => {
  it('uses the college week, starting on Sunday', () => {
    render(<TimetableGrid sessions={[wednesdaySession(), sundaySession()]} />);

    const headers = screen.getAllByRole('columnheader').map((header) => header.textContent);

    expect(headers).toEqual(['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday']);
  });

  it('places a session in its own weekday column', () => {
    render(<TimetableGrid sessions={[sundaySession(), wednesdaySession()]} />);

    const sundayColumn = screen.getByRole('region', { name: 'Sunday sessions' });
    const wednesdayColumn = screen.getByRole('region', { name: 'Wednesday sessions' });

    expect(within(sundayColumn).getByText('ML301')).toBeVisible();
    expect(within(sundayColumn).queryByText(/Computer/)).toBeNull();
    expect(
      wednesdayColumn.querySelector('[data-session-id="wed-1"]'),
    ).not.toBeNull();
  });

  it('renders a multi-period session as one event spanning its interval', () => {
    const sessions = [sessionFromPlacement(placement({ session_id: 'multi', start_time: '08:00', end_time: '10:00' }))];
    render(<TimetableGrid sessions={sessions} />);

    expect(document.querySelectorAll('[data-session-id="multi"]')).toHaveLength(1);
    // Two periods of one hour each occupy the two-hour block, drawn once.
    expect(eventFor('multi').style.height).toBe('112px');
  });

  it('sizes events from their real start and end times, not from a fixed period', () => {
    const shortSession = sessionFromEntry(
      scheduleEntry({ session_id: 'short', start_time: '08:00', end_time: '08:45' }),
    );
    const longSession = sessionFromEntry(
      scheduleEntry({ session_id: 'long', start_time: '10:00', end_time: '13:00' }),
    );

    render(<TimetableGrid sessions={[shortSession, longSession]} />);

    const shortHeight = Number.parseInt(eventFor('short').style.height, 10);
    const longHeight = Number.parseInt(eventFor('long').style.height, 10);

    expect(shortHeight / 45).toBeCloseTo(longHeight / 180, 1);
    expect(longHeight).toBeGreaterThan(shortHeight);
  });

  it('lists every instructor and student group of a joint session', () => {
    const joint = sessionFromPlacement(
      placement({
        session_id: 'joint',
        instructors: [
          { id: 1, full_name: 'Rana Salim', assignment_role: 'PRIMARY' },
          { id: 2, full_name: 'Omar Idris', assignment_role: 'ASSISTANT' },
        ],
        student_groups: [
          { id: 40, code: 'BIOAI-1', name: 'Biomedical AI Year 1' },
          { id: 41, code: 'CS-3', name: 'Computer Science Year 3' },
        ],
      }),
    );

    render(<TimetableGrid sessions={[joint]} />);

    expect(document.querySelectorAll('[data-session-id="joint"]')).toHaveLength(1);
    expect(screen.getByText(/Rana Salim/)).toBeVisible();
    expect(screen.getByText(/Omar Idris/)).toBeVisible();
    expect(screen.getByText('BIOAI-1, CS-3')).toBeVisible();
  });

  it('states a missing room instead of leaving the field blank', () => {
    render(<TimetableGrid sessions={[sessionFromPlacement(placement({ room: null }))]} />);

    expect(screen.getAllByText('No room assigned').length).toBeGreaterThan(0);
  });

  it('shows the managing department on a college timetable', () => {
    const session = sessionFromPlacement(collegePlacement());
    render(<TimetableGrid sessions={[session]} showDepartment />);

    expect(within(eventFor(session.sessionId)).getByText('BIOAI')).toBeVisible();
  });

  it('gives every event an accessible text label', () => {
    const session = sundaySession();
    render(<TimetableGrid sessions={[session]} />);

    const article = within(eventFor(session.sessionId)).getByRole('article');

    expect(article.getAttribute('aria-label')).toContain('ML301 — Machine Learning');
    expect(article.getAttribute('aria-label')).toContain('Sunday');
    expect(article.getAttribute('aria-label')).toContain('08:00–10:00');
    expect(article.getAttribute('aria-label')).toContain('AI-LAB-1');
  });

  it('renders an empty state rather than an empty grid', () => {
    render(<TimetableGrid sessions={[]} />);

    expect(screen.getByText('No session to display in the grid.')).toBeVisible();
  });
});

describe('accessible list', () => {
  it('states day, time, room, course, instructors and groups as text', () => {
    render(<TimetableList sessions={[wednesdaySession()]} />);

    const table = screen.getByRole('table', { name: 'Timetable sessions' });

    expect(within(table).getAllByRole('columnheader').map((cell) => cell.textContent)).toEqual([
      'Day',
      'Time',
      'Course',
      'Component',
      'Room',
      'Instructors',
      'Student groups',
    ]);
    expect(within(table).getByText('Wednesday')).toBeVisible();
    expect(within(table).getByText('13:00–16:00')).toBeVisible();
    expect(within(table).getByText(/ML301/)).toBeVisible();
    expect(within(table).getByText(/AI-LAB-1 — Artificial Intelligence Lab/)).toBeVisible();
    expect(within(table).getByText(/Rana Salim/)).toBeVisible();
    expect(within(table).getByText('BIOAI-1')).toBeVisible();
  });

  it('adds a managing department column for a college timetable', () => {
    render(<TimetableList sessions={[sessionFromPlacement(collegePlacement())]} showDepartment />);

    expect(screen.getByRole('columnheader', { name: 'Managing department' })).toBeVisible();
  });

  it('renders an empty state', () => {
    render(<TimetableList sessions={[]} />);

    expect(screen.getByText('No session to display.')).toBeVisible();
  });
});

describe('grid and list together', () => {
  const sessions = [
    sundaySession(),
    wednesdaySession(),
    sessionFromPlacement(
      placement({
        session_id: 'tue-1',
        day_of_week: 2,
        day_display: 'Tuesday',
        course: { id: 8, code: 'CS401', name: 'Compilers' },
        room: { id: 23, code: 'CS-201', name: 'Computer Lab' },
        instructors: [{ id: 2, full_name: 'Omar Idris', assignment_role: 'PRIMARY' }],
        student_groups: [{ id: 41, code: 'CS-3', name: 'Computer Science Year 3' }],
        slots: [
          { id: 33, sequence: 1, label: 'Period 3', start_time: '11:00', end_time: '12:00' },
        ],
        start_time: '11:00',
        end_time: '12:00',
      }),
    ),
  ];

  it('starts on the grid and switches to the list without losing a session', async () => {
    const user = userEvent.setup();
    render(<TimetableView sessions={sessions} />);

    expect(screen.getByRole('group', { name: 'Timetable representation' })).toBeVisible();
    expect(screen.queryByRole('table', { name: 'Timetable sessions' })).toBeNull();
    expect(screen.getByText('3 of 3 sessions shown')).toBeVisible();

    await user.click(screen.getByRole('button', { name: 'List' }));

    const table = await screen.findByRole('table', { name: 'Timetable sessions' });
    expect(within(table).getAllByRole('row')).toHaveLength(4);
    expect(screen.getByRole('button', { name: 'List' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('filters the displayed sessions without refetching anything', async () => {
    const user = userEvent.setup();
    render(<TimetableView sessions={sessions} />);

    await user.selectOptions(screen.getByLabelText('Room'), '23');

    expect(screen.getByText('1 of 3 sessions shown')).toBeVisible();
    expect(document.querySelectorAll('[data-session-id="tue-1"]')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: /Clear filters/ }));

    expect(screen.getByText('3 of 3 sessions shown')).toBeVisible();
  });

  it('filters by weekday using the college week labels', async () => {
    const user = userEvent.setup();
    render(<TimetableView sessions={sessions} />);

    await user.selectOptions(screen.getByLabelText('Weekday'), '3');

    expect(screen.getByText('1 of 3 sessions shown')).toBeVisible();
    expect(document.querySelectorAll('[data-session-id="wed-1"]')).toHaveLength(1);
  });

  it('hides the filter controls when the timetable offers no choice', async () => {
    render(<TimetableView sessions={[sundaySession()]} />);

    expect(screen.queryByLabelText('Room')).toBeNull();
    expect(screen.queryByLabelText('Course')).toBeNull();
  });

  it('shows a filtered empty state instead of a blank grid', async () => {
    const user = userEvent.setup();
    render(<TimetableView sessions={sessions} />);

    await user.selectOptions(screen.getByLabelText('Course'), '8');
    await user.selectOptions(screen.getByLabelText('Weekday'), '0');

    expect(screen.getByText('No session matches the selected filters.')).toBeVisible();
  });

  it('offers no drag affordance, because manual editing is not part of this phase', () => {
    render(<TimetableView sessions={sessions} />);

    expect(document.querySelectorAll('[draggable="true"]')).toHaveLength(0);
    expect(screen.queryByText(/drag/i)).toBeNull();
    expect(screen.queryByRole('button', { name: /move/i })).toBeNull();
  });
});
