import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { Task } from '../../services/types';
import { TaskBoard } from './TaskBoard';

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: crypto.randomUUID(),
    title: 'Task',
    description: '',
    projectId: 'p1',
    assignedToId: null,
    createdById: 'u1',
    status: 'TODO',
    priority: 'MEDIUM',
    dueDate: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    assignedTo: null,
    createdBy: { id: 'u1', name: 'Owner', email: 'o@example.com' },
    project: { id: 'p1', name: 'Project', status: 'ACTIVE' },
    ...overrides,
  };
}

describe('TaskBoard', () => {
  const tasks = [
    makeTask({ title: 'Write docs', status: 'TODO' }),
    makeTask({ title: 'Fix login bug', status: 'IN_PROGRESS', priority: 'URGENT' }),
    makeTask({ title: 'Ship release', status: 'DONE' }),
  ];

  it('places each task in its status column', () => {
    render(
      <TaskBoard tasks={tasks} canEdit={() => true} onSelect={vi.fn()} onStatusChange={vi.fn()} />,
    );

    expect(
      within(screen.getByRole('region', { name: 'Todo' })).getByText('Write docs'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'In Progress' })).getByText('Fix login bug'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Blocked' })).getByText('No tasks'),
    ).toBeInTheDocument();
    expect(
      within(screen.getByRole('region', { name: 'Done' })).getByText('Ship release'),
    ).toBeInTheDocument();
  });

  it('reports status changes', async () => {
    const onStatusChange = vi.fn();
    render(
      <TaskBoard
        tasks={tasks}
        canEdit={() => true}
        onSelect={vi.fn()}
        onStatusChange={onStatusChange}
      />,
    );

    await userEvent.selectOptions(screen.getByLabelText('Change status of Write docs'), 'BLOCKED');

    expect(onStatusChange).toHaveBeenCalledWith(tasks[0], 'BLOCKED');
  });

  it('disables the status control for tasks the user cannot edit', () => {
    render(
      <TaskBoard
        tasks={tasks}
        canEdit={(t) => t.title !== 'Ship release'}
        onSelect={vi.fn()}
        onStatusChange={vi.fn()}
      />,
    );

    expect(screen.getByLabelText('Change status of Ship release')).toBeDisabled();
    expect(screen.getByLabelText('Change status of Write docs')).toBeEnabled();
  });
});
