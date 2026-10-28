import type { ReactNode } from 'react';

export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 to-slate-100 p-4">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6 flex flex-col items-center gap-2">
          <img src="/favicon.svg" alt="" className="h-10 w-10" />
          <h1 className="text-xl font-semibold">{title}</h1>
        </div>
        {children}
      </div>
    </div>
  );
}
