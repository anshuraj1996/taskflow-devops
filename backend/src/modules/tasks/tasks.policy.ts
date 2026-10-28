import type { Project, Task } from '@prisma/client';
import type { AuthUser } from '../../types/express';
import { canManageProject } from '../projects/project.access';

/**
 * Pure permission rules for tasks. The caller has already verified that the user
 * can see the project; these functions decide what they may do within it.
 *
 *  | Action                         | Admin / project owner | Other project members           |
 *  |--------------------------------|-----------------------|---------------------------------|
 *  | Create task                    | yes                   | yes                             |
 *  | Assign to anyone               | yes                   | only themselves (or unassigned) |
 *  | Edit / change status           | any task              | tasks assigned to or created by them |
 *  | Delete task                    | yes                   | no                              |
 */

type ProjectRef = Pick<Project, 'ownerId'>;
type TaskRef = Pick<Task, 'assignedToId' | 'createdById'>;

export function canAssignTo(
  user: AuthUser,
  project: ProjectRef,
  assigneeId: string | null,
): boolean {
  if (canManageProject(user, project)) return true;
  return assigneeId === null || assigneeId === user.id;
}

export function canEditTask(user: AuthUser, project: ProjectRef, task: TaskRef): boolean {
  return (
    canManageProject(user, project) || task.assignedToId === user.id || task.createdById === user.id
  );
}

export function canDeleteTask(user: AuthUser, project: ProjectRef): boolean {
  return canManageProject(user, project);
}
