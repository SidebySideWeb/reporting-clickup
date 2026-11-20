import Link from "next/link";
import { HealthBadge, Kpi, Progress, RangeNav, TaskLink } from "@/components/ui";
import { CONFIG } from "@/lib/config";
import { fmtDate, fmtH } from "@/lib/dates";
import { snapshot } from "@/lib/snapshot";

const ORDER = { Red: 0, Amber: 1, Green: 2 } as const;
const KIND = { project: "Project", support: "Support", presales: "Presales", internal: "Internal" } as const;

export default async function Projects({ searchParams }: { searchParams: Promise<{ show?: string }> }) {
  const { show = "active" } = await searchParams;
  const { m } = await snapshot();
  const list = m.projects
    .filter((p) => p.tasks.length > 0 && (show === "all" || p.active))
    .sort((a, b) => ORDER[a.health] - ORDER[b.health] || a.client.localeCompare(b.client) || a.name.localeCompare(b.name));
  const sum = (f: (p: (typeof list)[number]) => number) => list.reduce((s, p) => s + f(p), 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Projects</h1>
          <p className="muted">Progress, budget and health per project (reports PM1 and PM3).</p>
        </div>
        <RangeNav base="/projects" param="show" current={show} options={[{ id: "active", label: "Active" }, { id: "all", label: "Including finished" }]} />
      </div>

      <div className="grid kpis">
        <Kpi label="Projects shown" value={list.length} />
        <Kpi label="Hours tracked (all time)" value={`${fmtH(sum((p) => p.spentH))}h`} sub={`€${Math.round(sum((p) => p.spentH) * CONFIG.rate).toLocaleString("en-GB")} at €${CONFIG.rate}/h`} />
        <Kpi label="Budget alerts" value={list.filter((p) => p.budgetAlert).length} sub="80% of hours used, under 80% done" />
        <Kpi label="Over offer hours" value={list.filter((p) => p.overOffer).length} />
      </div>

      <div className="card table-wrap">
        <table>
          <thead>
            <tr>
              <th>Project</th><th>Type</th><th>Health</th><th style={{ minWidth: 150 }}>Progress</th>
              <th className="num">Hours used</th><th className="num">Budget</th><th className="num">Offer</th>
              <th>Baseline</th><th>Forecast</th><th>Next milestone</th><th>Flags</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => {
              const budgetTone = p.budgetUsed !== null && p.budgetUsed > 1 ? "crit" : p.budgetAlert ? "warn" : undefined;
              return (
                <tr key={p.key}>
                  <td>
                    <strong>{p.overview ? <TaskLink url={p.overview.url} name={p.name} /> : p.name}</strong>
                    <div className="small">{p.client}</div>
                  </td>
                  <td>{KIND[p.kind]}</td>
                  <td><HealthBadge health={p.health} source={p.healthSource} computed={p.computedHealth} /></td>
                  <td><Progress value={p.progress} /></td>
                  <td className="num">
                    {fmtH(p.spentH)}h
                    {p.budgetUsed !== null ? <div className={`small ${budgetTone ? "flag" : ""}`}>{Math.round(p.budgetUsed * 100)}% of budget</div> : null}
                  </td>
                  <td className="num">{p.budgetH ? `${fmtH(p.budgetH)}h` : "–"}</td>
                  <td className="num">{p.offerH ? `${fmtH(p.offerH)}h` : "–"}</td>
                  <td>{fmtDate(p.baseline)}</td>
                  <td>
                    {fmtDate(p.forecast)}
                    {p.slipWd ? <div className="small flag">+{p.slipWd} working days</div> : null}
                  </td>
                  <td>
                    {p.nextMilestone ? (
                      <>
                        {p.nextMilestone.name.replace(/^Milestone\s*[·:-]\s*/i, "").replace(/\s*[–-]\s*[^–-]*$/, "")}
                        <div className="small">{fmtDate(p.nextMilestone.due)}</div>
                      </>
                    ) : (
                      "–"
                    )}
                  </td>
                  <td>
                    <div className="chips">
                      {p.blocked.length ? <span className="chip">{p.blocked.length} blocked</span> : null}
                      {p.overdue.length ? <span className="chip">{p.overdue.length} overdue</span> : null}
                      {p.risks.length ? <span className="chip">{p.risks.length} risk{p.risks.length > 1 ? "s" : ""}</span> : null}
                      {p.budgetAlert ? <span className="chip">budget alert</span> : null}
                      {p.overOffer ? <span className="chip">over offer</span> : null}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {list.length === 0 ? <p className="muted" style={{ padding: 12 }}>No projects found in the configured spaces.</p> : null}
      </div>
      <p className="small" style={{ marginTop: 12 }}>
        Progress = estimate of Done tasks ÷ total estimate. Health uses the value set by the PM in ClickUp when it exists; otherwise it is computed with the SOP v4 rules. Hours used come from task time tracked. <Link href="/quality">Check data quality</Link> if numbers look off.
      </p>
    </>
  );
}
