// Demo data so the dashboard works before a ClickUp token is added. All names are fictional.
import { CONFIG } from "./config";
import { addDays, dayKey, dow, today } from "./dates";
import type { Entry, Member, RawData, Task } from "./types";

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const PEOPLE: { name: string; team: string }[] = [
  { name: "Elena Marou", team: "Design" },
  { name: "Nikos Vlachos", team: "Design" },
  { name: "Maria Kosta", team: "Design" },
  { name: "Giorgos Alexiou", team: "Development" },
  { name: "Eleni Dimou", team: "Development" },
  { name: "Petros Nikas", team: "Development" },
  { name: "Katerina Lola", team: "Development" },
  { name: "Sofia Raptis", team: "QA" },
  { name: "Tasos Meres", team: "QA" },
  { name: "Alex Demo (PM)", team: "PM" },
];

type P = { client: string; name: string; kind: "project" | "support" | "internal"; tasks: number; startOff: number; endOff: number; offer: number; behind?: boolean };
const PROJECTS: P[] = [
  { client: "Acme Bank", name: "Mobile Banking Redesign", kind: "project", tasks: 30, startOff: -55, endOff: 45, offer: 900 },
  { client: "Globex Retail", name: "Web Shop Rebuild", kind: "project", tasks: 28, startOff: -40, endOff: 60, offer: 1100 },
  { client: "Initech", name: "Intranet Portal", kind: "project", tasks: 24, startOff: -60, endOff: 12, offer: 700, behind: true },
  { client: "Umbrella Pharma", name: "Corporate Website", kind: "project", tasks: 14, startOff: -20, endOff: 28, offer: 420 },
  { client: "Acme Bank", name: "Support", kind: "support", tasks: 10, startOff: -50, endOff: 20, offer: 160 },
  { client: "Globex Retail", name: "Support", kind: "support", tasks: 8, startOff: -50, endOff: 20, offer: 140 },
  { client: "ANDKO Internal", name: "Rebranding", kind: "internal", tasks: 10, startOff: -30, endOff: 50, offer: 0 },
];

