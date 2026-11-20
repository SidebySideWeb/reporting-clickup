import capacityCfg from "@/config/capacity.json";
import { pick } from "./clickup";
import { CONFIG } from "./config";
import { addDays, dow, diffDays, isWorkday, today as todayKey, weekStart, workdaysBetween } from "./dates";
import type { Entry, RawData, Task } from "./types";

// ---------- Model ----------
export type Person = { id: number; name: string; email: string; team: string; weeklyHours: number; leave: { from: string; to: string }[] };
export type Health = "Green" | "Amber" | "Red";
export type Project = {
  key: string;
  name: string;
  client: string;
  kind: "project" | "support" | "presales" | "internal";
  overview: Task | null;
  tasks: Task[]; // work tasks (no overview / milestone / risk)
  leaf: Task[];
  openLeaf: Task[];
  estH: number;
  doneEstH: number;
  progress: number; // 0..1
  spentH: number;
  offerH: number | null;
  realH: number | null;
  budgetH: number | null;
  budgetUsed: number | null; // 0..n
  baseline: string | null;
  forecast: string | null;
  slipWd: number | null;
  blocked: Task[];
  overdue: Task[];
  readyQa: Task[];
  milestones: Task[];
  nextMilestone: Task | null;
  risks: Task[];
  health: Health;
  computedHealth: Health;
  healthSource: "ClickUp" | "Computed";
  why: string[];
  budgetAlert: boolean;
  overOffer: boolean;
  active: boolean;
};
export type Model = {
  raw: RawData;
  today: string;
  holidays: Set<string>;
  people: Person[];
  personById: Map<number, Person>;
  byId: Map<string, Task>;
  leaf: Task[];
  projects: Project[];
  projectByKey: Map<string, Project>;
};

const kindOf = (t: Task) => {
  const n = t.typeName.toLowerCase();
  if (n !== "task") return n;
  const nm = t.name.toLowerCase();
  if (/^overview\b/.test(nm)) return "overview";
  if (/^milestone\b/.test(nm) || t.tags.includes("milestone")) return "milestone";
  if (/^risk\b/.test(nm)) return "risk";
  return "task";
};
export const isWork = (t: Task) => kindOf(t) === "task";
export const has = (t: Task, s: string) => t.status.toLowerCase().includes(s);
const toNum = (v: unknown) => (v === null || v === undefined || v === "" || isNaN(Number(v)) ? null : Number(v));

export function projectKeyOf(t: Task) {
  return t.spaceId === CONFIG.clientsSpaceId ? t.listId : t.folderId ?? t.listId;
}

export function buildModel(raw: RawData): Model {
  const t0 = todayKey();
  const holidays = new Set<string>(capacityCfg.holidays);
  const cfg = capacityCfg.people as Record<string, { weeklyHours?: number; team?: string; leave?: { from: string; to: string }[] }>;

  const teamVotes = new Map<number, Map<string, number>>();
  for (const t of raw.tasks) {
    if (!t.team) continue;
    for (const a of t.assignees) {
      const m = teamVotes.get(a.id) ?? new Map();
      m.set(t.team, (m.get(t.team) ?? 0) + 1);
      teamVotes.set(a.id, m);
    }
  }
  const excluded = new Set(((capacityCfg as { excluded?: string[] }).excluded ?? []).map((x) => x.toLowerCase()));
  const activeIds = new Set<number>([...raw.entries.map((e) => e.userId), ...raw.tasks.filter((t) => !t.done).flatMap((t) => t.assignees.map((a) => a.id))]);
  const people: Person[] = raw.members
    .filter((m) => !excluded.has(m.email) && !excluded.has(m.name.toLowerCase()) && (activeIds.has(m.id) || cfg[m.email]))
    .map((m) => {
    const c = cfg[m.email] ?? cfg[m.name.toLowerCase()] ?? {};
    const votes = [...(teamVotes.get(m.id) ?? new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1]);
    return {
      id: m.id,
      name: m.name,
      email: m.email,
      team: c.team ?? votes[0]?.[0] ?? "Unassigned",
      weeklyHours: c.weeklyHours ?? capacityCfg.defaultWeeklyHours,
      leave: c.leave ?? [],
    };
  });
  const personById = new Map(people.map((p) => [p.id, p]));
  const byId = new Map(raw.tasks.map((t) => [t.id, t]));

  const groups = new Map<string, Task[]>();
  for (const t of raw.tasks) {
    const k = projectKeyOf(t);
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(t);
  }
  const projects = [...groups.entries()].map(([key, all]) => buildProject(key, all, t0, holidays));
  const leaf = projects.flatMap((p) => p.leaf);
  return { raw, today: t0, holidays, people, personById, byId, leaf, projects, projectByKey: new Map(projects.map((p) => [p.key, p])) };
}

