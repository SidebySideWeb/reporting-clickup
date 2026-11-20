import { CONFIG } from "./config";
import { dayKey } from "./dates";
import type { Entry, Member, Task } from "./types";

const BASE = "https://api.clickup.com/api/v2";
const HOUR = 3_600_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function cu<T>(path: string): Promise<T> {
  const token = process.env.CLICKUP_API_TOKEN!;
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(BASE + path, { headers: { Authorization: token }, cache: "no-store" });
    if (res.status === 429) {
      await sleep(2000 * (attempt + 1)); // rate limit: 100 req/min
      continue;
    }
    if (!res.ok) throw new Error(`ClickUp ${res.status} on ${path.split("?")[0]}: ${(await res.text()).slice(0, 200)}`);
    return (await res.json()) as T;
  }
  throw new Error(`ClickUp rate limit on ${path.split("?")[0]}`);
}

export async function getMembers(): Promise<Member[]> {
  const data = await cu<{ teams: any[] }>("/team");
  const team = data.teams.find((t) => String(t.id) === CONFIG.workspaceId) ?? data.teams[0];
  return (team?.members ?? [])
    .map((m: any) => m.user)
    .filter((u: any) => u && u.id)
    .map((u: any) => ({ id: u.id, name: u.username || u.email || String(u.id), email: (u.email || "").toLowerCase() }));
}

async function getTaskTypes(): Promise<Map<number, string>> {
  try {
    const data = await cu<{ custom_items: { id: number; name: string }[] }>(`/team/${CONFIG.workspaceId}/custom_item`);
    return new Map(data.custom_items.map((c) => [c.id, c.name]));
  } catch {
    return new Map();
  }
}

function fieldValue(f: any): string | number | boolean | null {
  const v = f.value;
  if (v === undefined || v === null || v === "") return null;
  const opts: any[] = f.type_config?.options ?? [];
  switch (f.type) {
    case "drop_down": {
      const o = opts.find((o) => o.orderindex === v || o.id === v);
      return o?.name ?? null;
    }
    case "labels": {
      const names = (Array.isArray(v) ? v : []).map((id: string) => opts.find((o) => o.id === id)?.label).filter(Boolean);
      return names.length ? names.join(", ") : null;
    }
    case "number":
    case "currency":
      return Number(v);
    case "checkbox":
      return v === true || v === "true";
    case "date":
      return dayKey(Number(v));
    case "users":
      return (Array.isArray(v) ? v : []).map((u: any) => u.username).join(", ") || null;
    default:
      return typeof v === "object" ? JSON.stringify(v) : v;
  }
}

export function pick(fields: Task["fields"], aliases: string[]) {
  for (const a of aliases) {
    const v = fields[a.toLowerCase()];
    if (v !== undefined && v !== null) return v;
  }
  return null;
}

function normTask(t: any, types: Map<number, string>): Task {
  const fields: Task["fields"] = {};
  for (const f of t.custom_fields ?? []) fields[String(f.name).toLowerCase()] = fieldValue(f);
  const stype = t.status?.type;
  const asStr = (v: unknown) => (v === null || v === undefined ? null : String(v));
  const qa = pick(fields, CONFIG.fields.qaRequired);
  return {
    id: t.id,
    name: t.name,
    url: t.url,
    status: t.status?.status ?? "",
    done: stype === "done" || stype === "closed",
    assignees: (t.assignees ?? []).map((a: any) => ({ id: a.id, name: a.username || a.email })),
    start: t.start_date ? dayKey(Number(t.start_date)) : null,
    due: t.due_date ? dayKey(Number(t.due_date)) : null,
    estimateH: (Number(t.time_estimate) || 0) / HOUR,
    spentH: (Number(t.time_spent) || 0) / HOUR,
    created: dayKey(Number(t.date_created)),
    updated: dayKey(Number(t.date_updated)),
    parent: t.parent ?? null,
    typeName: t.custom_item_id ? types.get(t.custom_item_id) ?? "Task" : "Task",
    tags: (t.tags ?? []).map((x: any) => String(x.name).toLowerCase()),
    listId: String(t.list?.id ?? ""),
    listName: t.list?.name ?? "",
    folderId: t.folder?.hidden ? null : asStr(t.folder?.id),
    folderName: t.folder?.hidden ? null : t.folder?.name ?? null,
    spaceId: String(t.space?.id ?? ""),
    team: asStr(pick(fields, CONFIG.fields.team)),
    client: asStr(pick(fields, CONFIG.fields.client)),
    projectType: asStr(pick(fields, CONFIG.fields.projectType)),
    qa: qa === null ? null : Boolean(qa),
    fields,
  };
}

export async function getTasks(): Promise<Task[]> {
  const types = await getTaskTypes();
  const spaces = CONFIG.spaceIds.map((s) => `space_ids%5B%5D=${encodeURIComponent(s)}`).join("&");
  const out: Task[] = [];
  for (let page = 0; page < 60; page++) {
    const data = await cu<{ tasks: any[]; last_page?: boolean }>(
      `/team/${CONFIG.workspaceId}/task?page=${page}&include_closed=true&subtasks=true&${spaces}`,
    );
    for (const t of data.tasks) out.push(normTask(t, types));
    if (data.last_page || data.tasks.length === 0) break;
  }
  return out;
}

export async function getEntries(members: Member[], fromMs: number, toMs: number): Promise<Entry[]> {
  const ids = members.map((m) => m.id).join(",");
  const data = await cu<{ data: any[] }>(
    `/team/${CONFIG.workspaceId}/time_entries?start_date=${fromMs}&end_date=${toMs}&assignee=${ids}&include_location_names=true`,
  );
  const out: Entry[] = [];
  for (const e of data.data ?? []) {
    const dur = Number(e.duration);
    if (!(dur > 0)) continue; // running timers have negative duration
    const task = e.task && typeof e.task === "object" ? e.task : null;
    const loc = e.task_location ?? {};
    out.push({
      id: String(e.id),
      userId: e.user?.id,
      userName: e.user?.username || e.user?.email || "Unknown",
      taskId: task?.id ?? null,
      taskName: task?.name ?? "(no task)",
      hours: dur / HOUR,
      billable: Boolean(e.billable),
      date: dayKey(Number(e.start)),
      listId: loc.list_id ? String(loc.list_id) : null,
      listName: loc.list_name ?? null,
      folderName: loc.folder_name ?? null,
      spaceId: loc.space_id ? String(loc.space_id) : null,
    });
  }
  return out;
}
