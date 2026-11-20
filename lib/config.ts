export const CONFIG = {
  workspaceId: process.env.CLICKUP_WORKSPACE_ID || "2428169",
  spaceIds: (process.env.CLICKUP_SPACE_IDS || "1200600000005059,1200600000005062,90159809242")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  clientsSpaceId: "1200600000005059",
  internalSpaceId: "1200600000005062",
  executionSpaceId: "90159809242",
  rate: Number(process.env.HOURLY_RATE || 40),
  planningFactor: 0.8, // SOP v4: plan at 80% of capacity
  revalidate: 300, // seconds ClickUp responses are cached (API rate limit: 100 req/min)
  demo: !process.env.CLICKUP_API_TOKEN || process.env.DEMO_MODE === "1",
  teams: ["Design", "Development", "QA", "PM"] as const,
  // SOP v4 thresholds. One place so the pages and the checks cannot drift.
  slipRedDays: 5,
  blockedRedDays: 3,
  budgetAlert: 0.8,
  supportEstimateMaxH: 8,
  unqualifiedDays: 1,
  coverageMin: 0.9,
  idleDays: 3,
  meeting: { weekday: "Monday", time: "09:30", minutes: 45 },
  // Custom field names (case-insensitive, first match wins). Assumptions until the live workspace is read.
  fields: {
    team: ["TEAM", "Team"],
    client: ["Client"],
    projectType: ["Project Type"],
    qaRequired: ["QA Required"],
    health: ["Health"],
    offerHours: ["Offer Hours", "Offer Estimate"],
    realEstimate: ["Real Estimate Hours", "Real Estimate"],
    budgetHours: ["Budget Hours", "Budget"],
    baselineEnd: ["Baseline Delivery", "Baseline End", "Baseline Delivery Date"],
  },
  // Overview / Milestone / Risk: custom task type name, or a task name that starts with the prefix.
  taskTypes: {
    overview: { type: "Overview", prefix: "[Overview]" },
    milestone: { type: "Milestone", prefix: "[Milestone]" },
    risk: { type: "Risk", prefix: "[Risk]" },
  },
};

const ROLE_TEAM: Record<string, string> = {
  design: "Design",
  dev: "Development",
  development: "Development",
  qa: "QA",
  pm: "PM",
};

export function teamFromCapacity(c: { team?: string; role?: string } | undefined) {
  if (!c) return undefined;
  if (c.team) return c.team;
  if (!c.role) return undefined;
  return ROLE_TEAM[c.role.toLowerCase()] ?? c.role;
}

export function taskKind(t: { typeName: string; name: string }): string {
  const type = t.typeName.trim().toLowerCase();
  const name = t.name.trim().toLowerCase();
  for (const [kind, spec] of Object.entries(CONFIG.taskTypes)) {
    if (type === spec.type.toLowerCase()) return kind;
    if (name.startsWith(spec.prefix.toLowerCase())) return kind;
  }
  return type === "task" || type === "" ? "task" : type;
}
