import { CONFIG } from "./config";
import { dayKey } from "./dates";
import { allocateParentTime } from "./spent";
import type { Entry, Member, Task } from "./types";

export { allocateParentTime };

const BASE = "https://api.clickup.com/api/v2";
const HOUR = 3_600_000;
const WINDOW = 70 * 86_400_000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type CuUser = { id?: number; username?: string; email?: string };
type CuOption = { id?: string; name?: string; label?: string; orderindex?: number };
type CuField = { name?: string; type?: string; value?: unknown; type_config?: { options?: CuOption[] } };
type CuTask = {
  id: string;
  name: string;
  url?: string;
  status?: { status?: string; type?: string };
  assignees?: CuUser[];
  start_date?: string | number | null;
  due_date?: string | number | null;
  time_estimate?: string | number | null;
  time_spent?: string | number | null;
  date_created?: string | number;
  date_updated?: string | number;
  parent?: string | null;
  custom_item_id?: number | null;
  tags?: { name?: string }[];
  list?: { id?: string | number; name?: string };
  folder?: { id?: string | number; name?: string; hidden?: boolean };
  space?: { id?: string | number };
  custom_fields?: CuField[];
};
type CuEntry = {
  id?: string | number;
  duration?: string | number;
  billable?: boolean;
  start?: string | number;
  user?: CuUser;
  task?: { id?: string; name?: string } | null;
  task_location?: { list_id?: string | number; list_name?: string; folder_name?: string; space_id?: string | number };
};

async function cu<T>(path: string): Promise<T> {
  const token = process.env.CLICKUP_API_TOKEN;
  if (!token) throw new Error("CLICKUP_API_TOKEN is not set");
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(BASE + path, { headers: { Authorization: token }, cache: "no-store" });
    if (res.status === 429) {
      await sleep(2000 * (attempt + 1));
      continue;
    }
    if (!res.ok) throw new Error(`ClickUp ${res.status} on ${path.split("?")[0]}`);
    return (await res.json()) as T;
  }
  throw new Error(`ClickUp rate limit on ${path.split("?")[0]}`);
}

export async function getMembers(): Promise<Member[]> {
  const data = await cu<{ teams?: { id?: string | number; members?: { user?: CuUser }[] }[] }>("/team");
  const team = data.teams?.find((t) => String(t.id) === CONFIG.workspaceId) ?? data.teams?.[0];
  return (team?.members ?? [])
    .map((m) => m.user)
    .filter((u): u is CuUser & { id: number } => Boolean(u && u.id))
    .map((u) => ({ id: u.id, name: u.username || u.email || String(u.id), email: (u.email || "").toLowerCase() }));
}

async function getTaskTypes(): Promise<Map<number, string>> {
  try {
    const data = await cu<{ custom_items?: { id: number; name: string }[] }>(`/team/${CONFIG.workspaceId}/custom_item`);
    return new Map((data.custom_items ?? []).map((c) => [c.id, c.name]));
  } catch {
    return new Map();
  }
}

function fieldValue(f: CuField): string | number | boolean | null {
  const v = f.value;
  if (v === undefined || v === null || v === "") return null;
  const opts = f.type_config?.options ?? [];
  switch (f.type) {
    case "drop_down": {
      const o = opts.find((o) => o.orderindex === v || o.id === v);
      return o?.name ?? null;
    }
    case "labels": {
      const names = (Array.isArray(v) ? v : [])
        .map((id) => opts.find((o) => o.id === id)?.label)
        .filter((n): n is string => Boolean(n));
      return names.length ? names.join(", ") : null;
    }
    case "number":
    case "currency":
      return Number(v);
    case "checkbox":
      return v === true || v === "true";
    case "date":
      return dayKey(Number(v));
    case "users": {
      if (!Array.isArray(v)) return null;
      const names = v
        .map((u) => (typeof u === "object" && u && "username" in u ? String((u as { username?: string }).username ?? "") : ""))
        .filter(Boolean);
      return names.length ? names.join(", ") : null;
    }
    default:
      return typeof v === "object" ? JSON.stringify(v) : String(v);
  }
}

export function pick(fields: Task["fields"], aliases: string[]) {
  for (const a of aliases) {
    const v = fields[a.toLowerCase()];
    if (v !== undefined && v !== null) return v;
  }
  return null;
}

export function missingFieldNames(seen: Iterable<string>) {
  const have = new Set([...seen].map((s) => s.toLowerCase()));
  const missing: string[] = [];
  for (const [key, aliases] of Object.entries(CONFIG.fields)) {
    if (!aliases.some((a) => have.has(a.toLowerCase()))) missing.push(`${key} (${aliases.join(" | ")})`);
  }
  return missing;
}

