import { getEntries, getMembers, getTasks } from "./clickup";
import { CONFIG } from "./config";
import { mockData } from "./mock";
import type { RawData } from "./types";

const TTL = CONFIG.revalidate * 1000;
const g = globalThis as unknown as { __andkoCache?: { at: number; data?: RawData; pending?: Promise<RawData> } };

async function load(): Promise<RawData> {
  if (CONFIG.demo) return mockData();
  const now = Date.now();
  const [members, tasks] = await Promise.all([getMembers(), getTasks()]);
  const entries = await getEntries(members, now - 70 * 864e5, now + 864e5);
  return { members, tasks, entries, fetchedAt: now, demo: false };
}

// In-memory cache per server instance + de-duplication of concurrent loads, to stay under the ClickUp rate limit.
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
    if (c.data) return c.data; // serve stale data rather than an error page
    throw e;
  }
}
