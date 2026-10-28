import { PRIORITY_LABELS, STATUS_LABELS } from '../services/labels';
import type { ProjectStatus, Role, TaskPriority, TaskStatus } from '../services/types';

const base = 'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium';

const statusStyles: Record<TaskStatus, string> = {
  TODO: 'bg-slate-100 text-slate-700',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  BLOCKED: 'bg-red-100 text-red-700',
  DONE: 'bg-emerald-100 text-emerald-700',
};

const priorityStyles: Record<TaskPriority, string> = {
  LOW: 'bg-slate-100 text-slate-600',
  MEDIUM: 'bg-amber-100 text-amber-700',
  HIGH: 'bg-orange-100 text-orange-700',
  URGENT: 'bg-red-600 text-white',
};

export function StatusBadge({ status }: { status: TaskStatus }) {
  return <span className={`${base} ${statusStyles[status]}`}>{STATUS_LABELS[status]}</span>;
}

export function PriorityBadge({ priority }: { priority: TaskPriority }) {
  return <span className={`${base} ${priorityStyles[priority]}`}>{PRIORITY_LABELS[priority]}</span>;
}

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <span
      className={`${base} ${status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}
    >
      {status === 'ACTIVE' ? 'Active' : 'Archived'}
    </span>
  );
}

export function RoleBadge({ role }: { role: Role }) {
  const styles: Record<Role, string> = {
    ADMIN: 'bg-purple-100 text-purple-700',
    MANAGER: 'bg-indigo-100 text-indigo-700',
    MEMBER: 'bg-slate-100 text-slate-600',
  };
  return <span className={`${base} ${styles[role]}`}>{role.toLowerCase()}</span>;
}
