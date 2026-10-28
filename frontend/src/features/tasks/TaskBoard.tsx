import { PriorityBadge } from '../../components/Badges';
import { STATUS_LABELS } from '../../services/labels';
import { TASK_STATUSES, type Task, type TaskStatus } from '../../services/types';
import { formatDate, isOverdue } from '../../utils/format';

interface Props {
  tasks: Task[];
  onStatusChange: (task: Task, status: TaskStatus) => void;
  onSelect: (task: Task) => void;
  canEdit: (task: Task) => boolean;
}

const columnAccent: Record<TaskStatus, string> = {
  TODO: 'border-t-slate-400',
  IN_PROGRESS: 'border-t-blue-500',
  BLOCKED: 'border-t-red-500',
  DONE: 'border-t-emerald-500',
};

export function TaskBoard({ tasks, onStatusChange, onSelect, canEdit }: Props) {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {TASK_STATUSES.map((status) => {
        const columnTasks = tasks.filter((t) => t.status === status);
        return (
          <section
            key={status}
            aria-label={STATUS_LABELS[status]}
            className={`rounded-xl border border-t-4 border-slate-200 bg-slate-100/60 p-3 ${columnAccent[status]}`}
          >
            <h3 className="mb-3 flex items-center justify-between text-sm font-semibold text-slate-700">
              {STATUS_LABELS[status]}
              <span className="rounded-full bg-white px-2 text-xs text-slate-500">
                {columnTasks.length}
              </span>
            </h3>
            <ul className="space-y-2">
              {columnTasks.map((task) => (
                <li key={task.id} className="card p-3">
                  <button
                    className="w-full cursor-pointer text-left text-sm font-medium hover:text-indigo-600"
                    onClick={() => onSelect(task)}
                  >
                    {task.title}
                  </button>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                    <PriorityBadge priority={task.priority} />
                    {task.dueDate && (
                      <span className={isOverdue(task) ? 'font-medium text-red-600' : ''}>
                        Due {formatDate(task.dueDate)}
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="truncate text-xs text-slate-500">
                      {task.assignedTo?.name ?? 'Unassigned'}
                    </span>
                    <select
                      aria-label={`Change status of ${task.title}`}
                      className="rounded border border-slate-300 bg-white px-1 py-0.5 text-xs disabled:opacity-50"
                      value={task.status}
                      disabled={!canEdit(task)}
                      onChange={(e) => onStatusChange(task, e.target.value as TaskStatus)}
                    >
                      {TASK_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </option>
                      ))}
                    </select>
                  </div>
                </li>
              ))}
              {columnTasks.length === 0 && (
                <li className="py-6 text-center text-xs text-slate-400">No tasks</li>
              )}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
