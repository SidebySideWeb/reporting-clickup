import capacity from "@/config/capacity.json";
import { getEntries, getMembers, getTasks } from "./clickup";
import { CONFIG, teamFromCapacity } from "./config";
import { mockData } from "./mock";
import type { Member, RawData, Task } from "./types";

const TTL = CONFIG.revalidate * 1000;
const g = globalThis as unknown as { __andkoCache?: { at: number; data?: RawData; pending?: Promise<RawData> } };

function deriveTeams(tasks: Task[], members: Member[]) {
  const email = new Map(members.map((m) => [m.id, m.email]));
  const people = capacity.people as Record<string, { team?: string; role?: string }>;
  for (const t of tasks) {
    if (t.team) continue;
    for (const a of t.assignees) {
      const role = teamFromCapacity(people[email.get(a.id) ?? ""]);
      if (role) {
        t.team = role;
        break;
      }
    }
  }
}

async function load(): Promise<RawData> {
  if (CONFIG.demo) return mockData();
  const now = Date.now();
  const [members, got] = await Promise.all([getMembers(), getTasks()]);
  deriveTeams(got.tasks, members);
  const entries = await getEntries(members, now - 70 * 864e5, now + 864e5);
  return {
    members,
    tasks: got.tasks,
    entries,
    fetchedAt: now,
    demo: false,
    stale: false,
    warning: null,
    fieldsSeen: got.fieldsSeen,
    fieldsMissing: got.fieldsMissing,
  };
}

// In-memory cache per server instance, plus in-flight de-duplication, to stay under the ClickUp rate limit.
// ponytail: one cache for the whole process; split by workspace if this server ever hosts more than one.
export async function getRaw(): Promise<RawData> {
  const c = (g.__andkoCache ??= { at: 0 });
  if (c.data && Date.now() - c.at < TTL) return c.data;
  if (!c.pending) {
    c.pending = load()
      .then((d) => {
        c.data = d;
        c.at = Date.now();
        return d;
      })
      .finally(() => {
        c.pending = undefined;
      });
  }
  try {
    return await c.pending;
  } catch (e) {
    const message = e instanceof Error ? e.message : "ClickUp request failed";
    if (c.data) return { ...c.data, stale: true, warning: message.slice(0, 180) };
    throw e;
  }
}
