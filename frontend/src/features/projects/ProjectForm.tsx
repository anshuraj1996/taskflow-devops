import { useQuery } from '@tanstack/react-query';
import { useState, type FormEvent } from 'react';
import { ErrorMessage } from '../../components/ErrorMessage';
import { useDebounce } from '../../hooks/useDebounce';
import { usersService, type ProjectInput } from '../../services/taskflow';
import type { UserSummary } from '../../services/types';

interface Props {
  initial?: { name: string; description: string; members: UserSummary[] };
  ownerId?: string;
  submitLabel?: string;
  onSubmit: (input: ProjectInput) => Promise<unknown>;
  onCancel?: () => void;
}

export function ProjectForm({
  initial,
  ownerId,
  submitLabel = 'Create project',
  onSubmit,
  onCancel,
}: Props) {
  const [name, setName] = useState(initial?.name ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [members, setMembers] = useState<UserSummary[]>(initial?.members ?? []);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const debouncedSearch = useDebounce(search);

  const usersQuery = useQuery({
    queryKey: ['users', debouncedSearch],
    queryFn: () => usersService.list({ q: debouncedSearch, limit: 8 }),
    enabled: debouncedSearch.length > 0,
  });

  const candidates = (usersQuery.data?.data ?? []).filter(
    (u) => !members.some((m) => m.id === u.id),
  );

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await onSubmit({ name, description, memberIds: members.map((m) => m.id) });
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <ErrorMessage error={error} />
      <div>
        <label className="label" htmlFor="project-name">
          Name
        </label>
        <input
          id="project-name"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          minLength={2}
          maxLength={120}
        />
      </div>
      <div>
        <label className="label" htmlFor="project-description">
          Description
        </label>
        <textarea
          id="project-description"
          className="input"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={2000}
        />
      </div>
      <div>
        <label className="label" htmlFor="member-search">
          Members
        </label>
        <div className="mb-2 flex flex-wrap gap-2">
          {members.map((m) => (
            <span
              key={m.id}
              className="inline-flex items-center gap-1 rounded-full bg-indigo-50 px-2 py-1 text-xs text-indigo-700"
            >
              {m.name}
              {m.id !== ownerId && (
                <button
                  type="button"
                  aria-label={`Remove ${m.name}`}
                  className="text-indigo-400 hover:text-indigo-700"
                  onClick={() => setMembers(members.filter((x) => x.id !== m.id))}
                >
                  ✕
                </button>
              )}
            </span>
          ))}
        </div>
        <input
          id="member-search"
          className="input"
          placeholder="Search people by name or email"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        {candidates.length > 0 && (
          <ul className="mt-1 max-h-40 overflow-y-auto rounded-lg border border-slate-200 bg-white text-sm">
            {candidates.map((u) => (
              <li key={u.id}>
                <button
                  type="button"
                  className="w-full px-3 py-2 text-left hover:bg-slate-50"
                  onClick={() => {
                    setMembers([...members, u]);
                    setSearch('');
                  }}
                >
                  {u.name} <span className="text-slate-400">{u.email}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="flex justify-end gap-2">
        {onCancel && (
          <button type="button" className="btn btn-secondary" onClick={onCancel}>
            Cancel
          </button>
        )}
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : submitLabel}
        </button>
      </div>
    </form>
  );
}