function normTask(t: CuTask, types: Map<number, string>, seen: Map<string, string>): Task {
  const fields: Task["fields"] = {};
  for (const f of t.custom_fields ?? []) {
    if (!f.name) continue;
    const key = f.name.toLowerCase();
    if (!seen.has(key)) seen.set(key, f.name);
    fields[key] = fieldValue(f);
  }
  const stype = t.status?.type ?? "open";
  const asStr = (v: unknown) => (v === null || v === undefined ? null : String(v));
  const qa = pick(fields, CONFIG.fields.qaRequired);
  const listId = String(t.list?.id ?? "");
  const folderId = t.folder?.hidden ? null : asStr(t.folder?.id);
  const spaceId = String(t.space?.id ?? "");
  return {
    id: t.id,
    name: t.name,
    url: t.url || `https://app.clickup.com/t/${t.id}`,
    status: t.status?.status ?? "",
    statusType: String(stype),
    done: stype === "done" || stype === "closed",
    closed: stype === "done" || stype === "closed",
    blocked: String(t.status?.status ?? "").toLowerCase().includes("blocked"),
    assignees: (t.assignees ?? [])
      .filter((a): a is CuUser & { id: number } => Boolean(a.id))
      .map((a) => ({ id: a.id, name: a.username || a.email || String(a.id) })),
    start: t.start_date ? dayKey(Number(t.start_date)) : null,
    due: t.due_date ? dayKey(Number(t.due_date)) : null,
    estimateH: (Number(t.time_estimate) || 0) / HOUR,
    spentH: (Number(t.time_spent) || 0) / HOUR,
    created: dayKey(Number(t.date_created)),
    updated: dayKey(Number(t.date_updated)),
    parent: t.parent ?? null,
    typeName: t.custom_item_id ? types.get(t.custom_item_id) ?? "Task" : "Task",
    tags: (t.tags ?? []).map((x) => String(x.name ?? "").toLowerCase()).filter(Boolean),
    listId,
    projectKey: spaceId === CONFIG.clientsSpaceId ? listId : folderId ?? listId,
    listName: t.list?.name ?? "",
    folderId,
    folderName: t.folder?.hidden ? null : t.folder?.name ?? null,
    spaceId,
    team: asStr(pick(fields, CONFIG.fields.team)),
    client: asStr(pick(fields, CONFIG.fields.client)),
    projectType: asStr(pick(fields, CONFIG.fields.projectType)),
    qa: qa === null ? null : Boolean(qa),
    fields,
  };
}

export async function getTasks(): Promise<{ tasks: Task[]; fieldsSeen: string[]; fieldsMissing: string[] }> {
  const types = await getTaskTypes();
  const seen = new Map<string, string>();
  const spaces = CONFIG.spaceIds.map((s) => `space_ids%5B%5D=${encodeURIComponent(s)}`).join("&");
  const tasks: Task[] = [];
  for (let page = 0; page < 60; page++) {
    const data = await cu<{ tasks?: CuTask[]; last_page?: boolean }>(
      `/team/${CONFIG.workspaceId}/task?page=${page}&include_closed=true&subtasks=true&custom_task_ids=true&${spaces}`,
    );
    for (const t of data.tasks ?? []) tasks.push(normTask(t, types, seen));
    if (data.last_page || !data.tasks?.length) break;
  }
  allocateParentTime(tasks);
  const fieldsSeen = [...seen.values()].sort((a, b) => a.localeCompare(b));
  const fieldsMissing = missingFieldNames(fieldsSeen);
  if (fieldsMissing.length) console.warn(`[clickup] custom fields not found: ${fieldsMissing.join(", ")}`);
  return { tasks, fieldsSeen, fieldsMissing };
}

function normEntry(e: CuEntry): Entry | null {
  const dur = Number(e.duration);
  if (!(dur > 0) || !e.user?.id) return null;
  const task = e.task && typeof e.task === "object" ? e.task : null;
  const loc = e.task_location ?? {};
  return {
    id: String(e.id),
    userId: e.user.id,
    userName: e.user.username || e.user.email || "Unknown",
    taskId: task?.id ?? null,
    taskName: task?.name ?? "(no task)",
    hours: dur / HOUR,
    billable: Boolean(e.billable),
    date: dayKey(Number(e.start)),
    listId: loc.list_id ? String(loc.list_id) : null,
    listName: loc.list_name ?? null,
    folderName: loc.folder_name ?? null,
    spaceId: loc.space_id ? String(loc.space_id) : null,
  };
}

export async function getEntries(members: Member[], fromMs: number, toMs: number): Promise<Entry[]> {
  if (!members.length || !(toMs > fromMs)) return [];
  const ids = members.map((m) => m.id).join(",");
  const out: Entry[] = [];
  for (let start = fromMs; start < toMs; ) {
    const end = Math.min(toMs, start + WINDOW);
    const data = await cu<{ data?: CuEntry[] }>(
      `/team/${CONFIG.workspaceId}/time_entries?start_date=${start}&end_date=${end - 1}&assignee=${ids}&include_location_names=true`,
    );
    for (const e of data.data ?? []) {
      const row = normEntry(e);
      if (row) out.push(row);
    }
    start = end;
  }
  return out;
}