function buildProject(key: string, all: Task[], today: string, holidays: Set<string>): Project {
  const first = all[0];
  const clients = first.spaceId === CONFIG.clientsSpaceId;
  const overview = all.find((t) => kindOf(t) === "overview" && !t.parent) ?? null;
  const tasks = all.filter(isWork);
  const parents = new Set(tasks.map((t) => t.parent).filter(Boolean) as string[]);
  const leaf = tasks.filter((t) => !parents.has(t.id));
  const openLeaf = leaf.filter((t) => !t.done);
  const milestones = all.filter((t) => kindOf(t) === "milestone");
  const risks = all.filter((t) => kindOf(t) === "risk" && !t.done);

  const listName = first.listName;
  const kind: Project["kind"] =
    first.spaceId === CONFIG.internalSpaceId ? "internal" : /support/i.test(listName) ? "support" : /presales/i.test(listName) ? "presales" : "project";
  const name = clients ? (kind === "support" ? `${first.folderName ?? ""} · Support`.replace(/^ · /, "") : listName) : first.folderName ?? listName;
  const client =
    overview?.client ?? (clients ? first.folderName : null) ?? tasks.find((t) => t.client)?.client ?? first.folderName ?? "—";

  const estH = leaf.reduce((s, t) => s + t.estimateH, 0);
  const doneEstH = leaf.filter((t) => t.done).reduce((s, t) => s + t.estimateH, 0);
  const progress = estH > 0 ? doneEstH / estH : leaf.length ? leaf.filter((t) => t.done).length / leaf.length : 0;
  const spentH = tasks.reduce((s, t) => s + t.spentH, 0);

  const f = overview?.fields ?? {};
  const offerH = toNum(pick(f, CONFIG.fields.offerHours));
  const realH = toNum(pick(f, CONFIG.fields.realEstimate));
  const budgetH = toNum(pick(f, CONFIG.fields.budgetHours)) ?? realH ?? offerH ?? (estH > 0 ? estH : null);
  const budgetUsed = budgetH ? spentH / budgetH : null;

  const baselineField = pick(f, CONFIG.fields.baselineEnd);
  const msDue = milestones.map((m) => m.due).filter(Boolean) as string[];
  const baseline = (typeof baselineField === "string" && /^\d{4}-\d{2}-\d{2}$/.test(baselineField) ? baselineField : null) ?? overview?.due ?? (msDue.length ? msDue.sort().at(-1)! : null);
  const openDue = [...openLeaf, ...milestones.filter((m) => !m.done)].map((t) => t.due).filter(Boolean) as string[];
  const forecast = openDue.length ? openDue.sort().at(-1)! : null;
  const slipWd = kind === "project" && baseline && forecast && forecast > baseline ? workdaysBetween(addDays(baseline, 1), forecast, holidays).length : kind === "project" && baseline && forecast ? 0 : null;

  const wdSince = (d: string) => (d >= today ? 0 : workdaysBetween(addDays(d, 1), today, holidays).length);
  const blocked = openLeaf.filter((t) => has(t, "blocked"));
  const overdue = openLeaf.filter((t) => t.due && t.due < today);
  const readyQa = openLeaf.filter((t) => has(t, "ready for qa") && wdSince(t.updated) > 1);
  const nextMilestone = milestones.filter((m) => !m.done && m.due).sort((a, b) => a.due!.localeCompare(b.due!))[0] ?? null;

  const budgetAlert = budgetUsed !== null && budgetUsed >= 0.8 && progress < 0.8 && kind !== "support";
  const overOffer = offerH !== null && spentH > offerH;
  const longBlocked = blocked.some((t) => wdSince(t.updated) > 3);

  // Health: PM-set value in ClickUp wins; otherwise computed with SOP v4 rules.
  const why: string[] = [];
  let health: Health = "Green";
  if ((slipWd ?? 0) > 0) why.push(`forecast ${slipWd} working days after baseline`);
  if (longBlocked) why.push("blocked more than 3 working days");
  else if (blocked.length) why.push(`${blocked.length} blocked`);
  if (budgetAlert) why.push("budget alert: 80% of hours used, under 80% done");
  if (overdue.length) why.push(`${overdue.length} overdue`);
  if ((slipWd ?? 0) > 5 || longBlocked) health = "Red";
  else if (why.length) health = "Amber";
  const computedHealth = health;
  let healthSource: Project["healthSource"] = "Computed";
  const set = pick(f, CONFIG.fields.health);
  if (typeof set === "string") {
    const m = set.match(/red|amber|green/i);
    if (m) {
      health = (m[0][0].toUpperCase() + m[0].slice(1).toLowerCase()) as Health;
      healthSource = "ClickUp";
    }
  }

  return {
    key, name, client, kind, overview, tasks, leaf, openLeaf, estH, doneEstH, progress, spentH, offerH, realH, budgetH, budgetUsed,
    baseline, forecast, slipWd, blocked, overdue, readyQa, milestones, nextMilestone, risks, health, computedHealth, healthSource, why, budgetAlert, overOffer,
    active: openLeaf.length > 0,
  };
}

