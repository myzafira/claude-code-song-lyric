import { test } from "node:test";
import assert from "node:assert/strict";

process.env.ADMIN_USER = "admin-test";
process.env.ADMIN_PASSWORD = "a-long-test-password";
process.env.ADMIN_SECRET = "s";

const auth = await import("./admin-auth.ts");
const { songProperties } = await import("./notion.ts");

test("admin credentials must match exactly", () => {
  assert.equal(auth.checkCredentials("admin-test", "a-long-test-password"), true);
  assert.equal(auth.checkCredentials("admin-test", "wrong"), false);
  assert.equal(auth.checkCredentials("other", "a-long-test-password"), false);
});

test("sessions are signed and expire", () => {
  const now = Date.now();
  const token = auth.createSession(now);
  assert.equal(auth.verifySession(token, now + 1000), true);
  assert.equal(auth.verifySession(token, now + 13 * 3600 * 1000), false);
  assert.equal(auth.verifySession(token.slice(0, -2) + "xx", now), false);
  const req = new Request("http://x/", { headers: { cookie: `a=1; esl_admin=${encodeURIComponent(token)}` } });
  assert.equal(auth.isAdminRequest(req), true);
});

test("ticking Licensed needs a license note", () => {
  assert.throws(() => songProperties({ title: "x", licensed: true }, true), /รายละเอียดการอนุญาต/);
  assert.doesNotThrow(() => songProperties({ title: "x", licensed: true, licenseNote: "ค่าย X อนุญาต 1/1/2569" }, true));
});

test("song links must be https and new songs start as รอตรวจ", () => {
  assert.throws(() => songProperties({ title: "x", youtube: "http://youtube.com/x" }, true), /https/);
  const p = songProperties({ title: "x" }, true) as Record<string, { select?: { name: string } }>;
  assert.equal(p["Status"].select?.name, "รอตรวจ");
  assert.throws(() => songProperties({ artist: "y" }, true), /ชื่อเพลง/);
});
