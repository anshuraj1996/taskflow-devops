import { useState, type FormEvent } from 'react';
import { ErrorMessage } from '../../components/ErrorMessage';
import { PRIORITY_LABELS, STATUS_LABELS } from '../../services/labels';
import type { TaskInput } from '../../services/taskflow';
import {
  TASK_PRIORITIES,
  TASK_STATUSES,
  type Task,
  type TaskPriority,
  type TaskStatus,
  type UserSummary,
} from '../../services/types';

interface Props {
  members: UserSummary[];
  /** When false, the assignee picker only offers the current user (API enforces the same rule). */
  canAssignOthers: boolean;
  currentUserId: string;
  initial?: Task;
  submitLabel?: string;
  onSubmit: (input: TaskInput) => Promise<unknown>;
  onCancel?: () => void;
}

const toDateInput = (iso: string | null | undefined) => (iso ? iso.slice(0, 10) : '');

export function TaskForm({
  members,
  canAssignOthers,
  currentUserId,
  initial,
  submitLabel = 'Create task',
  onSubmit,
  onCancel,
}: Props) {
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [status, setStatus] = useState<TaskStatus>(initial?.status ?? 'TODO');
  const [priority, setPriority] = useState<TaskPriority>(initial?.priority ?? 'MEDIUM');
  const [dueDate, setDueDate] = useState(toDateInput(initial?.dueDate));
  const [assignedToId, setAssignedToId] = useState(initial?.assignedToId ?? '');
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  const assignable = canAssignOthers
    ? members
    : members.filter((m) => m.id === currentUserId || m.id === initial?.assignedToId);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({
        title,
        description,
        status,
        priority,
        // Store due dates at end-of-day UTC so "due today" is not immediately overdue.
        dueDate: dueDate ? new Date(`${dueDate}T23:59:59.000Z`).toISOString() : null,
        assignedToId: assignedToId || null,
      });
      if (!initial) {
        setTitle('');
        setDescription('');
        setDueDate('');
      }
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ErrorMessage error={error} />
      <div>
        <label className="label" htmlFor="task-title">
          Title
        </label>
        <input
          id="task-title"
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          required
          maxLength={200}
        />
      </div>
      <div>
        <label className="label" htmlFor="task-description">
          Description
        </label>
        <textarea
          id="task-description"
          className="input"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={5000}
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="label" htmlFor="task-status">
            Status
          </label>
          <select
            id="task-status"
            className="input"
            value={status}
            onChange={(e) => setStatus(e.target.value as TaskStatus)}
          >
            {TASK_STATUSES.map((s) => (
              <option key={s} value={s}>
                {STATUS_LABELS[s]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="task-priority">
            Priority
          </label>
          <select
            id="task-priority"
            className="input"
            value={priority}
            onChange={(e) => setPriority(e.target.value as TaskPriority)}
          >
            {TASK_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {PRIORITY_LABELS[p]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="label" htmlFor="task-due">
            Due date
          </label>
          <input
            id="task-due"
            type="date"
            className="input"
            value={dueDate}
            onChange={(e) => setDueDate(e.target.value)}
          />
        </div>
        <div>
          <label className="label" htmlFor="task-assignee">
            Assignee
          </label>
          <select
            id="task-assignee"
            className="input"
            value={assignedToId}
            onChange={(e) => setAssignedToId(e.target.value)}
          >
            <option value="">Unassigned</option>
            {assignable.map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
