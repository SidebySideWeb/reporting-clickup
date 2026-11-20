import NavLinks from "@/components/NavLinks";
import { CONFIG } from "@/lib/config";

export const dynamic = "force-dynamic";

export default function DashLayout({ children }: { children: React.ReactNode }) {
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
        {CONFIG.demo ? (
          <div className="banner" role="status">
            <strong>Demo data.</strong> No <code>CLICKUP_API_TOKEN</code> is set, so every number here is fictional. Add the token in Vercel to read live ClickUp data.
          </div>
        ) : null}
        {children}
      </main>
    </div>
  );
}
