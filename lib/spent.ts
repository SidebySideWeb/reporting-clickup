// Parent time is either rolled into the parent by ClickUp or logged on the parent itself.
// Move the part children do not already explain onto those children, and clear it on the parent,
// so a sum of tasks counts each hour once.
// ponytail: walks the whole task list a few times; index by parent if a workspace grows past a few thousand tasks.
export function allocateParentTime<T extends { id: string; parent: string | null; spentH: number; estimateH: number }>(tasks: T[]) {
  const byId = new Map(tasks.map((t) => [t.id, t]));
  const byParent = new Map<string, T[]>();
  for (const t of tasks) {
    if (!t.parent || !byId.has(t.parent)) continue;
    const list = byParent.get(t.parent) ?? [];
    list.push(t);
    byParent.set(t.parent, list);
  }
  const raw = new Map(tasks.map((t) => [t.id, t.spentH]));
  for (const t of tasks) {
    const kids = byParent.get(t.id) ?? [];
    const d = raw.get(t.id) ?? 0;
    if (!kids.length) {
      t.spentH = d;
      continue;
    }
    const childSum = kids.reduce((s, k) => s + (raw.get(k.id) ?? 0), 0);
    t.spentH = childSum > 0 && d >= childSum - 1e-6 ? Math.max(0, d - childSum) : d;
  }
  const depth = new Map<string, number>();
  const depthOf = (id: string, seen = new Set<string>()): number => {
    const hit = depth.get(id);
    if (hit !== undefined) return hit;
    if (seen.has(id)) return 0;
    seen.add(id);
    const parent = byId.get(id)?.parent;
    const d = parent && byId.has(parent) ? depthOf(parent, seen) + 1 : 0;
    depth.set(id, d);
    return d;
  };
  for (const id of [...byParent.keys()].sort((a, b) => depthOf(a) - depthOf(b))) {
    const t = byId.get(id);
    const kids = byParent.get(id);
    if (!t || !kids?.length || t.spentH <= 0) continue;
    const extra = t.spentH;
    const weights = kids.map((k) => Math.max(k.spentH, k.estimateH, 0));
    const w = weights.reduce((s, n) => s + n, 0);
    kids.forEach((k, i) => {
      k.spentH += w > 0 ? (extra * weights[i]) / w : extra / kids.length;
    });
    t.spentH = 0;
  }
}
