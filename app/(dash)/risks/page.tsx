import { Card, HealthBadge, Kpi, TaskLink } from "@/components/ui";
import { fmtDate } from "@/lib/dates";
import { risksSummary } from "@/lib/metrics";
import { snapshot } from "@/lib/snapshot";

function Empty({ text }: { text: string }) {
  return <p className="ok">{text}</p>;
}

export default async function Risks() {
  const { m, ex } = await snapshot();
  const r = risksSummary(m, ex);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Risks & milestones</h1>
          <p className="muted">Client delivery dates and what threatens them (reports L3, L4).</p>
        </div>
      </div>

      <div className="grid kpis">
        <Kpi label="Projects at risk" value={r.atRisk.length} sub="Amber, Red, budget alert or over offer" />
        <Kpi label="Blocked tasks" value={r.blocked.length} />
        <Kpi label="Overdue tasks" value={r.overdue.length} />
        <Kpi label="Milestones, next 30 days" value={r.milestones.length} sub={`${r.milestones.filter((x) => x.late).length} on projects forecast late`} />
      </div>

      <Card title="Milestones and delivery dates, next 30 days" aside="Sorted by date">
        {r.milestones.length === 0 ? (
          <Empty text="No open milestones in the next 30 days." />
        ) : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Date</th><th className="num">Days to go</th><th>Milestone</th><th>Project</th><th>Client</th><th>Note</th></tr></thead>
              <tbody>
                {r.milestones.map(({ t, project, client, days, late }) => (
                  <tr key={t.id}>
                    <td>{fmtDate(t.due)}</td>
                    <td className={`num ${days < 0 ? "flag" : ""}`}>{days}</td>
                    <td><TaskLink url={t.url} name={t.name.replace(/^Milestone\s*[·:-]\s*/i, "")} /></td>
                    <td>{project}</td>
                    <td className="muted">{client}</td>
                    <td>{days < 0 ? <span className="flag">Overdue</span> : late ? <span className="flag">Project forecast is late</span> : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <section className="block">
        <Card title="Projects at risk">
          {r.atRisk.length === 0 ? (
            <Empty text="No project is Amber or Red." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Project</th><th>Health</th><th>Cause</th><th>Next milestone</th></tr></thead>
                <tbody>
                  {r.atRisk.map((p) => (
                    <tr key={p.key}>
                      <td><strong>{p.name}</strong><div className="small">{p.client}</div></td>
                      <td><HealthBadge health={p.health} source={p.healthSource} computed={p.computedHealth} /></td>
                      <td>{p.why.length ? p.why.join(" · ") : p.overOffer ? "Hours above offer" : "Set by PM in ClickUp"}</td>
                      <td>{p.nextMilestone ? fmtDate(p.nextMilestone.due) : "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="small" style={{ marginTop: 8 }}>Add the owner and the next step in the project's Overview task in ClickUp, so the report can show them.</p>
        </Card>
      </section>

      <div className="grid cols-2" style={{ marginTop: 18 }}>
        <Card title="Blocked tasks" aside="Red after 3 working days">
          {r.blocked.length === 0 ? (
            <Empty text="Nothing is blocked." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Task</th><th>Project</th><th className="num">Age (working days)</th></tr></thead>
                <tbody>
                  {r.blocked.map(({ t, project, age }) => (
                    <tr key={t.id}>
                      <td><TaskLink url={t.url} name={t.name} /><div className="small">{t.assignees.map((a) => a.name).join(", ") || "Unassigned"}</div></td>
                      <td>{project}</td>
                      <td className={`num ${age > 3 ? "flag" : ""}`}>{age}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card title="Overdue tasks">
          {r.overdue.length === 0 ? (
            <Empty text="No overdue tasks." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Task</th><th>Project</th><th className="num">Days late</th></tr></thead>
                <tbody>
                  {r.overdue.slice(0, 15).map(({ t, project, late }) => (
                    <tr key={t.id}>
                      <td><TaskLink url={t.url} name={t.name} /><div className="small">{t.assignees.map((a) => a.name).join(", ") || "Unassigned"}</div></td>
                      <td>{project}</td>
                      <td className="num flag">{late}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {r.overdue.length > 15 ? <p className="small">Showing 15 of {r.overdue.length}.</p> : null}
            </div>
          )}
        </Card>

        <Card title="In progress, no time logged for 3 working days">
          {r.stale.length === 0 ? (
            <Empty text="All in-progress tasks have recent time." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Task</th><th>Project</th></tr></thead>
                <tbody>
                  {r.stale.slice(0, 15).map(({ t, project }) => (
                    <tr key={t.id}>
                      <td><TaskLink url={t.url} name={t.name} /><div className="small">{t.assignees.map((a) => a.name).join(", ") || "Unassigned"}</div></td>
                      <td>{project}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {r.stale.length > 15 ? <p className="small">Showing 15 of {r.stale.length}.</p> : null}
            </div>
          )}
        </Card>

        <Card title="Ready for QA for more than 1 working day">
          {r.readyQa.length === 0 ? (
            <Empty text="QA is keeping up." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Task</th><th>Project</th><th className="num">Waiting (working days)</th></tr></thead>
                <tbody>
                  {r.readyQa.map(({ t, project, age }) => (
                    <tr key={t.id}>
                      <td><TaskLink url={t.url} name={t.name} /></td>
                      <td>{project}</td>
                      <td className="num flag">{age}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>

      <section className="block">
        <Card title="Open risks">
          {r.risks.length === 0 ? (
            <Empty text="No open Risk tasks." />
          ) : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Risk</th><th>Project</th><th>Severity</th><th>Owner</th></tr></thead>
                <tbody>
                  {r.risks.map(({ t, project }) => (
                    <tr key={t.id}>
                      <td><TaskLink url={t.url} name={t.name.replace(/^Risk\s*[·:-]\s*/i, "")} /></td>
                      <td>{project}</td>
                      <td>{String(t.fields["severity"] ?? "–")}</td>
                      <td>{t.assignees.map((a) => a.name).join(", ") || "–"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </section>
    </>
  );
}