// ---------- Capacity & planning ----------
export function personDayCap(p: Person) {
  return p.weeklyHours / 5;
}
export function onLeave(p: Person, k: string) {
  return p.leave.some((l) => k >= l.from && k <= l.to);
}
export function capacityBetween(m: Model, p: Person, from: string, to: string) {
  return workdaysBetween(from, to, m.holidays).filter((d) => !onLeave(p, d)).length * personDayCap(p);
}
const nextWorkday = (k: string, h: Set<string>) => {
  let d = k;
  while (!isWorkday(d, h)) d = addDays(d, 1);
  return d;
};

export type LoadCell = { cap: number; plan: number; load: number; free: number };
export type PlanningRow = { key: string; name: string; team: string; cells: LoadCell[]; unscheduled: number; inProgress: number };

export function computePlanning(m: Model, nWeeks = 8) {
  const weeks = Array.from({ length: nWeeks }, (_, i) => addDays(weekStart(m.today), 7 * i));
  const load = new Map<string, number[]>();
  const unsched = new Map<string, number>();
  const bump = (key: string, wi: number, h: number) => {
    const a = load.get(key) ?? load.set(key, Array(nWeeks).fill(0)).get(key)!;
    a[wi] += h;
  };
  const open = m.leaf.filter((t) => !t.done && !has(t, "unqualified"));
  for (const t of open) {
    const rem = Math.max(0, t.estimateH - t.spentH);
    if (rem <= 0) continue;
    const who = t.assignees.length ? t.assignees.map((a) => String(a.id)) : ["unassigned"];
    const share = rem / who.length;
    if (!t.due) {
      who.forEach((w) => unsched.set(w, (unsched.get(w) ?? 0) + share));
      continue;
    }
    const s = t.start && t.start > m.today ? t.start : m.today;
    const e = t.due < s ? s : t.due;
    let days = workdaysBetween(s, e, m.holidays);
    if (!days.length) days = [nextWorkday(e, m.holidays)];
    const per = share / days.length;
    for (const d of days) {
      const wi = Math.floor(diffDays(weeks[0], weekStart(d)) / 7);
      if (wi >= 0 && wi < nWeeks) who.forEach((w) => bump(w, wi, per));
    }
  }
  const wip = new Map<string, number>();
  for (const t of m.leaf) if (!t.done && has(t, "in progress")) t.assignees.forEach((a) => wip.set(String(a.id), (wip.get(String(a.id)) ?? 0) + 1));

  const rows: PlanningRow[] = m.people.map((p) => {
    const l = load.get(String(p.id)) ?? Array(nWeeks).fill(0);
    return {
      key: String(p.id),
      name: p.name,
      team: p.team,
      unscheduled: unsched.get(String(p.id)) ?? 0,
      inProgress: wip.get(String(p.id)) ?? 0,
      cells: weeks.map((w, i) => {
        const cap = capacityBetween(m, p, w, addDays(w, 6));
        const plan = cap * CONFIG.planningFactor;
        return { cap, plan, load: l[i], free: plan - l[i] };
      }),
    };
  });
  const un = load.get("unassigned");
  if (un || unsched.get("unassigned")) {
    rows.push({
      key: "unassigned",
      name: "Unassigned work",
      team: "—",
      unscheduled: unsched.get("unassigned") ?? 0,
      inProgress: 0,
      cells: weeks.map((_, i) => ({ cap: 0, plan: 0, load: un?.[i] ?? 0, free: -(un?.[i] ?? 0) })),
    });
  }
  const teams = [...new Set(rows.filter((r) => r.team !== "—").map((r) => r.team))];
  const teamRows = teams.map((team) => {
    const rs = rows.filter((r) => r.team === team);
    return {
      team,
      people: rs.length,
      cells: weeks.map((_, i) => {
        const cap = rs.reduce((s, r) => s + r.cells[i].cap, 0);
        const load = rs.reduce((s, r) => s + r.cells[i].load, 0);
        return { cap, plan: cap * CONFIG.planningFactor, load, free: cap * CONFIG.planningFactor - load };
      }),
    };
  });
  return { weeks, rows, teamRows };
}

