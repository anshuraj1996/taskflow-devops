export type Role = 'ADMIN' | 'MANAGER' | 'MEMBER';
export type ProjectStatus = 'ACTIVE' | 'ARCHIVED';
export type TaskStatus = 'TODO' | 'IN_PROGRESS' | 'BLOCKED' | 'DONE';
export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
export type ActivityAction = 'CREATED' | 'UPDATED' | 'STATUS_CHANGED' | 'ASSIGNED' | 'DELETED';

export const TASK_STATUSES: TaskStatus[] = ['TODO', 'IN_PROGRESS', 'BLOCKED', 'DONE'];
export const TASK_PRIORITIES: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];

export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}

export type UserSummary = Pick<User, 'id' | 'name' | 'email'>;

export interface Project {
  id: string;
  name: string;
  description: string;
  ownerId: string;
  status: ProjectStatus;
  createdAt: string;
  updatedAt: string;
  owner: UserSummary;
  _count: { tasks: number; members: number };
}

export interface ProjectDetail extends Omit<Project, '_count'> {
  members: (UserSummary & { role: Role; joinedAt: string })[];
  taskCounts: Partial<Record<TaskStatus, number>>;
  canManage: boolean;
}

export interface Task {
  id: string;
  title: string;
  description: string;
  projectId: string;
  assignedToId: string | null;
  createdById: string;
  status: TaskStatus;
  priority: TaskPriority;
  dueDate: string | null;
  createdAt: string;
  updatedAt: string;
  assignedTo: UserSummary | null;
  createdBy: UserSummary;
  project: { id: string; name: string; status: ProjectStatus };
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; limit: number; total: number; totalPages: number };
}

export interface Activity {
  id: string;
  action: ActivityAction;
  details: Record<string, unknown> | null;
  createdAt: string;
  actor: UserSummary;
  task: { id: string; title: string } | null;
  project: { id: string; name: string };
}

export interface DashboardSummary {
  totals: {
    projects: number;
    activeProjects: number;
    archivedProjects: number;
    tasks: number;
    overdueTasks: number;
    myOpenTasks: number;
  };
  tasksByStatus: Record<TaskStatus, number>;
  tasksByPriority: Record<TaskPriority, number>;
  recentActivity: Activity[];
}
