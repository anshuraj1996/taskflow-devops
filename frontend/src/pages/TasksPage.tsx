import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { PriorityBadge, StatusBadge } from '../components/Badges';
import { PRIORITY_LABELS, STATUS_LABELS } from '../services/labels';
import { ErrorMessage } from '../components/ErrorMessage';
import { Pagination } from '../components/Pagination';
import { Spinner } from '../components/Spinner';
import { useDebounce } from '../hooks/useDebounce';
import { tasksService, type TaskQuery } from '../services/taskflow';
import { TASK_PRIORITIES, TASK_STATUSES } from '../services/types';
import { formatDate, isOverdue } from '../utils/format';

/** Filters live in the URL so views are shareable and survive refreshes. */
export function TasksPage() {
  const [params, setParams] = useSearchParams();
  const get = (key: string) => params.get(key) ?? '';

  const setFilter = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== 'page') next.delete('page');
    setParams(next, { replace: true });
  };

  const q = useDebounce(get('q'));
  const query: TaskQuery = {
    projectId: get('projectId') || undefined,
    status: get('status') || undefined,
    priority: get('priority') || undefined,
    assignedTo: get('assignedTo') || undefined,
    overdue: (get('overdue') as 'true' | '') || undefined,
    q: q || undefined,
    sortBy: (get('sortBy') as TaskQuery['sortBy']) || 'createdAt',
    order: (get('order') as TaskQuery['order']) || 'desc',
    page: Number(get('page')) || 1,
    limit: 20,
  };

  const { data, isPending, isFetching, error } = useQuery({
    queryKey: ['tasks', query],
    queryFn: () => tasksService.list(query),
    placeholderData: keepPreviousData,
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Tasks</h1>
        {isFetching && !isPending && <Spinner label="Updating" />}
      </div>

      <div className="card grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
        <input
          className="input lg:col-span-2"
          placeholder="Search by title"
          aria-label="Search by title"
          value={get('q')}
          onChange={(e) => setFilter('q', e.target.value)}
        />
        <select
          className="input"
          aria-label="Status"
          value={get('status')}
          onChange={(e) => setFilter('status', e.target.value)}
        >
          <option value="">Any status</option>
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <select
          className="input"
          aria-label="Priority"
          value={get('priority')}
          onChange={(e) => setFilter('priority', e.target.value)}
        >
          <option value="">Any priority</option>
          {TASK_PRIORITIES.map((p) => (
            <option key={p} value={p}>
              {PRIORITY_LABELS[p]}
            </option>
          ))}
        </select>
        <select
          className="input"
          aria-label="Assignee"
          value={get('assignedTo')}
          onChange={(e) => setFilter('assignedTo', e.target.value)}
        >
          <option value="">Anyone</option>
          <option value="me">Assigned to me</option>
          <option value="unassigned">Unassigned</option>
        </select>
        <select
          className="input"
          aria-label="Sort"
          value={`${query.sortBy}:${query.order}`}
          onChange={(e) => {
            const [sortBy, order] = e.target.value.split(':');
            const next = new URLSearchParams(params);
            next.set('sortBy', sortBy);
            next.set('order', order);
            next.delete('page');
            setParams(next, { replace: true });
          }}
        >
          <option value="createdAt:desc">Newest first</option>
          <option value="createdAt:asc">Oldest first</option>
          <option value="dueDate:asc">Due soonest</option>
          <option value="priority:desc">Highest priority</option>
          <option value="updatedAt:desc">Recently updated</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-slate-600">
          <input
            type="checkbox"
            checked={get('overdue') === 'true'}
            onChange={(e) => setFilter('overdue', e.target.checked ? 'true' : '')}
          />
          Overdue only
        </label>
        {get('projectId') && (
          <button className="btn btn-secondary" onClick={() => setFilter('projectId', '')}>
            Clear project filter
          </button>
        )}
      </div>

      {isPending && <Spinner />}
      <ErrorMessage error={error} />

      {data && (
        <div className="card overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold tracking-wide text-slate-500 uppercase">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Project</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Priority</th>
                <th className="px-4 py-3">Assignee</th>
                <th className="px-4 py-3">Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.data.map((task) => (
                <tr key={task.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{task.title}</td>
                  <td className="px-4 py-3">
                    <Link
                      to={`/projects/${task.project.id}`}
                      className="text-indigo-600 hover:underline"
                    >
                      {task.project.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={task.status} />
                  </td>
                  <td className="px-4 py-3">
                    <PriorityBadge priority={task.priority} />
                  </td>
                  <td className="px-4 py-3 text-slate-600">{task.assignedTo?.name ?? '—'}</td>
                  <td
                    className={`px-4 py-3 whitespace-nowrap ${isOverdue(task) ? 'font-medium text-red-600' : 'text-slate-600'}`}
                  >
                    {task.dueDate ? formatDate(task.dueDate) : '—'}
                  </td>
                </tr>
              ))}
              {data.data.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-10 text-center text-slate-500">
                    No tasks match these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {data && (
        <Pagination
          page={data.meta.page}
          totalPages={data.meta.totalPages}
          total={data.meta.total}
          onChange={(page) => setFilter('page', String(page))}
        />
      )}
    </div>
  );
}
