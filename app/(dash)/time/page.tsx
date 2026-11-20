import { TrendChart } from "@/components/charts";
import { Card, HBars, Kpi, RangeNav } from "@/components/ui";
import { CONFIG } from "@/lib/config";
import { fmtDate, fmtH } from "@/lib/dates";
import { RANGES, rangeDates, timeSummary, type RangeId } from "@/lib/metrics";
import { snapshot } from "@/lib/snapshot";

const pct = (v: number | null) => (v === null ? "–" : `${Math.round(v * 100)}%`);

export default async function Time({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  const { range = "this-week" } = await searchParams;
  const id = (RANGES.some((r) => r.id === range) ? range : "this-week") as RangeId;
  const { m, ex } = await snapshot();
  const { from, to } = rangeDates(id, m.today);
  const t = timeSummary(m, ex, from, to);
  const projCols = t.byProject.slice(0, 6);
  const people = t.people.filter((p) => p.tracked > 0 || p.expected > 0).sort((a, b) => (a.coverage ?? 9) - (b.coverage ?? 9));
  const bp = t.total ? t.billable / t.total : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Time tracking</h1>
          <p className="muted">
            {fmtDate(from)} – {fmtDate(to)} · tracked time per client, project and person (reports O1, PM2, L2).
          </p>
        </div>
        <RangeNav base="/time" param="range" current={id} options={RANGES} />
      </div>

      <div className="grid kpis">
        <Kpi label="Hours tracked" value={`${fmtH(t.total)}h`} sub={`€${Math.round(t.total * CONFIG.rate).toLocaleString("en-GB")} at €${CONFIG.rate}/h`} />
        <Kpi label="Billable share" value={pct(bp)} sub={`${fmtH(t.billable)}h billable`} />
        <Kpi label="Clients with time" value={t.byClient.length} />
        <Kpi label="People below 90% coverage" value={people.filter((p) => p.coverage !== null && p.coverage < 0.9).length} sub="of expected hours so far" />
      </div>

      <div className="grid cols-2">
        <Card title="Weekly trend, last 9 weeks">
          <TrendChart data={t.trend} />
        </Card>
        <Card title="Hours by client">
          {t.byClient.length ? (
            <>
              <HBars rows={t.byClient.slice(0, 10).map((c) => ({ name: c.name, a: c.billable, b: c.hours - c.billable }))} />
              <div className="legend">
                <span><i style={{ background: "var(--s1)" }} />Billable</span>
                <span><i style={{ background: "var(--s2)" }} />Non-billable</span>
              </div>
            </>
          ) : (
            <p className="muted">No time tracked in this period.</p>
          )}
        </Card>
      </div>

      <section className="block">
        <Card title="Time consistency and utilisation by person" aside="Coverage = tracked ÷ expected on working days passed">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Person</th><th className="num">Tracked</th><th className="num">Capacity</th><th className="num">Utilisation</th>
                  <th className="num">Billable util.</th><th className="num">Coverage</th><th className="num">Days no time</th>
                  <th className="num">Days &lt;4h</th><th className="num">Days &gt;10h</th><th className="num">On Done tasks</th>
                </tr>
              </thead>
              <tbody>
                {people.map((p) => (
                  <tr key={p.person.id}>
                    <td>{p.person.name}<div className="small">{p.person.team}</div></td>
                    <td className="num">{fmtH(p.tracked)}h</td>
                    <td className="num">{fmtH(p.capRange)}h</td>
                    <td className={`num ${p.utilisation !== null && p.utilisation > 1 ? "flag" : ""}`}>{pct(p.utilisation)}</td>
                    <td className="num">{pct(p.billableUtil)}</td>
                    <td className={`num ${p.coverage !== null && p.coverage < 0.9 ? "flag" : ""}`}>{pct(p.coverage)}</td>
                    <td className={`num ${p.noTimeDays >= 2 ? "flag" : ""}`}>{p.noTimeDays || "–"}</td>
                    <td className="num">{p.lowDays || "–"}</td>
                    <td className={`num ${p.highDays ? "flag" : ""}`}>{p.highDays || "–"}</td>
                    <td className="num">{p.onDone || "–"}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className="num">{fmtH(people.reduce((s, p) => s + p.tracked, 0))}h</td>
                  <td className="num">{fmtH(people.reduce((s, p) => s + p.capRange, 0))}h</td>
                  <td colSpan={7} />
                </tr>
              </tfoot>
            </table>
          </div>
          <p className="small" style={{ marginTop: 8 }}>
            Flags (red): coverage under 90%, two or more working days without time, utilisation above 100%, days above 10 hours. The Monday check from SOP v4 uses coverage for the previous week.
          </p>
        </Card>
      </section>

      <section className="block">
        <Card title="Hours by project" aside={`${t.byProject.length} projects`}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Project</th><th>Client</th><th className="num">Hours</th><th className="num">Billable</th><th className="num">Non-billable</th><th className="num">Cost at rate</th></tr></thead>
              <tbody>
                {t.byProject.slice(0, 20).map((p) => (
                  <tr key={p.name + p.client}>
                    <td>{p.name}</td>
                    <td className="muted">{p.client}</td>
                    <td className="num">{fmtH(p.hours)}h</td>
                    <td className="num">{fmtH(p.billable)}h</td>
                    <td className="num">{fmtH(p.hours - p.billable)}h</td>
                    <td className="num">€{Math.round(p.hours * CONFIG.rate).toLocaleString("en-GB")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </section>

      <section className="block">
        <Card title="Who worked on what" aside="Hours per person and project (top 6 projects)">
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Person</th>
                  {projCols.map((p) => <th key={p.name + p.client} className="num" title={p.client}>{p.name}</th>)}
                  <th className="num">Other</th>
                </tr>
              </thead>
              <tbody>
                {t.byPerson.map((pp) => {
                  const row = t.matrix.get([...t.matrix.keys()].find((k) => m.personById.get(Number(k))?.name === pp.name) ?? "") ?? new Map<string, number>();
                  const shown = projCols.reduce((s, c) => s + (row.get(c.name) ?? 0), 0);
                  return (
                    <tr key={pp.name}>
                      <td>{pp.name}</td>
                      {projCols.map((c) => <td key={c.name + c.client} className="num">{row.get(c.name) ? `${fmtH(row.get(c.name)!)}h` : "–"}</td>)}
                      <td className="num">{pp.hours - shown > 0.05 ? `${fmtH(pp.hours - shown)}h` : "–"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </section>
    </>
  );
}
