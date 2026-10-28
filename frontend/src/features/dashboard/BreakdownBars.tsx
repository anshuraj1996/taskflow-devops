interface Props<K extends string> {
  data: Record<K, number>;
  labels: Record<K, string>;
  colors: Record<K, string>;
}

/** Simple horizontal bar breakdown; avoids pulling in a chart library for Phase 1. */
export function BreakdownBars<K extends string>({ data, labels, colors }: Props<K>) {
  const entries = Object.entries(data) as [K, number][];
  const max = Math.max(1, ...entries.map(([, n]) => n));

  return (
    <ul className="space-y-3">
      {entries.map(([key, count]) => (
        <li key={key}>
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-slate-600">{labels[key]}</span>
            <span className="font-medium tabular-nums">{count}</span>
          </div>
          <div className="h-2 rounded-full bg-slate-100">
            <div
              className={`h-2 rounded-full ${colors[key]}`}
              style={{ width: `${(count / max) * 100}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
