// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { ConfirmDialog } from '@/components/academic/confirm-dialog';

/**
 * Dialog keyboard behaviour.
 *
 * These confirmations guard the operations that are hardest to undo, so the keyboard
 * contract is asserted rather than assumed: focus enters the dialog, `Escape` cancels,
 * the keyboard cannot reach the page behind it, and focus returns to the control that
 * opened it.
 */
function Harness({ tone = 'primary' as const }: { tone?: 'primary' | 'danger' }) {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button type="button" onClick={() => setOpen(true)}>
        Open confirmation
      </button>
      <button type="button">Background action</button>
      <ConfirmDialog
        open={open}
        tone={tone}
        title="Deactivate the room?"
        description="The room stays on file and is removed from scheduling."
        confirmLabel="Deactivate"
        onConfirm={() => setOpen(false)}
        onCancel={() => setOpen(false)}
      />
    </div>
  );
}

describe('dialog semantics', () => {
  it('is an alertdialog described by a concrete title and body', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Open confirmation' }));

    const dialog = screen.getByRole('alertdialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleName('Deactivate the room?');
    expect(dialog).toHaveAccessibleDescription(
      'The room stays on file and is removed from scheduling.',
    );
  });

  it('never renders before it is opened', () => {
    render(<Harness />);

    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});

describe('focus management', () => {
  it('moves focus into the dialog on open', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Open confirmation' }));

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Deactivate' }));
  });

  it('focuses the safe action for a destructive confirmation', async () => {
    const user = userEvent.setup();
    render(<Harness tone="danger" />);

    await user.click(screen.getByRole('button', { name: 'Open confirmation' }));

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
  });

  it('returns focus to the control that opened it', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Open confirmation' });

    await user.click(opener);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(document.activeElement).toBe(opener);
  });
});

describe('keyboard containment', () => {
  it('cancels on Escape', async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        open
        title="Confirm?"
        description="Body."
        confirmLabel="Confirm"
        onConfirm={vi.fn()}
        onCancel={onCancel}
      />,
    );

    await user.keyboard('{Escape}');

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it('wraps forward from the last control back to the first', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open confirmation' }));
    // The confirm action holds focus first, so one Tab reaches the cancel action.
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Deactivate' }));

    await user.tab();

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Cancel' }));
    expect(document.activeElement).not.toBe(
      screen.getByRole('button', { name: 'Background action' }),
    );
  });

  it('wraps backward from the first control to the last', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open confirmation' }));
    screen.getByRole('button', { name: 'Cancel' }).focus();

    await user.tab({ shift: true });

    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Deactivate' }));
  });

  it('never moves focus to the page behind the dialog', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'Open confirmation' }));
    const background = screen.getByRole('button', { name: 'Background action' });

    for (let step = 0; step < 6; step += 1) {
      await user.tab();
      expect(document.activeElement).not.toBe(background);
    }
  });
});

describe('confirming', () => {
  it('reports the confirmation without trapping the user', async () => {
    const user = userEvent.setup();
    render(<Harness />);

    await user.click(screen.getByRole('button', { name: 'Open confirmation' }));
    await user.click(screen.getByRole('button', { name: 'Deactivate' }));

    expect(screen.queryByRole('alertdialog')).toBeNull();
  });
});
