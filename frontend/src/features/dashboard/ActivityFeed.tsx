import { STATUS_LABELS } from '../../services/labels';
import type { Activity, TaskStatus } from '../../services/types';
import { formatDateTime } from '../../utils/format';

function describe(activity: Activity): string {
  const title = activity.task?.title ?? (activity.details?.title as string | undefined) ?? 'a task';
  switch (activity.action) {
    case 'CREATED':
      return `created “${title}”`;
    case 'STATUS_CHANGED': {
      const to = activity.details?.to as TaskStatus | undefined;
      return `moved “${title}” to ${to ? STATUS_LABELS[to] : 'a new status'}`;
    }
    case 'ASSIGNED':
      return activity.details?.to ? `reassigned “${title}”` : `unassigned “${title}”`;
    case 'UPDATED':
      return `updated “${title}”`;
    case 'DELETED':
      return `deleted “${title}”`;
  }
}

export function ActivityFeed({ items }: { items: Activity[] }) {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">No activity yet.</p>;
  }
  return (
    <ul className="divide-y divide-slate-100">
      {items.map((a) => (
        <li key={a.id} className="py-3 text-sm">
          <p>
            <span className="font-medium">{a.actor.name}</span> {describe(a)}
          </p>
          <p className="text-xs text-slate-500">
            {a.project.name} · {formatDateTime(a.createdAt)}
          </p>
        </li>
      ))}
    </ul>
  );
}