// ---------- Time ----------
export type EntryX = Entry & { project: string; projectKey: string; client: string; done: boolean };

export function enrichEntries(m: Model): EntryX[] {
  return m.raw.entries.map((e) => {
    const t = e.taskId ? m.byId.get(e.taskId) : undefined;
    const proj = t ? m.projectByKey.get(projectKeyOf(t)) : undefined;
    const fallbackName = [e.folderName, e.listName].filter(Boolean).join(" / ") || "Unknown";
    return {
      ...e,
      project: proj?.name ?? fallbackName,
      projectKey: proj?.key ?? `loc:${e.listId ?? "?"}`,
      client: t?.client ?? proj?.client ?? e.folderName ?? "—",
      done: Boolean(t?.done && e.date > t.updated),
    };
  });
}

export type RangeId = "this-week" | "last-week" | "this-month" | "last-month" | "last-30";
export const RANGES: { id: RangeId; label: string }[] = [
  { id: "this-week", label: "This week" },
  { id: "last-week", label: "Last week" },
  { id: "this-month", label: "This month" },
  { id: "last-month", label: "Last month" },
  { id: "last-30", label: "Last 30 days" },
];
export function rangeDates(id: RangeId, t: string): { from: string; to: string } {
  const ws = weekStart(t);
  switch (id) {
    case "last-week":
      return { from: addDays(ws, -7), to: addDays(ws, -1) };
    case "this-month":
      return { from: t.slice(0, 8) + "01", to: t };
    case "last-month": {
      const first = t.slice(0, 8) + "01";
      const last = addDays(first, -1);
      return { from: last.slice(0, 8) + "01", to: last };
    }
    case "last-30":
      return { from: addDays(t, -29), to: t };
    default:
      return { from: ws, to: addDays(ws, 6) };
  }
}

type Agg = { name: string; hours: number; billable: number };
const agg = (map: Map<string, Agg>, key: string, name: string, h: number, b: boolean) => {
  const a = map.get(key) ?? map.set(key, { name, hours: 0, billable: 0 }).get(key)!;
  a.hours += h;
  if (b) a.billable += h;
};
const sorted = (m: Map<string, Agg>) => [...m.values()].sort((a, b) => b.hours - a.hours);

