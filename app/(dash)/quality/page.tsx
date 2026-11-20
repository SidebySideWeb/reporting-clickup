import { Card, Kpi, Progress } from "@/components/ui";
import { qualityChecks } from "@/lib/metrics";
import { snapshot } from "@/lib/snapshot";

export default async function Quality() {
  const { m, ex } = await snapshot();
  const checks = qualityChecks(m, ex);
  const bad = checks.filter((c) => c.count > 0);
  const issues = checks.slice(0, 5).reduce((s, c) => s + c.count, 0);
  const total = checks.slice(0, 5).reduce((s, c) => s + c.total, 0);
  const score = total ? Math.round((1 - issues / total) * 100) : 100;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Data quality</h1>
          <p className="muted">Can we trust the reports? Fix these first (report X12). Every other number depends on them.</p>
        </div>
      </div>
      <div className="grid kpis">
        <Kpi label="Task data completeness" value={`${score}%`} sub="estimate, due date, assignee, TEAM, Client" />
        <Kpi label="Checks with gaps" value={`${bad.length} of ${checks.length}`} />
        <Kpi label="Time entries analysed" value={ex.length.toLocaleString("en-GB")} sub="last 70 days" />
      </div>
      <Card>
        {checks.map((c) => {
          const share = c.count / c.total;
          return (
            <div className="check" key={c.id}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
                <strong>{c.label}</strong>
                <span className={c.count ? "flag" : "ok"}>{c.count ? `${c.count} of ${c.total}` : "✓ No gaps"}</span>
              </div>
              <div className="small">{c.why}</div>
              {c.count > 0 ? (
                <>
                  <div style={{ maxWidth: 320, marginTop: 6 }}>
                    <Progress value={share} tone={share > 0.3 ? "crit" : "warn"} />
                  </div>
                  <ul>
                    {c.samples.map((s, i) => (
                      <li key={i}>
                        {s.url ? <a href={s.url} target="_blank" rel="noreferrer">{s.name}</a> : s.name}
                        {s.detail ? <span className="small"> · {s.detail}</span> : null}
                      </li>
                    ))}
                    {c.count > c.samples.length ? <li className="small">…and {c.count - c.samples.length} more</li> : null}
                  </ul>
                </>
              ) : null}
            </div>
          );
        })}
      </Card>
    </>
  );
}
