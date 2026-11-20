import { safeNext } from "@/lib/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const { error, next } = await searchParams;
  return (
    <main className="login">
      <form method="POST" action="/api/login" className="login-card">
        <div className="brand-mark">A</div>
        <h1>ANDKO PM Dashboard</h1>
        <p className="muted">Planning and reporting from ClickUp. Enter the password to continue.</p>
        <input type="hidden" name="next" value={safeNext(next)} />
        <label htmlFor="password">Password</label>
        <input id="password" name="password" type="password" autoComplete="current-password" autoFocus required />
        {error ? <p className="login-error" role="alert">Wrong password. Try again.</p> : null}
        <button type="submit">Sign in</button>
      </form>
    </main>
  );
}
