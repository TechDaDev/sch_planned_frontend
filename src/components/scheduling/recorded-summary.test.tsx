// @vitest-environment jsdom
import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { RecordedSummary } from '@/components/scheduling/recorded-summary';
import { formatSummaryLabel } from '@/lib/scheduling/formatters';

/**
 * Recorded summaries are read by a reviewer, not decoded by a developer.
 *
 * These cases pin the reading: a machine key becomes a sentence, a scalar becomes
 * text, and a nested collection becomes a table instead of a JSON blob.
 */
describe('summary labels', () => {
  it('turns a stored key into a sentence', () => {
    expect(formatSummaryLabel('components_checked')).toBe('Components checked');
    expect(formatSummaryLabel('min-candidates-per-session')).toBe('Min candidates per session');
  });

  it('leaves an already readable key usable', () => {
    expect(formatSummaryLabel('ready')).toBe('Ready');
    expect(formatSummaryLabel('')).toBe('');
  });
});

describe('recorded summary rendering', () => {
  it('renders scalar figures as labelled text', () => {
    render(<RecordedSummary summary={{ ready: true, errors: 0, scope: 'COLLEGE' }} />);

    expect(screen.getByText('Ready')).toBeInTheDocument();
    expect(screen.getByText('true')).toBeInTheDocument();
    expect(screen.getByText('Errors')).toBeInTheDocument();
    expect(screen.getByText('0')).toBeInTheDocument();
    expect(screen.getByText('Scope')).toBeInTheDocument();
    expect(screen.getByText('COLLEGE')).toBeInTheDocument();
  });

  it('does not render a raw JSON document', () => {
    const { container } = render(
      <RecordedSummary summary={{ components: 22, diagnostics: { departments: 2 } }} />,
    );

    expect(container.querySelector('pre')).toBeNull();
    expect(container.textContent).not.toContain('{"');
  });

  it('nests an object one level and then shows its figures', () => {
    render(<RecordedSummary summary={{ diagnostics: { departments: 2, sessions: 44 } }} />);

    expect(screen.getByText('Diagnostics')).toBeInTheDocument();
    expect(screen.getByText('Departments')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('Sessions')).toBeInTheDocument();
    expect(screen.getByText('44')).toBeInTheDocument();
  });

  it('shows a collection of objects as a table with columns', () => {
    render(
      <RecordedSummary
        summary={{
          department_breakdown: [
            { code: 'CS', components: 16 },
            { code: 'EE', components: 6 },
          ],
        }}
      />,
    );

    const table = screen.getByRole('table');
    expect(within(table).getByRole('columnheader', { name: 'Code' })).toBeInTheDocument();
    expect(within(table).getByRole('columnheader', { name: 'Components' })).toBeInTheDocument();
    expect(within(table).getByRole('cell', { name: 'CS' })).toBeInTheDocument();
    expect(within(table).getByRole('cell', { name: 'EE' })).toBeInTheDocument();
  });

  it('caps a long collection and says how much is left', () => {
    const rows = Array.from({ length: 9 }, (_, index) => ({ session_id: `s${index}` }));
    render(<RecordedSummary summary={{ sessions: rows }} />);

    const table = screen.getByRole('table');
    expect(within(table).getAllByRole('row')).toHaveLength(6); // header plus five rows
    expect(screen.getByText('4 further rows are recorded and not shown here.')).toBeInTheDocument();
  });

  it('renders a list of scalars as text', () => {
    render(<RecordedSummary summary={{ warnings: ['late room change', 'capacity'] }} />);

    expect(screen.getByText('late room change, capacity')).toBeInTheDocument();
  });

  it('states when a payload carries nothing', () => {
    render(<RecordedSummary summary={{}} emptyLabel="No validation figures are recorded." />);

    expect(screen.getByText('No validation figures are recorded.')).toBeInTheDocument();
  });

  it('renders a missing value as a dash rather than blank', () => {
    render(<RecordedSummary summary={{ department: null, scope: 'COLLEGE' }} />);

    expect(screen.getByText('Scope')).toBeInTheDocument();
    expect(screen.queryByText('Department')).toBeNull();
  });
});