export function timeSummary(m: Model, ex: EntryX[], from: string, to: string) {
  const inR = ex.filter((e) => e.date >= from && e.date <= to);
  const byClient = new Map<string, Agg>();
  const byProject = new Map<string, Agg & { client: string }>();
  const byPerson = new Map<string, Agg>();
  const matrix = new Map<string, Map<string, number>>();
  for (const e of inR) {
    agg(byClient, e.client, e.client, e.hours, e.billable);
    agg(byProject, e.projectKey, e.project, e.hours, e.billable);
    byProject.get(e.projectKey)!.client = e.client;
    agg(byPerson, String(e.userId), e.userName, e.hours, e.billable);
    const row = matrix.get(String(e.userId)) ?? matrix.set(String(e.userId), new Map()).get(String(e.userId))!;
    row.set(e.project, (row.get(e.project) ?? 0) + e.hours);
  }
  const total = inR.reduce((s, e) => s + e.hours, 0);
  const billable = inR.filter((e) => e.billable).reduce((s, e) => s + e.hours, 0);

  const elapsedTo = to < m.today ? to : m.today;
  const people = m.people.map((p) => {
    const mine = inR.filter((e) => e.userId === p.id);
    const tracked = mine.reduce((s, e) => s + e.hours, 0);
    const bill = mine.filter((e) => e.billable).reduce((s, e) => s + e.hours, 0);
    const capRange = capacityBetween(m, p, from, to);
    const expected = from <= elapsedTo ? capacityBetween(m, p, from, elapsedTo) : 0;
    const days = from <= elapsedTo ? workdaysBetween(from, elapsedTo, m.holidays).filter((d) => !onLeave(p, d)) : [];
    const perDay = new Map<string, number>();
    mine.forEach((e) => perDay.set(e.date, (perDay.get(e.date) ?? 0) + e.hours));
    const noTime = days.filter((d) => !perDay.get(d));
    const low = days.filter((d) => (perDay.get(d) ?? 0) > 0 && perDay.get(d)! < 4);
    const high = [...perDay.entries()].filter(([, h]) => h > 10);
    return {
      person: p,
      tracked,
      billable: bill,
      capRange,
      expected,
      coverage: expected > 0 ? tracked / expected : null,
      utilisation: capRange > 0 ? tracked / capRange : null,
      billableUtil: capRange > 0 ? bill / capRange : null,
      noTimeDays: noTime.length,
      lowDays: low.length,
      highDays: high.length,
      onDone: mine.filter((e) => e.done).length,
    };
  });

  // weekly trend: last 9 weeks
  const w0 = addDays(weekStart(m.today), -56);
  const trend = Array.from({ length: 9 }, (_, i) => {
    const ws = addDays(w0, 7 * i);
    const we = addDays(ws, 6);
    const rs = ex.filter((e) => e.date >= ws && e.date <= we);
    return { week: ws, hours: rs.reduce((s, e) => s + e.hours, 0), billable: rs.filter((e) => e.billable).reduce((s, e) => s + e.hours, 0) };
  });

  return {
    total,
    billable,
    byClient: sorted(byClient),
    byProject: sorted(byProject) as (Agg & { client: string })[],
    byPerson: sorted(byPerson),
    matrix,
    people,
    trend,
  };
}

