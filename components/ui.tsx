import Link from "next/link";
import type { ReactNode } from "react";
import { fmtH } from "@/lib/dates";
import type { Health } from "@/lib/metrics";

export function Kpi({ label, value, sub }: { label: string; value: ReactNode; sub?: ReactNode }) {
  return (
    <div className="card kpi">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub ? <div className="sub">{sub}</div> : null}
    </div>
  );
}

export function Card({ title, aside, children }: { title?: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <div className="card">
      {title ? (
        <div className="card-head">
          <h2>{title}</h2>
          {aside ? <span className="small">{aside}</span> : null}
        </div>
      ) : null}
      {children}
    </div>
  );
}

const ICON: Record<Health, string> = { Green: "●", Amber: "▲", Red: "■" };
export function HealthBadge({ health, source, computed }: { health: Health; source?: string; computed?: Health }) {
  return (
    <span className={`badge badge-${health}`} title={source ? `Set by: ${source}` : undefined}>
      <span aria-hidden>{ICON[health]}</span>
      {health}
      {computed && computed !== health ? <span style={{ fontWeight: 500, opacity: 0.8 }}> · calc {computed}</span> : null}
    </span>
  );
}

export function Progress({ value, tone }: { value: number; tone?: "warn" | "crit" }) {
  const pct = Math.max(0, Math.min(1, value)) * 100;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
      <div className={`bar ${tone ?? ""}`} style={{ flex: 1 }} role="progressbar" aria-valuenow={Math.round(pct)} aria-valuemin={0} aria-valuemax={100}>
        <i style={{ width: `${pct}%` }} />
      </div>
      <span className="num" style={{ width: 38 }}>{Math.round(pct)}%</span>
    </div>
  );
}

export function RangeNav({ base, param, options, current }: { base: string; param: string; options: { id: string; label: string }[]; current: string }) {
  return (
    <nav className="seg" aria-label="Filter">
      {options.map((o) => (
        <Link key={o.id} href={`${base}?${param}=${o.id}`} aria-current={o.id === current ? "true" : undefined}>
          {o.label}
        </Link>
      ))}
    </nav>
  );
}

export function TaskLink({ url, name }: { url: string; name: string }) {
  return url ? (
    <a href={url} target="_blank" rel="noreferrer">
      {name}
    </a>
  ) : (
    <>{name}</>
  );
}

export function HBars({ rows, unit = "h", max }: { rows: { name: string; a: number; b?: number }[]; unit?: string; max?: number }) {
  const top = max ?? Math.max(1, ...rows.map((r) => r.a + (r.b ?? 0)));
  return (
    <div className="hbars">
      {rows.map((r) => {
        const total = r.a + (r.b ?? 0);
        return (
          <div className="hbar" key={r.name} title={`${r.name}: ${fmtH(total)}${unit}`}>
            <span className="name">{r.name}</span>
            <span className="track">
              <i style={{ width: `${(r.a / top) * 100}%`, background: "var(--s1)" }} />
              {r.b ? <i style={{ width: `${(r.b / top) * 100}%`, background: "var(--s2)" }} /> : null}
            </span>
            <span className="num">
              {fmtH(total)}
              {unit}
            </span>
          </div>
        );
      })}
    </div>
  );
}

export function HeatCell({ load, plan, cap }: { load: number; plan: number; cap: number }) {
  if (cap <= 0 && load <= 0) return <td className="heat heat-none">–</td>;
  const ratio = plan > 0 ? load / plan : load > 0 ? 9 : 0;
  const cls = ratio > 1 ? "heat-over" : ratio < 0.6 ? "heat-low" : "heat-ok";
  const label = ratio > 1 ? "over" : ratio < 0.6 ? "free" : "ok";
  return (
    <td className={`heat ${cls}`} title={`Planned load ${fmtH(load)}h of ${fmtH(plan)}h plannable (capacity ${fmtH(cap)}h at 80%)`}>
      {fmtH(load)}/{fmtH(plan)}h
      <small>{ratio > 8 ? "no capacity" : `${Math.round(ratio * 100)}% · ${label}`}</small>
    </td>
  );
}
