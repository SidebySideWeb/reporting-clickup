"use client";
import { useMemo, useState } from "react";

type TeamFree = { team: string; weeks: number[] }; // free plannable hours per week (80% rule), same order as `weeks`
const GATES = ["Design", "Development", "QA"] as const;
const fmt = (k: string) => k.split("-").reverse().slice(0, 2).join("/");
const addDays = (k: string, n: number) => new Date(Date.parse(k + "T00:00:00Z") + n * 864e5).toISOString().slice(0, 10);
const h1 = (n: number) => (Math.round(n * 10) / 10).toString();

export default function Planner({ weeks, free, today }: { weeks: string[]; free: TeamFree[]; today: string }) {
  const [hours, setHours] = useState<Record<string, number>>({ Design: 80, Development: 160, QA: 40, PM: 30 });
  const [share, setShare] = useState<Record<string, number>>({ Design: 50, Development: 50, QA: 60, PM: 30 });
  const [start, setStart] = useState(today);

  const plan = useMemo(() => {
    const startIdx = Math.max(0, weeks.findIndex((w, i) => start < (weeks[i + 1] ?? "9999") && start >= w));
    let cursor = startIdx;
    const out: { team: string; alloc: number[]; first: number | null; last: number | null; left: number }[] = [];
    for (const team of GATES) {
      const f = free.find((x) => x.team === team)?.weeks ?? [];
      let left = hours[team] || 0;
      const alloc = Array(weeks.length).fill(0);
      let first: number | null = null;
      let last: number | null = null;
      for (let i = cursor; i < weeks.length && left > 0.01; i++) {
        const usable = Math.max(0, (f[i] ?? 0) * ((share[team] || 0) / 100));
        const take = Math.min(left, usable);
        if (take > 0) {
          alloc[i] = take;
          left -= take;
          first ??= i;
          last = i;
        }
      }
      out.push({ team, alloc, first, last, left });
      if (last !== null) cursor = Math.min(weeks.length - 1, last + 1); // next gate starts the week after
      else if (left > 0) cursor = weeks.length; // cannot start
    }
    const pm = free.find((x) => x.team === "PM")?.weeks ?? [];
    const firstWeek = out.find((o) => o.first !== null)?.first ?? null;
    const lastWeek = out[2].last;
    let pmAvail = 0;
    if (firstWeek !== null && lastWeek !== null) for (let i = firstWeek; i <= lastWeek; i++) pmAvail += Math.max(0, (pm[i] ?? 0) * ((share.PM || 0) / 100));
    const fits = out.every((o) => o.left <= 0.01 && (o.alloc.some((a) => a > 0) || !hours[o.team]));
    return { out, firstWeek, lastWeek, fits, pmAvail, pmNeed: hours.PM || 0 };
  }, [hours, share, start, weeks, free]);

  const startDate = plan.firstWeek !== null ? (weeks[plan.firstWeek] < start ? start : weeks[plan.firstWeek]) : null;
  const delivery = plan.lastWeek !== null ? addDays(weeks[plan.lastWeek], 4) : null;

  return (
    <div className="planner-grid">
      <div className="card">
        <h2>Candidate project</h2>
        <p className="small">Real estimate in hours per team, from the Leads.</p>
        {["Design", "Development", "QA", "PM"].map((t) => (
          <div key={t}>
            <label htmlFor={`h-${t}`}>{t}: hours · weekly share of free capacity</label>
            <div className="field-row" style={{ gridTemplateColumns: "1fr 1fr" }}>
              <input id={`h-${t}`} type="number" min={0} value={hours[t]} onChange={(e) => setHours({ ...hours, [t]: Number(e.target.value) })} />
              <input aria-label={`${t} share %`} type="number" min={5} max={100} step={5} value={share[t]} onChange={(e) => setShare({ ...share, [t]: Number(e.target.value) })} />
            </div>
          </div>
        ))}
        <label htmlFor="start">Target start date</label>
        <input id="start" type="date" value={start} min={today} onChange={(e) => setStart(e.target.value || today)} />
        <p className="small" style={{ marginTop: 10 }}>
          Share = how much of a team's free plannable hours (80% rule) this project may take each week. Gates run in order: Design, then Development, then QA, each starting the week after the previous one finishes. PM time runs alongside.
        </p>
      </div>

      <div className="grid">
        <div className="card">
          <h2>{plan.fits ? "If we sign now" : "Does not fit in the planning horizon (12 weeks)"}</h2>
          {plan.fits && startDate && delivery ? (
            <div className="grid kpis" style={{ marginTop: 10 }}>
              <div className="kpi"><div className="label">Earliest start</div><div className="value">{fmt(startDate)}</div></div>
              <div className="kpi"><div className="label">Earliest delivery</div><div className="value">{fmt(delivery)}</div><div className="sub">end of the QA week</div></div>
              <div className="kpi"><div className="label">PM time</div><div className={`value ${plan.pmAvail < plan.pmNeed ? "flag" : ""}`}>{plan.pmAvail >= plan.pmNeed ? "Fits" : "Short"}</div><div className="sub">{h1(plan.pmNeed)}h needed, {h1(plan.pmAvail)}h available</div></div>
            </div>
          ) : (
            <p className="muted" style={{ marginTop: 8 }}>
              Not enough free capacity in the 8-week horizon at these shares. Raise the weekly share, reduce hours, or move commitments (see Capacity & workload).
            </p>
          )}
          <p className="small" style={{ marginTop: 8 }}>
            Dates given to a client come from this calculation after the Leads confirm, never from the owner's request alone.
          </p>
        </div>

        <div className="card table-wrap">
          <h2 style={{ marginBottom: 8 }}>Hours placed per week</h2>
          <table>
            <thead>
              <tr>
                <th>Team</th>
                {weeks.map((w) => <th key={w} className="num">{fmt(w)}</th>)}
                <th className="num">Left over</th>
              </tr>
            </thead>
            <tbody>
              {plan.out.map((o) => {
                const f = free.find((x) => x.team === o.team)?.weeks ?? [];
                return (
                  <tr key={o.team}>
                    <td>{o.team}</td>
                    {o.alloc.map((a, i) => (
                      <td key={i} className="num" title={`Free plannable: ${h1(f[i] ?? 0)}h`} style={a > 0 ? { background: "var(--tint-low)" } : (f[i] ?? 0) <= 0 ? { color: "var(--text-3)" } : undefined}>
                        {a > 0 ? h1(a) : (f[i] ?? 0) <= 0 ? "full" : "–"}
                      </td>
                    ))}
                    <td className={`num ${o.left > 0.01 ? "flag" : ""}`}>{o.left > 0.01 ? `${h1(o.left)}h` : "–"}</td>
                  </tr>
                );
              })}
              <tr>
                <td className="small">Free plannable (Dev)</td>
                {(free.find((x) => x.team === "Development")?.weeks ?? []).map((v, i) => <td key={i} className={`num small ${v < 0 ? "flag" : ""}`}>{h1(v)}</td>)}
                <td />
              </tr>
            </tbody>
          </table>
          <p className="small" style={{ marginTop: 8 }}>"full" = the team has no free plannable hours that week.</p>
        </div>
      </div>
    </div>
  );
}