// ---------- Risks & milestones ----------
export function wdSince(m: Model, d: string) {
  return d >= m.today ? 0 : workdaysBetween(addDays(d, 1), m.today, m.holidays).length;
}
export function risksSummary(m: Model, ex: EntryX[]) {
  const open = m.leaf.filter((t) => !t.done && !has(t, "unqualified"));
  const last3 = new Set(workdaysBetween(addDays(m.today, -6), m.today, m.holidays).slice(-3));
  const recent = new Set(ex.filter((e) => last3.has(e.date) && e.taskId).map((e) => e.taskId));
  const proj = (t: Task) => m.projectByKey.get(projectKeyOf(t))?.name ?? "";
  const mapT = (t: Task) => ({ t, project: proj(t), age: wdSince(m, t.updated) });
  const milestones = m.projects
    .flatMap((p) => p.milestones.filter((x) => !x.done && x.due).map((x) => ({ t: x, project: p.name, client: p.client, days: diffDays(m.today, x.due!), late: p.slipWd !== null && p.slipWd > 0 })))
    .sort((a, b) => a.t.due!.localeCompare(b.t.due!));
  return {
    blocked: open.filter((t) => has(t, "blocked")).map(mapT).sort((a, b) => b.age - a.age),
    overdue: open.filter((t) => t.due && t.due < m.today).map((t) => ({ ...mapT(t), late: diffDays(t.due!, m.today) })).sort((a, b) => b.late - a.late),
    stale: open.filter((t) => has(t, "in progress") && !recent.has(t.id)).map(mapT),
    readyQa: open.filter((t) => has(t, "ready for qa") && wdSince(m, t.updated) > 1).map(mapT),
    risks: m.projects.flatMap((p) => p.risks.map((t) => ({ t, project: p.name }))),
    milestones: milestones.filter((x) => x.days <= 30),
    atRisk: m.projects.filter((p) => p.active && (p.health !== "Green" || p.budgetAlert || p.overOffer)),
  };
}

// ---------- Data quality (X12) ----------
export type Check = { id: string; label: string; why: string; count: number; total: number; samples: { name: string; url: string; detail: string }[] };
export function qualityChecks(m: Model, ex: EntryX[]): Check[] {
  const open = m.leaf.filter((t) => !t.done);
  const mk = (id: string, label: string, why: string, list: Task[], total: number, detail: (t: Task) => string): Check => ({
    id, label, why, count: list.length, total,
    samples: list.slice(0, 8).map((t) => ({ name: t.name, url: t.url, detail: detail(t) })),
  });
  const proj = (t: Task) => m.projectByKey.get(projectKeyOf(t))?.name ?? "";
  const supportOver8 = open.filter((t) => m.projectByKey.get(projectKeyOf(t))?.kind === "support" && t.estimateH > 8);
  const unqual = m.raw.tasks.filter((t) => has(t, "unqualified") && !t.done && wdSince(m, t.created) > 1);
  const clientEntries = ex.filter((e) => e.spaceId === CONFIG.clientsSpaceId);
  const nonBill = clientEntries.filter((e) => !e.billable);
  const noTask = ex.filter((e) => !e.taskId);
  return [
    mk("est", "Open tasks without a Time Estimate", "Planned load, progress and capacity all depend on estimates.", open.filter((t) => t.estimateH <= 0), open.length, proj),
    mk("due", "Open tasks without a due date", "Tasks without dates are invisible to the capacity view.", open.filter((t) => !t.due), open.length, proj),
    mk("who", "Open tasks without an assignee", "Workload cannot be attributed to a person.", open.filter((t) => t.assignees.length === 0), open.length, proj),
    mk("team", "Open tasks without TEAM", "Team views and team capacity use the TEAM field.", open.filter((t) => !t.team), open.length, proj),
    mk("client", "Open tasks without Client", "Client reports group by the Client field.", open.filter((t) => !t.client), open.length, proj),
    mk("unq", "Unqualified for more than 1 working day", "SOP v4: the PM qualifies new work within 1 working day.", unqual, Math.max(unqual.length, 1), (t) => `created ${t.created}`),
    mk("sup8", "Support tasks estimated over 8 hours", "SOP v4: over 8h is a project, not support.", supportOver8, Math.max(supportOver8.length, 1), (t) => `${t.estimateH}h`),
    {
      id: "nonbill", label: "Client time entries marked non-billable", why: "SOP v4: client time is billable unless the PM records a reason.",
      count: nonBill.length, total: clientEntries.length || 1,
      samples: nonBill.slice(0, 8).map((e) => ({ name: e.taskName, url: "", detail: `${e.userName} · ${e.date} · ${e.hours}h` })),
    },
    {
      id: "notask", label: "Time entries without a task", why: "Time must be logged on a task, never on a list.",
      count: noTask.length, total: ex.length || 1,
      samples: noTask.slice(0, 8).map((e) => ({ name: e.taskName, url: "", detail: `${e.userName} · ${e.date} · ${e.hours}h` })),
    },
  ];
}
