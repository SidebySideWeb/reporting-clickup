import Planner from "@/components/Planner";
import { computePlanning } from "@/lib/metrics";
import { snapshot } from "@/lib/snapshot";

export default async function PlannerPage() {
  const { m } = await snapshot();
  const p = computePlanning(m, 12);
  const free = p.teamRows.map((t) => ({ team: t.team, weeks: t.cells.map((c) => c.free) }));
  return (
    <>
      <div className="page-head">
        <div>
          <h1>New project planner</h1>
          <p className="muted">If we sign this now, when can we start and when can we deliver? (report O2)</p>
        </div>
      </div>
      <Planner weeks={p.weeks} free={free} today={m.today} />
    </>
  );
}
