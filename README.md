# ANDKO PM Dashboard

One place for planning and reporting from ClickUp. Built from the ANDKO Reports Specification and SOP v4.
Next.js 15 (App Router) · no database · password gate in `middleware.ts` · ready for Vercel.

## Deploy to Vercel

1. Push this folder to a Git repository (GitHub, GitLab or Bitbucket) and import it in Vercel. Framework is detected as Next.js.
2. In **Project → Settings → Environment Variables** add:

| Variable | Value |
|---|---|
| `DASHBOARD_PASSWORD` | The password people type to get in. **Required.** Without it the site answers 503, it never opens publicly. |
| `AUTH_SECRET` | Long random string that signs the session cookie (`openssl rand -hex 32`). Recommended. |
| `CLICKUP_API_TOKEN` | ClickUp → avatar → Settings → Apps → API Token (`pk_...`). Use a token of a user who can see every space. Read-only use. |
| `CLICKUP_WORKSPACE_ID` | `2428169` (default) |
| `CLICKUP_SPACE_IDS` | Comma-separated space IDs to read. Default: CLIENTS, ANDKO INTERNAL and the legacy EXECUTION space. |
| `HOURLY_RATE` | `40` (default) |

3. Deploy. Without `CLICKUP_API_TOKEN` the app runs on fictional demo data and says so in a banner.

## Run locally

```bash
npm install
cp .env.example .env.local   # fill in DASHBOARD_PASSWORD at least
npm run dev
```

## How access works

`middleware.ts` runs before every page and API route. Without a valid session cookie it redirects to `/login` (pages) or returns 401 (API). Only `/login` and `/api/login` are open. The cookie is HTTP-only, signed (HMAC-SHA256), expires after 7 days and never contains the password. The ClickUp token stays on the server.

## What is in it

| Page | Reports from the specification |
|---|---|
| Overview | O3 (partly), headline numbers for every audience |
| Projects | PM1, PM3: health, progress, hours against budget and offer, baseline vs forecast, next milestone |
| Capacity & workload | PM6, PM7, L1: planned load vs 80% of capacity per person and week, 8 weeks ahead |
| New project planner | O2: earliest start and delivery for a candidate project |
| Time tracking | O1, PM2, L2: hours by client, project, person; coverage, utilisation, consistency flags |
| Risks & milestones | L3, L4: milestones next 30 days, blocked, overdue, stale, waiting for QA, risks |
| Data quality | X12: what is missing in ClickUp that makes the other reports wrong |
| Report catalogue | All 26 reports and which are live |

Not built yet: PM4/PM5 client PDFs, X1–X11 except X12 (they need the commercial fields, invoice dates and cost per hour, see the catalogue).

## Configure it for your ClickUp

- **Custom field names**: `lib/config.ts` → `fields`. Defaults match SOP v4: TEAM, Client, Project Type, QA Required on tasks; Health, Offer Hours, Real Estimate Hours, Budget Hours, Baseline Delivery on the project's **Overview** task. Rename them there if yours differ.
- **Task types**: Overview, Milestone and Risk are recognised by ClickUp custom task type, or by a task name starting with those words.
- **Statuses** are matched by text: `blocked`, `ready for qa`, `in progress`, `unqualified`. Done = any status of type Done or Closed.
- **Capacity**: `config/capacity.json`. Default 40 h/week per person, minus holidays and leave. Add people by e-mail to set weekly hours, team and leave. `excluded` hides people (owner, guests). Edit the file and redeploy; ClickUp does not hold this data.
- **Projects**: in CLIENTS one list = one project (support lists are detected by name). In legacy spaces one folder = one project.

## Good to know

- ClickUp data is cached in memory for 5 minutes per server instance (`CONFIG.revalidate`) to stay under the API limit of 100 requests per minute. Time entries cover the last 70 days. Hours used per project are all-time task time.
- Health uses the value the PM sets in ClickUp when it exists; the badge also shows the calculated value when they differ.
- Load assumes the Time Estimate sits on leaf tasks and spreads remaining hours evenly between start (or today) and due date.
- This app only reads from ClickUp. It never writes.
