"use client";

export default function DashError({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div className="banner banner-err" role="alert">
      <strong>Could not load ClickUp data.</strong>
      <p style={{ margin: "6px 0" }}>{error.message}</p>
      <p className="small">Check CLICKUP_API_TOKEN, CLICKUP_WORKSPACE_ID and CLICKUP_SPACE_IDS in the Vercel environment variables.</p>
      <button className="primary" onClick={reset}>Try again</button>
    </div>
  );
}
