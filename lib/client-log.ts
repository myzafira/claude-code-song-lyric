import type { LogEvent } from "./types.ts";

function sessionId(): string {
  try {
    let id = sessionStorage.getItem("esl.session");
    if (!id) {
      id = Math.random().toString(36).slice(2, 10);
      sessionStorage.setItem("esl.session", id);
    }
    return id;
  } catch {
    return "nosession";
  }
}

export function sendLog(ev: Omit<LogEvent, "session" | "device">) {
  const body = JSON.stringify({ ...ev, session: sessionId() });
  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/log", new Blob([body], { type: "application/json" }));
      return;
    }
  } catch {}
  fetch("/api/log", { method: "POST", body, headers: { "Content-Type": "application/json" }, keepalive: true }).catch(() => {});
}

