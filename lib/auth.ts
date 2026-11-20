// Edge + Node compatible (Web Crypto only). Session = "<expiryMs>.<hmac>" signed with AUTH_SECRET (or the password).
export const COOKIE = "andko_session";
export const SESSION_SECONDS = 60 * 60 * 24 * 7;

const enc = new TextEncoder();

function secret() {
  return process.env.AUTH_SECRET || process.env.DASHBOARD_PASSWORD || "";
}

async function hmac(message: string, key: string) {
  const k = await crypto.subtle.importKey("raw", enc.encode(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", k, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function safeEqual(a: string, b: string) {
  let diff = a.length ^ b.length;
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return diff === 0;
}

export async function checkPassword(input: string) {
  const pw = process.env.DASHBOARD_PASSWORD;
  if (!pw) return false;
  // Compare HMACs so length and content never leak through timing.
  const [a, b] = await Promise.all([hmac(input, "pw-check"), hmac(pw, "pw-check")]);
  return safeEqual(a, b);
}

export async function createSession() {
  const expiry = String(Date.now() + SESSION_SECONDS * 1000);
  return `${expiry}.${await hmac("v1." + expiry, secret())}`;
}

export async function verifySession(token: string | undefined) {
  if (!token || !secret()) return false;
  const [expiry, sig] = token.split(".");
  if (!expiry || !sig || Number(expiry) < Date.now()) return false;
  return safeEqual(sig, await hmac("v1." + expiry, secret()));
}

// A post-login path must be a single-slash relative URL. Rejects protocol-relative and backslash tricks.
export function safeNext(v: unknown) {
  const s = typeof v === "string" ? v : "";
  if (s.length > 2000 || !s.startsWith("/") || s.startsWith("//") || s.includes("\\") || s.includes("://")) return "/";
  try {
    const d = decodeURIComponent(s);
    if (!d.startsWith("/") || d.startsWith("//") || d.includes("\\") || d.includes("://")) return "/";
  } catch {
    return "/";
  }
  return s;
}

export type Decision =
  | { kind: "allow" }
  | { kind: "closed"; status: 503; message: string }
  | { kind: "deny"; status: 401 }
  | { kind: "login"; next: string };

const OPEN = new Set(["/login", "/api/login"]);

export function decide(input: {
  pathname: string;
  search: string;
  passwordSet: boolean;
  production: boolean;
  sessionOk: boolean;
}): Decision {
  if (!input.passwordSet) {
    if (input.production) {
      return { kind: "closed", status: 503, message: "DASHBOARD_PASSWORD is not set on this deployment." };
    }
    return { kind: "allow" };
  }
  if (OPEN.has(input.pathname)) return { kind: "allow" };
  if (input.sessionOk) return { kind: "allow" };
  if (input.pathname.startsWith("/api/")) return { kind: "deny", status: 401 };
  return { kind: "login", next: input.pathname + input.search };
}
