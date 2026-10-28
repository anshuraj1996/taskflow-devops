import { Role } from '@prisma/client';
import { canAssignTo, canDeleteTask, canEditTask } from '../../src/modules/tasks/tasks.policy';
import type { AuthUser } from '../../src/types/express';

const user = (id: string, role: Role): AuthUser => ({ id, role, email: `${id}@x.dev`, name: id });

const admin = user('admin', Role.ADMIN);
const owner = user('owner', Role.MANAGER);
const otherManager = user('mgr2', Role.MANAGER);
const member = user('member', Role.MEMBER);
const project = { ownerId: owner.id };

describe('tasks.policy', () => {
  describe('canAssignTo', () => {
    it('lets admins and the project owner assign to anyone', () => {
      expect(canAssignTo(admin, project, member.id)).toBe(true);
      expect(canAssignTo(owner, project, member.id)).toBe(true);
    });

    it('lets other members assign only to themselves or unassign', () => {
      expect(canAssignTo(member, project, member.id)).toBe(true);
      expect(canAssignTo(member, project, null)).toBe(true);
      expect(canAssignTo(member, project, owner.id)).toBe(false);
      // A manager who does not own the project is treated as a regular member of it.
      expect(canAssignTo(otherManager, project, member.id)).toBe(false);
    });
  });

  describe('canEditTask', () => {
    it('allows the assignee and the creator', () => {
      expect(canEditTask(member, project, { assignedToId: member.id, createdById: owner.id })).toBe(
        true,
      );
      expect(canEditTask(member, project, { assignedToId: null, createdById: member.id })).toBe(
        true,
      );
    });

    it('denies unrelated members but allows owners and admins', () => {
      const task = { assignedToId: owner.id, createdById: owner.id };
      expect(canEditTask(member, project, task)).toBe(false);
      expect(canEditTask(otherManager, project, task)).toBe(false);
      expect(canEditTask(admin, project, task)).toBe(true);
    });
  });

  describe('canDeleteTask', () => {
    it('is restricted to admins and the project owner', () => {
      expect(canDeleteTask(admin, project)).toBe(true);
      expect(canDeleteTask(owner, project)).toBe(true);
      expect(canDeleteTask(member, project)).toBe(false);
      expect(canDeleteTask(otherManager, project)).toBe(false);
    });
  });
});