export function mockData(): RawData {
  const rand = rng(42);
  const T = today();
  const ri = (a: number, b: number) => Math.floor(a + rand() * (b - a + 1));
  const members: Member[] = PEOPLE.map((p, i) => ({
    id: 1000 + i,
    name: p.name,
    email: p.name.toLowerCase().replace(/[^a-z]+/g, ".").replace(/\.$/, "") + "@example.com",
  }));
  const byTeam = (team: string) => members.filter((_, i) => PEOPLE[i].team === team);
  const tasks: Task[] = [];
  let seq = 1;
  const mk = (p: P, pi: number, o: Partial<Task> & { name: string }): Task => {
    const spaceId = p.kind === "internal" ? CONFIG.internalSpaceId : CONFIG.clientsSpaceId;
    const id = `demo${seq++}`;
    const t: Task = {
      id,
      url: `https://app.clickup.com/t/${id}`,
      status: "to do",
      done: false,
      assignees: [],
      start: null,
      due: null,
      estimateH: 0,
      spentH: 0,
      created: addDays(T, p.startOff),
      updated: addDays(T, -ri(0, 6)),
      parent: null,
      typeName: "Task",
      tags: [],
      listId: `list${pi}`,
      listName: p.kind === "support" ? "Support" : p.name,
      folderId: `folder${p.client}`,
      folderName: p.client,
      spaceId,
      team: null,
      client: p.client,
      projectType: p.kind === "support" ? "Support" : p.kind === "internal" ? null : "Full Project",
      qa: true,
      fields: {},
      ...o,
    };
    tasks.push(t);
    return t;
  };

  PROJECTS.forEach((p, pi) => {
    const baseline = addDays(T, p.endOff);
    mk(p, pi, {
      name: `Overview · ${p.name}`,
      typeName: "Overview",
      status: "active",
      due: baseline,
      team: "PM",
      fields: {
        health: p.behind ? "Amber" : "Green",
        "offer hours": p.offer || null,
        "real estimate hours": p.offer ? Math.round(p.offer * 1.1) : null,
        "budget hours": p.offer || null,
      },
    });
    const pm = byTeam("PM")[0];
    mk(p, pi, {
      name: `PM coordination – ${p.name}`, team: "PM", status: "in progress", assignees: [{ id: pm.id, name: pm.name }],
      estimateH: Math.max(8, Math.round(p.offer * 0.08)), start: addDays(T, p.startOff), due: baseline,
    });
    const phases = p.kind === "support" ? ["Requests"] : ["Design", "Development", "QA & Delivery"];
    const span = p.endOff - p.startOff;
    const per = Math.max(2, Math.round(p.tasks / phases.length));
    phases.forEach((phase, phi) => {
      const ps = p.startOff + (span * phi) / phases.length;
      const pe = p.startOff + (span * (phi + 1)) / phases.length;
      const team = phase === "Design" ? "Design" : phase === "Development" ? "Development" : phase === "Requests" ? "Development" : "QA";
      const parent = mk(p, pi, { name: `${phase} · ${p.name}`, team, status: "in progress", due: addDays(T, Math.round(pe)) });
      for (let i = 0; i < per; i++) {
        const due = addDays(T, Math.round(ps + ((pe - ps) * (i + 1)) / per) + (p.behind && phi === 0 ? 8 : 0));
        const est = p.kind === "support" ? ri(1, 6) : ri(4, 24);
        const overdue = due < T;
        let status = "to do";
        if (due < addDays(T, -3)) status = rand() < (p.behind ? 0.55 : 0.88) ? "done" : rand() < 0.3 ? "blocked" : "in progress";
        else if (due < addDays(T, 14)) status = rand() < 0.45 ? "in progress" : rand() < 0.2 ? "ready for qa" : "to do";
        if (status === "to do" && due < T) status = "in progress";
        const pool = byTeam(team);
        const who = pool[ri(0, pool.length - 1)];
        mk(p, pi, {
          name: `${phase.split(" ")[0]} task ${i + 1} – ${p.name}`,
          parent: parent.id,
          team,
          status,
          done: status === "done",
          assignees: rand() < 0.04 ? [] : [{ id: who.id, name: who.name }],
          start: addDays(due, -Math.max(2, Math.round(est / 4))),
          due: rand() < 0.04 ? null : due,
          estimateH: rand() < 0.05 ? 0 : est,
          client: rand() < 0.03 ? null : p.client,
          updated: status === "blocked" ? addDays(T, -ri(4, 9)) : status === "ready for qa" ? addDays(T, -ri(1, 4)) : addDays(T, -ri(0, 5)),
          typeName: "Task",
          tags: overdue && status !== "done" ? ["late"] : [],
        });
      }
    });
    if (p.kind === "project") {
      ["Design approved", "Development complete", "Client delivery"].forEach((m, mi) => {
        const d = addDays(T, Math.round(p.startOff + (span * (mi + 1)) / 3) + (p.behind ? 9 : 0));
        mk(p, pi, { name: `Milestone · ${m} – ${p.name}`, typeName: "Milestone", due: d, status: d < T ? "done" : "to do", done: d < T, team: "PM" });
      });
      if (p.behind) mk(p, pi, { name: `Risk · Client feedback delays – ${p.name}`, typeName: "Risk", status: "open", team: "PM", fields: { severity: "High" } });
    }
  });

  // Time entries for the last 70 days
  const holidays = new Set<string>();
  const entries: Entry[] = [];
  const work = tasks.filter((t) => t.typeName === "Task" && t.assignees.length);
  let eid = 1;
  members.forEach((m, mi) => {
    const mine = work.filter((t) => t.assignees[0].id === m.id && (t.status !== "to do" || rand() < 0.1));
    if (!mine.length) return;
    for (let d = -70; d <= 0; d++) {
      const k = addDays(T, d);
      if (dow(k) === 0 || dow(k) === 6 || holidays.has(k)) continue;
      if (mi === 1 && d > -12 && d < -6) continue; // Nikos missed days
      if (rand() < 0.04) continue;
      let hours = 6.4 + rand() * 2.2;
      if (mi === 4 && d === -3) hours = 11.5;
      if (mi === 2 && d > -10) hours = 3 + rand() * 2; // Maria under-tracks lately
      const n = ri(1, 3);
      for (let j = 0; j < n; j++) {
        const t = mine[ri(0, mine.length - 1)];
        const h = Math.round((hours / n) * 4) / 4;
        entries.push({
          id: `e${eid++}`,
          userId: m.id,
          userName: m.name,
          taskId: t.id,
          taskName: t.name,
          hours: h,
          billable: t.spaceId !== CONFIG.internalSpaceId,
          date: k,
          listId: t.listId,
          listName: t.listName,
          folderName: t.folderName,
          spaceId: t.spaceId,
        });
      }
    }
  });
  const spent = new Map<string, number>();
  for (const e of entries) spent.set(e.taskId!, (spent.get(e.taskId!) ?? 0) + e.hours);
  for (const t of tasks) t.spentH = (spent.get(t.id) ?? 0) + (t.done ? t.estimateH * 0.3 : 0);
  const overview = tasks.filter((t) => t.typeName === "Overview");
  void overview;
  void dayKey;
  return { members, tasks, entries, fetchedAt: Date.now(), demo: true };
}
