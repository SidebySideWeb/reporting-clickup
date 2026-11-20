import { Fragment } from "react";
import { HeatCell, Kpi, RangeNav } from "@/components/ui";
import { CONFIG } from "@/lib/config";
import { fmtDate, fmtH } from "@/lib/dates";
import { computePlanning } from "@/lib/metrics";
import { snapshot } from "@/lib/snapshot";

export default async function Planning({ searchParams }: { searchParams: Promise<{ team?: string }> }) {
  const { team = "all" } = await searchParams;
  const { m } = await snapshot();
  const p = computePlanning(m, 8);
  const rows = p.rows.filter((r) => team === "all" || r.team === team);
  const teams = [...new Set(rows.map((r) => r.team))];
  const next4 = p.teamRows.filter((t) => team === "all" || t.team === team);
  const free4 = next4.reduce((s, t) => s + t.cells.slice(0, 4).reduce((a, c) => a + c.free, 0), 0);
  const overWeeks = next4.reduce((s, t) => s + t.cells.filter((c) => c.free < 0).length, 0);
  const unscheduled = rows.reduce((s, r) => s + r.unscheduled, 0);
  const wipFlag = rows.filter((r) => r.inProgress > 2).length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Capacity & workload</h1>
          <p className="muted">Planned load against capacity, per person and week (reports PM6, PM7, L1). Used for the Monday 09:30 planning meeting.</p>
        </div>
        <RangeNav base="/planning" param="team" current={team} options={[{ id: "all", label: "All teams" }, ...CONFIG.teams.map((t) => ({ id: t, label: t }))]} />
      </div>

      <div className="grid kpis">
        <Kpi label="Free capacity, next 4 weeks" value={`${fmtH(free4)}h`} sub="at 80% after planned load" />
        <Kpi label="Team-weeks over capacity" value={overWeeks} sub="in the next 4 weeks" />
        <Kpi label="Unscheduled work" value={`${fmtH(unscheduled)}h`} sub="estimated, but no due date" />
        <Kpi label="People above WIP limit" value={wipFlag} sub="more than 2 tasks In progress" />
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Person</th>
              {p.weeks.map((w, i) => (
                <th key={w} className="num">{i === 0 ? "This week" : fmtDate(w).slice(0, 5)}</th>
              ))}
              <th className="num">No date</th>
              <th className="num">WIP</th>
            </tr>
          </thead>
          <tbody>
            {(team === "all" ? p.teamRows.map((t) => t.team) : teams).map((tm) => {
              const tr = p.teamRows.find((t) => t.team === tm);
              return (
                <Fragment key={tm}>
                  <tr className="group-row">
                    <td>{tm}</td>
                    {tr
                      ? tr.cells.map((c, i) => (
                          <td key={i} className="num">
                            {fmtH(c.load)}/{fmtH(c.plan)}h
                          </td>
                        ))
                      : p.weeks.map((w) => <td key={w} />)}
                    <td /><td />
                  </tr>
                  {rows.filter((r) => r.team === tm).map((r) => (
                    <tr key={r.key}>
                      <td>{r.name}</td>
                      {r.cells.map((c, i) => (
                        <HeatCell key={i} load={c.load} plan={c.plan} cap={c.cap} />
                      ))}
                      <td className="num">{r.unscheduled > 0 ? `${fmtH(r.unscheduled)}h` : "–"}</td>
                      <td className={`num ${r.inProgress > 2 ? "flag" : ""}`}>{r.inProgress || "–"}</td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
            {rows.filter((r) => r.team === "—").map((r) => (
              <tr key={r.key}>
                <td>{r.name}</td>
                {r.cells.map((c, i) => (
                  <HeatCell key={i} load={c.load} plan={c.plan} cap={c.cap} />
                ))}
                <td className="num">{r.unscheduled > 0 ? `${fmtH(r.unscheduled)}h` : "–"}</td>
                <td />
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="legend">
        <span><i style={{ background: "var(--tint-low)", border: "1px solid var(--line)" }} />Under 60% of plannable hours (free)</span>
        <span><i style={{ background: "var(--tint-good)", border: "1px solid var(--line)" }} />60–100% (ok)</span>
        <span><i style={{ background: "var(--tint-crit)", border: "1px solid var(--line)" }} />Over 100%</span>
      </div>
      <p className="small" style={{ marginTop: 10 }}>
        Each cell shows planned load / plannable hours (80% of capacity). Planned load = remaining Time Estimate of open tasks (including QA and PM tasks), spread evenly over the working days between start (or today) and due date. Overdue tasks count in the current week. Capacity comes from <code>config/capacity.json</code>: 40 h/week unless set, minus holidays and leave.
      </p>
    </>
  );
}
