export const CONFIG = {
  workspaceId: process.env.CLICKUP_WORKSPACE_ID || "2428169",
  spaceIds: (process.env.CLICKUP_SPACE_IDS || "1200600000005059,1200600000005062,90159809242")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  clientsSpaceId: "1200600000005059",
  internalSpaceId: "1200600000005062",
  rate: Number(process.env.HOURLY_RATE || 40),
  planningFactor: 0.8, // SOP v4: plan at 80% of capacity
  revalidate: 300, // seconds ClickUp responses are cached (API rate limit: 100 req/min)
  demo: !process.env.CLICKUP_API_TOKEN || process.env.DEMO_MODE === "1",
  teams: ["Design", "Development", "QA", "PM"],
  // Custom field names (case-insensitive, first match wins). Edit to match your ClickUp.
  fields: {
    team: ["TEAM"],
    client: ["Client"],
    projectType: ["Project Type"],
    qaRequired: ["QA Required"],
    health: ["Health"],
    offerHours: ["Offer Hours", "Offer Estimate"],
    realEstimate: ["Real Estimate Hours", "Real Estimate"],
    budgetHours: ["Budget Hours", "Budget"],
    baselineEnd: ["Baseline Delivery", "Baseline End", "Baseline Delivery Date"],
  },
};
