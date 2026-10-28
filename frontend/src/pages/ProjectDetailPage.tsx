import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ProjectStatusBadge, RoleBadge } from '../components/Badges';
import { ErrorMessage } from '../components/ErrorMessage';
import { Modal } from '../components/Modal';
import { Spinner } from '../components/Spinner';
import { ProjectForm } from '../features/projects/ProjectForm';
import { TaskBoard } from '../features/tasks/TaskBoard';
import { TaskForm } from '../features/tasks/TaskForm';
import { useAuth } from '../hooks/useAuth';
import {
  projectsService,
  tasksService,
  type ProjectInput,
  type TaskInput,
} from '../services/taskflow';
import type { Task, TaskStatus } from '../services/types';

// The board shows up to this many tasks; the Tasks page offers full filtering/pagination.
const BOARD_LIMIT = 100;

export function ProjectDetailPage() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [creatingTask, setCreatingTask] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingProject, setEditingProject] = useState(false);

  const projectQuery = useQuery({
    queryKey: ['project', id],
    queryFn: () => projectsService.get(id),
  });
  const tasksQuery = useQuery({
    queryKey: ['tasks', { projectId: id, board: true }],
    queryFn: () =>
      tasksService.list({ projectId: id, limit: BOARD_LIMIT, sortBy: 'priority', order: 'desc' }),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['tasks'] });
    queryClient.invalidateQueries({ queryKey: ['project', id] });
    queryClient.invalidateQueries({ queryKey: ['projects'] });
    queryClient.invalidateQueries({ queryKey: ['dashboard'] });
  };

  const createTask = useMutation({
    mutationFn: (input: TaskInput) => tasksService.create(id, input),
    onSuccess: () => {
      invalidate();
      setCreatingTask(false);
    },
  });
  const updateTask = useMutation({
    mutationFn: ({ taskId, input }: { taskId: string; input: Partial<TaskInput> }) =>
      tasksService.update(taskId, input),
    onSuccess: invalidate,
  });
  const deleteTask = useMutation({
    mutationFn: (taskId: string) => tasksService.remove(taskId),
    onSuccess: () => {
      invalidate();
      setEditingTask(null);
    },
  });
  const updateProject = useMutation({
    mutationFn: (input: Partial<ProjectInput>) => projectsService.update(id, input),
    onSuccess: () => {
      invalidate();
      setEditingProject(false);
    },
  });

  if (projectQuery.isPending) return <Spinner />;
  if (projectQuery.error) return <ErrorMessage error={projectQuery.error} />;

  const project = projectQuery.data;
  const isArchived = project.status === 'ARCHIVED';
  const canManage = project.canManage;
  const canEditTask = (task: Task) =>
    !isArchived && (canManage || task.assignedToId === user?.id || task.createdById === user?.id);

  return (
    <div className="space-y-6">
      <div>
        <Link to="/projects" className="text-sm text-indigo-600 hover:underline">
          ← All projects
        </Link>
        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-semibold">{project.name}</h1>
              <ProjectStatusBadge status={project.status} />
            </div>
            <p className="mt-1 max-w-2xl text-sm text-slate-500">
              {project.description || 'No description'}
            </p>
          </div>
          <div className="flex gap-2">
            {canManage && (
              <>
                <button className="btn btn-secondary" onClick={() => setEditingProject(true)}>
                  Edit
                </button>
                <button
                  className="btn btn-secondary"
                  disabled={updateProject.isPending}
                  onClick={() =>
                    updateProject.mutate({ status: isArchived ? 'ACTIVE' : 'ARCHIVED' })
                  }
                >
                  {isArchived ? 'Unarchive' : 'Archive'}
                </button>
              </>
            )}
            {!isArchived && (
              <button className="btn btn-primary" onClick={() => setCreatingTask(true)}>
                New task
              </button>
            )}
          </div>
        </div>
      </div>

      <ErrorMessage error={updateTask.error ?? updateProject.error} />

      <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
        <span className="font-medium">Members:</span>
        {project.members.map((m) => (
          <span
            key={m.id}
            className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 ring-1 ring-slate-200"
          >
            {m.name}
            {m.id === project.ownerId ? (
              <span className="text-xs text-indigo-600">(owner)</span>
            ) : (
              <RoleBadge role={m.role} />
            )}
          </span>
        ))}
      </div>

      {tasksQuery.isPending && <Spinner label="Loading tasks" />}
      <ErrorMessage error={tasksQuery.error} />
      {tasksQuery.data && (
        <>
          <TaskBoard
            tasks={tasksQuery.data.data}
            canEdit={canEditTask}
            onSelect={setEditingTask}
            onStatusChange={(task, status: TaskStatus) =>
              updateTask.mutate({ taskId: task.id, input: { status } })
            }
          />
          {tasksQuery.data.meta.total > BOARD_LIMIT && (
            <p className="text-sm text-slate-500">
              Showing {BOARD_LIMIT} of {tasksQuery.data.meta.total} tasks.{' '}
              <Link to={`/tasks?projectId=${id}`} className="text-indigo-600 hover:underline">
                View all
              </Link>
            </p>
          )}
        </>
      )}

      <Modal title="New task" open={creatingTask} onClose={() => setCreatingTask(false)}>
        <TaskForm
          members={project.members}
          canAssignOthers={canManage}
          currentUserId={user?.id ?? ''}
          onSubmit={(input) => createTask.mutateAsync(input)}
          onCancel={() => setCreatingTask(false)}
        />
      </Modal>

      <Modal title="Task details" open={editingTask !== null} onClose={() => setEditingTask(null)}>
        {editingTask && (
          <>
            {canEditTask(editingTask) ? (
              <TaskForm
                key={editingTask.id}
                initial={editingTask}
                members={project.members}
                canAssignOthers={canManage}
                currentUserId={user?.id ?? ''}
                submitLabel="Save changes"
                onSubmit={async (input) => {
                  await updateTask.mutateAsync({ taskId: editingTask.id, input });
                  setEditingTask(null);
                }}
                onCancel={() => setEditingTask(null)}
              />
            ) : (
              <div className="space-y-2 text-sm">
                <p className="font-medium">{editingTask.title}</p>
                <p className="text-slate-600">{editingTask.description || 'No description'}</p>
                <p className="text-xs text-slate-500">
                  You can view this task but only its assignee, creator or the project owner can
                  edit it.
                </p>
              </div>
            )}
            {canManage && !isArchived && (
              <div className="mt-6 border-t border-slate-100 pt-4">
                <ErrorMessage error={deleteTask.error} />
                <button
                  className="btn btn-danger"
                  disabled={deleteTask.isPending}
                  onClick={() => {
                    if (window.confirm(`Delete “${editingTask.title}”? This cannot be undone.`)) {
                      deleteTask.mutate(editingTask.id);
                    }
                  }}
                >
                  Delete task
                </button>
              </div>
            )}
          </>
        )}
      </Modal>

      <Modal title="Edit project" open={editingProject} onClose={() => setEditingProject(false)}>
        <ProjectForm
          initial={{
            name: project.name,
            description: project.description,
            members: project.members,
          }}
          ownerId={project.ownerId}
          submitLabel="Save changes"
          onSubmit={(input) => updateProject.mutateAsync(input)}
          onCancel={() => setEditingProject(false)}
        />
      </Modal>
    </div>
  );
}
