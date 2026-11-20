import { getRaw } from "./data";
import { buildModel, enrichEntries } from "./metrics";

// One call per page: raw ClickUp data (cached) -> model + enriched time entries.
export async function snapshot() {
  const raw = await getRaw();
  const m = buildModel(raw);
  const ex = enrichEntries(m);
  return { m, ex, raw };
}
