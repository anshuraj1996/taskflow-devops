import { api } from './api';
import type {
  DashboardSummary,
  Paginated,
  Project,
  ProjectDetail,
  ProjectStatus,
  Role,
  Task,
  TaskPriority,
  TaskStatus,
  User,
} from './types';

export interface AuthResponse {
  user: User;
  accessToken: string;
}

export const authService = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }),
  register: (name: string, email: string, password: string) =>
    api.post<AuthResponse>('/auth/register', { name, email, password }),
  logout: () => api.post<void>('/auth/logout'),
  me: () => api.get<{ user: User }>('/users/me').then((r) => r.user),
};

export const usersService = {
  list: (query: { q?: string; page?: number; limit?: number } = {}) =>
    api.get<Paginated<User>>('/users', query),
  updateRole: (id: string, role: Role) =>
    api.patch<{ user: User }>(`/users/${id}/role`, { role }).then((r) => r.user),
};

export interface ProjectInput {
  name: string;
  description?: string;
  memberIds?: string[];
  status?: ProjectStatus;
}

export const projectsService = {
  list: (query: { status?: ProjectStatus; q?: string; page?: number; limit?: number } = {}) =>
    api.get<Paginated<Project>>('/projects', query),
  get: (id: string) =>
    api.get<{ project: ProjectDetail }>(`/projects/${id}`).then((r) => r.project),
  create: (input: ProjectInput) =>
    api.post<{ project: Project }>('/projects', input).then((r) => r.project),
  update: (id: string, input: Partial<ProjectInput>) =>
    api.patch<{ project: Project }>(`/projects/${id}`, input).then((r) => r.project),
};

export interface TaskInput {
  title: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  dueDate?: string | null;
  assignedToId?: string | null;
}

export interface TaskQuery {
  projectId?: string;
  status?: string;
  priority?: string;
  assignedTo?: string;
  overdue?: 'true' | 'false';
  q?: string;
  sortBy?: 'createdAt' | 'updatedAt' | 'dueDate' | 'priority';
  order?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

export const tasksService = {
  list: (query: TaskQuery = {}) =>
    api.get<Paginated<Task>>('/tasks', query as Record<string, string | number>),
  get: (id: string) => api.get<{ task: Task }>(`/tasks/${id}`).then((r) => r.task),
  create: (projectId: string, input: TaskInput) =>
    api.post<{ task: Task }>(`/projects/${projectId}/tasks`, input).then((r) => r.task),
  update: (id: string, input: Partial<TaskInput>) =>
    api.patch<{ task: Task }>(`/tasks/${id}`, input).then((r) => r.task),
  remove: (id: string) => api.delete(`/tasks/${id}`),
};

export const dashboardService = {
  summary: () => api.get<DashboardSummary>('/dashboard/summary'),
};
