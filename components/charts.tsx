import { fmtDate, fmtH } from "@/lib/dates";

// Stacked weekly hours: billable (blue) + non-billable (orange). Hover any bar for the exact numbers.
export function TrendChart({ data }: { data: { week: string; hours: number; billable: number }[] }) {
  const W = 620, H = 200, L = 38, B = 26, T = 14;
  const max = Math.max(10, ...data.map((d) => d.hours));
  const nice = Math.ceil(max / 50) * 50 || 50;
  const bw = (W - L - 8) / data.length;
  const y = (v: number) => T + (H - T - B) * (1 - v / nice);
  const ticks = [0, nice / 2, nice];
  return (
    <div>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Tracked hours per week, billable and non-billable" style={{ width: "100%", height: "auto" }}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={L} x2={W - 4} y1={y(t)} y2={y(t)} stroke={t === 0 ? "var(--axis)" : "var(--line)"} strokeWidth={1} />
            <text x={L - 6} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--text-3)">{t}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x = L + i * bw + bw * 0.18;
          const w = bw * 0.64;
          const nonB = d.hours - d.billable;
          const last = i === data.length - 1;
          return (
            <g key={d.week} className="bar-group">
              <title>{`Week of ${fmtDate(d.week)}: ${fmtH(d.hours)}h tracked, ${fmtH(d.billable)}h billable (${d.hours ? Math.round((d.billable / d.hours) * 100) : 0}%)`}</title>
              <rect x={x - 3} y={T} width={w + 6} height={H - T - B} fill="transparent" />
              {d.billable > 0 && <rect x={x} y={y(d.billable)} width={w} height={y(0) - y(d.billable)} fill="var(--s1)" rx={3} />}
              {nonB > 0 && <rect x={x} y={y(d.hours)} width={w} height={Math.max(0, y(d.billable) - y(d.hours) - 2)} fill="var(--s2)" rx={3} />}
              <text x={x + w / 2} y={H - 9} textAnchor="middle" fontSize={11} fill="var(--text-3)">{fmtDate(d.week).slice(0, 5)}</text>
              {last && <text x={x + w / 2} y={y(d.hours) - 5} textAnchor="middle" fontSize={11} fontWeight={600} fill="var(--text)">{fmtH(d.hours)}h</text>}
            </g>
          );
        })}
      </svg>
      <div className="legend">
        <span><i style={{ background: "var(--s1)" }} />Billable</span>
        <span><i style={{ background: "var(--s2)" }} />Non-billable</span>
        <span>Week starting (dd/mm)</span>
      </div>
    </div>
  );
}
