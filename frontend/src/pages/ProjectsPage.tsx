import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ProjectStatusBadge } from '../components/Badges';
import { ErrorMessage } from '../components/ErrorMessage';
import { Modal } from '../components/Modal';
import { Pagination } from '../components/Pagination';
import { Spinner } from '../components/Spinner';
import { ProjectForm } from '../features/projects/ProjectForm';
import { useAuth } from '../hooks/useAuth';
import { useDebounce } from '../hooks/useDebounce';
import { projectsService, type ProjectInput } from '../services/taskflow';
import type { ProjectStatus } from '../services/types';

export function ProjectsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<ProjectStatus | ''>('ACTIVE');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const q = useDebounce(search);

  const canCreate = user?.role === 'ADMIN' || user?.role === 'MANAGER';

  const { data, isPending, error } = useQuery({
    queryKey: ['projects', { page, status, q }],
    queryFn: () => projectsService.list({ page, status: status || undefined, q, limit: 12 }),
    placeholderData: keepPreviousData,
  });

  const createMutation = useMutation({
    mutationFn: (input: ProjectInput) => projectsService.create(input),
    onSuccess: (project) => {
      queryClient.invalidateQueries({ queryKey: ['projects'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setCreating(false);
      navigate(`/projects/${project.id}`);
    },
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Projects</h1>
        {canCreate && (
          <button className="btn btn-primary" onClick={() => setCreating(true)}>
            New project
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          className="input max-w-xs"
          placeholder="Search projects"
          aria-label="Search projects"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <select
          className="input max-w-[10rem]"
          aria-label="Filter by status"
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as ProjectStatus | '');
            setPage(1);
          }}
        >
          <option value="ACTIVE">Active</option>
          <option value="ARCHIVED">Archived</option>
          <option value="">All</option>
        </select>
      </div>

      {isPending && <Spinner />}
      <ErrorMessage error={error} />

      {data && data.data.length === 0 && (
        <div className="card p-10 text-center text-sm text-slate-500">
          No projects found.{' '}
          {canCreate ? 'Create one to get started.' : 'Ask a manager to add you to a project.'}
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {data?.data.map((project) => (
          <Link
            key={project.id}
            to={`/projects/${project.id}`}
            className="card block p-5 transition-shadow hover:shadow-md"
          >
            <div className="flex items-start justify-between gap-2">
              <h2 className="font-semibold">{project.name}</h2>
              <ProjectStatusBadge status={project.status} />
            </div>
            <p className="mt-2 line-clamp-2 min-h-10 text-sm text-slate-500">
              {project.description || 'No description'}
            </p>
            <div className="mt-4 flex justify-between text-xs text-slate-500">
              <span>Owner: {project.owner.name}</span>
              <span>
                {project._count.tasks} tasks · {project._count.members} members
              </span>
            </div>
          </Link>
        ))}
      </div>

      {data && (
        <Pagination
          page={data.meta.page}
          totalPages={data.meta.totalPages}
          total={data.meta.total}
          onChange={setPage}
        />
      )}

      <Modal title="New project" open={creating} onClose={() => setCreating(false)}>
        <ProjectForm
          ownerId={user?.id}
          onSubmit={(input) => createMutation.mutateAsync(input)}
          onCancel={() => setCreating(false)}
        />
      </Modal>
    </div>
  );
}
