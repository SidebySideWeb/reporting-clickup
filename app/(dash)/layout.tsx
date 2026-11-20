import NavLinks from "@/components/NavLinks";
import { getRaw } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const raw = await getRaw().catch(() => null);
  return (
    <div className="shell">
      <aside className="side">
        <div className="brand">
          <span className="brand-mark">A</span>
          <span>ANDKO PM</span>
        </div>
        <NavLinks />
        <form className="side-foot" method="POST" action="/api/logout">
          <button type="submit">Sign out</button>
        </form>
      </aside>
      <main className="main">
        {raw?.demo ? (
          <div className="banner" role="status">
            <strong>Demo data.</strong> No <code>CLICKUP_API_TOKEN</code> is set, so every number here is fictional. Add the token in Vercel to read live ClickUp data.
          </div>
        ) : null}
        {raw?.stale ? (
          <div className="banner" role="status">
            <strong>Stale data.</strong> ClickUp could not be refreshed{raw.warning ? ` (${raw.warning})` : ""}. Showing the last successful fetch.
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}
