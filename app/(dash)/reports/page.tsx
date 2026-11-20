import Link from "next/link";
import { Card } from "@/components/ui";

type S = "live" | "partial" | "next";
const R: { id: string; name: string; audience: string; freq: string; status: S; where?: string; note?: string }[] = [
  { id: "PM1", name: "Project progress", audience: "PM, Leads", freq: "Weekly, Wednesday", status: "live", where: "/projects" },
  { id: "PM2", name: "Assignees, workload and time consistency", audience: "PM", freq: "Weekly, Monday", status: "live", where: "/time" },
  { id: "PM3", name: "Scope and budget", audience: "PM, Head PM", freq: "Weekly", status: "partial", where: "/projects", note: "Build/QA/PM split and change requests need the commercial fields" },
  { id: "PM4", name: "Monthly client report, projects", audience: "Client", freq: "Monthly", status: "next", note: "PDF export from PM1 and PM3" },
  { id: "PM5", name: "Monthly client report, support", audience: "Client", freq: "Monthly, 3rd working day", status: "next", note: "PDF export from support lists and time entries" },
  { id: "PM6", name: "Capacity management", audience: "PM", freq: "Weekly, Monday", status: "live", where: "/planning" },
  { id: "PM7", name: "Resource management", audience: "PM", freq: "Weekly", status: "partial", where: "/time", note: "People-by-project matrix is live; concentration risk and Rent Resources next" },
  { id: "L1", name: "Team workload", audience: "Leads", freq: "Weekly, Monday", status: "live", where: "/planning" },
  { id: "L2", name: "Team member time tracking", audience: "Leads", freq: "Weekly, Friday", status: "live", where: "/time" },
  { id: "L3", name: "Milestones and delivery dates", audience: "Leads", freq: "Weekly", status: "live", where: "/risks" },
  { id: "L4", name: "Projects and tasks at risk", audience: "Leads", freq: "Weekly", status: "live", where: "/risks" },
  { id: "O1", name: "Live portfolio and time report", audience: "Owner", freq: "On demand", status: "live", where: "/time" },
  { id: "O2", name: "Capacity for new projects", audience: "Owner", freq: "On demand", status: "live", where: "/planner" },
  { id: "O3", name: "Owner's weekly portfolio view", audience: "Owner", freq: "Weekly", status: "partial", where: "/", note: "Invoices and requests need the commercial record" },
  { id: "X1", name: "Estimate accuracy", audience: "PMs, Leads, owner", freq: "Monthly", status: "next" },
  { id: "X2", name: "Billing status", audience: "PMs, owner", freq: "Weekly", status: "next", note: "Needs invoice dates in the Overview task" },
  { id: "X3", name: "Profitability", audience: "Owner", freq: "Monthly", status: "next", note: "Needs cost per hour (owner decision)" },
  { id: "X4", name: "Pipeline", audience: "PMs, owner", freq: "Weekly", status: "next", note: "Reads the Requests list" },
  { id: "X5", name: "Change requests", audience: "PMs, owner", freq: "Monthly", status: "next" },
  { id: "X6", name: "Quality and rework", audience: "Leads, owner", freq: "Monthly", status: "next" },
  { id: "X7", name: "Support service", audience: "PMs, Leads", freq: "Monthly", status: "next" },
  { id: "X8", name: "Rent Resources", audience: "PMs, owner", freq: "Weekly", status: "next" },
  { id: "X9", name: "Client health", audience: "PMs, owner", freq: "Monthly", status: "next" },
  { id: "X10", name: "Process compliance", audience: "Head PM, owner", freq: "Weekly", status: "next" },
  { id: "X11", name: "Forecast accuracy", audience: "Head PM, owner", freq: "Monthly", status: "next" },
  { id: "X12", name: "Data quality", audience: "Head PM", freq: "Weekly", status: "live", where: "/quality" },
];
const LABEL: Record<S, string> = { live: "Live", partial: "Partly live", next: "Next" };

export default function Reports() {
  const live = R.filter((r) => r.status === "live").length;
  const partial = R.filter((r) => r.status === "partial").length;
  return (
    <>
      <div className="page-head">
        <div>
          <h1>Report catalogue</h1>
          <p className="muted">
            The 26 reports of the Reports Specification. {live} live, {partial} partly live, {R.length - live - partial} next.
          </p>
        </div>
      </div>
      <Card>
        <div className="table-wrap">
          <table>
            <thead><tr><th>ID</th><th>Report</th><th>Audience</th><th>Frequency</th><th>Status</th><th>Notes</th></tr></thead>
            <tbody>
              {R.map((r) => (
                <tr key={r.id}>
                  <td><strong>{r.id}</strong></td>
                  <td>{r.where ? <Link href={r.where}>{r.name}</Link> : r.name}</td>
                  <td className="muted">{r.audience}</td>
                  <td className="muted">{r.freq}</td>
                  <td><span className={`badge ${r.status === "live" ? "badge-Green" : r.status === "partial" ? "badge-Amber" : "badge-neutral"}`}>{LABEL[r.status]}</span></td>
                  <td className="muted">{r.note ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
