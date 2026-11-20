import assert from "node:assert/strict";
import { checkPassword, createSession, decide, safeNext, verifySession } from "./auth.ts";
import { dayKey, isWorkday, weekStart, workdaysBetween } from "./dates.ts";
import { allocateParentTime } from "./spent.ts";

process.env.DASHBOARD_PASSWORD = "s3cret";
process.env.AUTH_SECRET = "auth-secret";

const base = { passwordSet: true, production: false, sessionOk: false, search: "" };

assert.deepEqual(decide({ ...base, pathname: "/projects" }), { kind: "login", next: "/projects" });
assert.deepEqual(decide({ ...base, pathname: "/", search: "?tab=1" }), { kind: "login", next: "/?tab=1" });
assert.deepEqual(decide({ ...base, pathname: "/api/export/project/acme" }), { kind: "deny", status: 401 });
assert.deepEqual(decide({ ...base, pathname: "/login" }), { kind: "allow" });
assert.deepEqual(decide({ ...base, pathname: "/api/login" }), { kind: "allow" });
assert.deepEqual(decide({ ...base, pathname: "/projects", sessionOk: true }), { kind: "allow" });
assert.equal(decide({ pathname: "/", search: "", passwordSet: false, production: true, sessionOk: false }).kind, "closed");
assert.equal(decide({ pathname: "/projects", search: "", passwordSet: false, production: false, sessionOk: false }).kind, "allow");

assert.equal(safeNext("/projects?x=1"), "/projects?x=1");
assert.equal(safeNext("//evil.com"), "/");
assert.equal(safeNext("https://evil.com"), "/");
assert.equal(safeNext("/\\evil.com"), "/");
assert.equal(safeNext("/%2f%2fevil.com"), "/");

assert.equal(await checkPassword("s3cret"), true);
assert.equal(await checkPassword("nope"), false);
const token = await createSession();
const flipped = token.slice(0, -1) + (token.endsWith("0") ? "1" : "0");
assert.equal(await verifySession(token), true);
assert.equal(await verifySession(flipped), false);
assert.equal(await verifySession("1.dead"), false);

assert.equal(dayKey(Date.parse("2026-01-15T22:30:00.000Z")), "2026-01-16");
assert.equal(weekStart("2026-01-16"), "2026-01-12");
assert.equal(isWorkday("2026-01-17", new Set()), false);
assert.equal(isWorkday("2026-01-16", new Set(["2026-01-16"])), false);
assert.deepEqual(workdaysBetween("2026-01-16", "2026-01-19", new Set()), ["2026-01-16", "2026-01-19"]);

const rolled = [
  { id: "p", parent: null, spentH: 10, estimateH: 0 },
  { id: "a", parent: "p", spentH: 4, estimateH: 4 },
  { id: "b", parent: "p", spentH: 0, estimateH: 6 },
];
allocateParentTime(rolled);
assert.equal(rolled[0].spentH, 0);
assert.ok(Math.abs(rolled[1].spentH + rolled[2].spentH - 10) < 1e-6);

const direct = [
  { id: "p", parent: null, spentH: 5, estimateH: 0 },
  { id: "a", parent: "p", spentH: 4, estimateH: 4 },
  { id: "b", parent: "p", spentH: 3, estimateH: 3 },
];
allocateParentTime(direct);
assert.equal(direct[0].spentH, 0);
assert.ok(Math.abs(direct[1].spentH + direct[2].spentH - 12) < 1e-6);

console.log("ok");
