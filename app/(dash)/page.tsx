import Link from "next/link";
import { Card, HealthBadge, Kpi } from "@/components/ui";
import { fmtDate, fmtH } from "@/lib/dates";
import { addDays } from "@/lib/dates";
import { computePlanning, qualityChecks, rangeDates, timeSummary } from "@/lib/metrics";
import { snapshot } from "@/lib/snapshot";

export default async function Overview() {
  const { m, ex, raw } = await snapshot();
  const planning = computePlanning(m, 8);
  const wk = rangeDates("this-week", m.today);
  const time = timeSummary(m, ex, wk.from, wk.to);
  const active = m.projects.filter((p) => p.active && p.kind === "project");
  const count = (h: string) => active.filter((p) => p.health === h).length;
  const attention = m.projects.filter((p) => p.active && (p.health !== "Green" || p.budgetAlert)).sort((a, b) => (a.health === "Red" ? -1 : 1) - (b.health === "Red" ? -1 : 1));

  const expected = time.people.reduce((s, p) => s + p.expected, 0);
  const tracked = time.people.reduce((s, p) => s + p.tracked, 0);
  const coverage = expected > 0 ? tracked / expected : null;
  const low = time.people.filter((p) => p.coverage !== null && p.coverage < 0.9).sort((a, b) => a.coverage! - b.coverage!);

  const free4 = planning.teamRows.map((t) => ({ team: t.team, free: t.cells.slice(0, 4).reduce((s, c) => s + c.free, 0), over: t.cells.slice(0, 4).filter((c) => c.free < 0).length }));
  const totalFree4 = free4.reduce((s, t) => s + t.free, 0);

  const checks = qualityChecks(m, ex);
  const taskChecks = checks.slice(0, 5);
  const issues = taskChecks.reduce((s, c) => s + c.count, 0);
  const total = taskChecks.reduce((s, c) => s + c.total, 0);
  const quality = total ? Math.round((1 - issues / total) * 100) : 100;
  const worst = [...checks].filter((c) => c.count > 0).sort((a, b) => b.count / b.total - a.count / a.total).slice(0, 4);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Overview</h1>
          <p className="muted">
            Week of {fmtDate(wk.from)} · data from ClickUp refreshed {new Date(raw.fetchedAt).toLocaleTimeString("en-GB", { timeZone: "Europe/Athens", hour: "2-digit", minute: "2-digit" })}
          </p>
        </div>
      </div>

      <div className="grid kpis">
        <Kpi label="Active projects" value={active.length} sub={`${count("Red")} red · ${count("Amber")} amber · ${count("Green")} green`} />
        <Kpi label="Hours tracked this week" value={`${fmtH(time.total)}h`} sub={`${time.total ? Math.round((time.billable / time.total) * 100) : 0}% billable`} />
        <Kpi label="Time coverage" value={coverage === null ? "–" : `${Math.round(coverage * 100)}%`} sub={`${low.length} ${low.length === 1 ? "person" : "people"} under 90% so far`} />
        <Kpi label="Free capacity, next 4 weeks" value={`${fmtH(totalFree4)}h`} sub="at 80% of capacity, after planned load" />
        <Kpi label="Data quality" value={`${quality}%`} sub={`${issues} gaps across open tasks`} />
      </div>

      <div className="grid cols-2">
        <Card title="Needs attention" aside={<Link href="/projects">All projects</Link>}>
          {attention.length === 0 ? (
            <p className="ok">All active projects are on plan.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Project</th><th>Health</th><th>Why</th></tr></thead>
                <tbody>
                  {attention.slice(0, 8).map((p) => (
                    <tr key={p.key}>
                      <td><strong>{p.name}</strong><div className="small">{p.client}</div></td>
                      <td><HealthBadge health={p.health} source={p.healthSource} computed={p.computedHealth} /></td>
                      <td className="muted">{p.why.length ? p.why.join(" · ") : "Set by PM in ClickUp"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Capacity by team, next 4 weeks" aside={<Link href="/planning">Details</Link>}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Team</th>{planning.weeks.slice(0, 4).map((w) => <th key={w} className="num">{fmtDate(w).slice(0, 5)}</th>)}<th className="num">Free</th></tr></thead>
              <tbody>
                {planning.teamRows.map((t) => (
                  <tr key={t.team}>
                    <td>{t.team}<div className="small">{t.people} people</div></td>
                    {t.cells.slice(0, 4).map((c, i) => (
                      <td key={i} className={`num ${c.free < 0 ? "flag" : ""}`}>{fmtH(c.free)}h</td>
                    ))}
                    <td className="num"><strong>{fmtH(free4.find((x) => x.team === t.team)!.free)}h</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="small" style={{ marginTop: 8 }}>Negative numbers mean the team is over its plannable capacity that week.</p>
        </Card>

        <Card title="Time tracking this week" aside={<Link href="/time">Details</Link>}>
          {low.length === 0 ? (
            <p className="ok">Everyone is at 90% or more of expected hours.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Person</th><th className="num">Tracked</th><th className="num">Expected so far</th><th className="num">Coverage</th></tr></thead>
                <tbody>
                  {low.slice(0, 6).map((p) => (
                    <tr key={p.person.id}>
                      <td>{p.person.name}<div className="small">{p.person.team}</div></td>
                      <td className="num">{fmtH(p.tracked)}h</td>
                      <td className="num">{fmtH(p.expected)}h</td>
                      <td className="num flag">{Math.round(p.coverage! * 100)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Biggest data gaps" aside={<Link href="/quality">All checks</Link>}>
          {worst.length === 0 ? (
            <p className="ok">No gaps found.</p>
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Check</th><th className="num">Affected</th></tr></thead>
                <tbody>
                  {worst.map((c) => (
                    <tr key={c.id}><td>{c.label}</td><td className="num">{c.count} of {c.total}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
      <p className="small" style={{ marginTop: 16 }}>
        Rules follow SOP v4: plan at 80% of capacity, Amber up to 5 working days of slip, Red above 5 or Blocked over 3 working days, standard rate €{40}/h. Next planning week starts {fmtDate(addDays(planning.weeks[0], 7))}.
      </p>
    </>
  );
}
