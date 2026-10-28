import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { PRIORITY_LABELS, STATUS_LABELS } from '../services/labels';
import { ErrorMessage } from '../components/ErrorMessage';
import { Spinner } from '../components/Spinner';
import { ActivityFeed } from '../features/dashboard/ActivityFeed';
import { BreakdownBars } from '../features/dashboard/BreakdownBars';
import { useAuth } from '../hooks/useAuth';
import { dashboardService } from '../services/taskflow';

function StatCard({
  label,
  value,
  to,
  tone = 'text-slate-900',
}: {
  label: string;
  value: number;
  to?: string;
  tone?: string;
}) {
  const body = (
    <>
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-3xl font-semibold tabular-nums ${tone}`}>{value}</p>
    </>
  );
  return to ? (
    <Link to={to} className="card block p-5 transition-shadow hover:shadow-md">
      {body}
    </Link>
  ) : (
    <div className="card p-5">{body}</div>
  );
}

export function DashboardPage() {
  const { user } = useAuth();
  const { data, isPending, error } = useQuery({
    queryKey: ['dashboard'],
    queryFn: dashboardService.summary,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome back, {user?.name.split(' ')[0]}</h1>
        <p className="text-sm text-slate-500">Here is what is happening across your projects.</p>
      </div>

      {isPending && <Spinner />}
      <ErrorMessage error={error} />

      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Active projects" value={data.totals.activeProjects} to="/projects" />
            <StatCard label="Total tasks" value={data.totals.tasks} to="/tasks" />
            <StatCard
              label="Overdue tasks"
              value={data.totals.overdueTasks}
              to="/tasks?overdue=true"
              tone={data.totals.overdueTasks > 0 ? 'text-red-600' : 'text-slate-900'}
            />
            <StatCard
              label="My open tasks"
              value={data.totals.myOpenTasks}
              to="/tasks?assignedTo=me"
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            <section className="card p-5">
              <h2 className="mb-4 font-semibold">Tasks by status</h2>
              <BreakdownBars
                data={data.tasksByStatus}
                labels={STATUS_LABELS}
                colors={{
                  TODO: 'bg-slate-400',
                  IN_PROGRESS: 'bg-blue-500',
                  BLOCKED: 'bg-red-500',
                  DONE: 'bg-emerald-500',
                }}
              />
            </section>
            <section className="card p-5">
              <h2 className="mb-4 font-semibold">Tasks by priority</h2>
              <BreakdownBars
                data={data.tasksByPriority}
                labels={PRIORITY_LABELS}
                colors={{
                  LOW: 'bg-slate-400',
                  MEDIUM: 'bg-amber-400',
                  HIGH: 'bg-orange-500',
                  URGENT: 'bg-red-600',
                }}
              />
            </section>
            <section className="card p-5">
              <h2 className="mb-2 font-semibold">Recent activity</h2>
              <ActivityFeed items={data.recentActivity} />
            </section>
          </div>
        </>
      )}
    </div>
  );
}
