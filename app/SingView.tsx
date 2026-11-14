"use client";

import { useEffect, useRef, useState } from "react";
import type { Song } from "@/lib/types.ts";
import { sendLog } from "@/lib/client-log.ts";

const PREF_KEY = "esl.view.v1";

type Prefs = { zoom: number; invert: boolean };

function loadPrefs(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(PREF_KEY) ?? "{}");
    return { zoom: typeof p.zoom === "number" ? p.zoom : 100, invert: Boolean(p.invert) };
  } catch {
    return { zoom: 100, invert: false };
  }
}

export default function SingView({ queue, onDone }: { queue: Song[]; onDone: (remaining: Song[]) => void }) {
  const [index, setIndex] = useState(0);
  const [page, setPage] = useState(0);
  const [prefs, setPrefs] = useState<Prefs>({ zoom: 100, invert: false });
  const [voted, setVoted] = useState<Record<string, "like" | "dislike">>({});
  const [broken, setBroken] = useState(false);
  const [hideUi, setHideUi] = useState(false);
  const [toast, setToast] = useState("");
  const scroller = useRef<HTMLDivElement>(null);

  const song = queue[index];
  const total = song?.images.length ?? 0;

  useEffect(() => setPrefs(loadPrefs()), []);
  useEffect(() => {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
    } catch {}
  }, [prefs]);

  // keep the screen on while singing, and go full screen when possible
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<typeof lock> } };
    const acquire = () => nav.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    acquire();
    const onVis = () => document.visibilityState === "visible" && acquire();
    document.addEventListener("visibilitychange", onVis);
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      lock?.release().catch(() => {});
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (song) sendLog({ type: "play", songId: song.id, songTitle: song.title });
  }, [song]);

  useEffect(() => {
    setBroken(false);
    scroller.current?.scrollTo({ top: 0 });
  }, [index, page]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  const finish = () => onDone(queue.slice(index + 1));
  const nextSong = () => {
    if (index + 1 >= queue.length) return finish();
    setIndex(index + 1);
    setPage(0);
  };
  const nextPage = () => (page + 1 < total ? setPage(page + 1) : nextSong());
  const prevPage = () => page > 0 && setPage(page - 1);

  const vote = (type: "like" | "dislike") => {
    if (!song || voted[song.id]) return;
    setVoted({ ...voted, [song.id]: type });
    sendLog({ type, songId: song.id, songTitle: song.title });
    setToast(type === "like" ? "ขอบคุณ! 👍" : "ขอบคุณ จะหาภาพที่อ่านง่ายกว่านี้");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") nextPage();
      else if (e.key === "ArrowLeft" || e.key === "PageUp") prevPage();
      else if (e.key === "Escape") finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!song) return null;
  const upNext = queue[index + 1];

  return (
    <div className={`stage${hideUi ? " hide-ui" : ""}`}>
      <div className="stage-top">
        <button className="btn ghost" onClick={finish} aria-label="กลับไปหน้าคิว" style={{ minHeight: 48, padding: "6px 14px" }}>
          ✕
        </button>
        <div className="now">
          <b>{song.title}</b> {song.artist && `· ${song.artist}`}
          {total > 1 && ` · หน้า ${page + 1}/${total}`}
          {upNext ? ` · ต่อไป: ${upNext.title}` : " · เพลงสุดท้าย"}
        </div>
      </div>

      <div
        ref={scroller}
        className={`stage-img${prefs.invert ? " invert" : ""}`}
        onDoubleClick={() => setHideUi(!hideUi)}
      >
        {broken ? (
          <div className="stage-msg">
            <p>ภาพนี้โหลดไม่ได้</p>
            <button className="btn accent" onClick={nextPage}>ข้ามไป ▶</button>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${song.id}-${page}`}
            src={song.images[page]}
            alt={`เนื้อเพลง ${song.title} หน้า ${page + 1}`}
            referrerPolicy="no-referrer"
            style={{ width: `${prefs.zoom}%` }}
            onError={() => {
              setBroken(true);
              sendLog({ type: "dislike", songId: song.id, songTitle: song.title, query: "image_error" });
            }}
          />
        )}
      </div>

      <div className="stage-bar">
        <button className="btn" onClick={prevPage} disabled={page === 0}>
          <span className="ico">◀</span>หน้าก่อน
        </button>
        <button className="btn accent" onClick={nextPage}>
          <span className="ico">▶</span>
          {page + 1 < total ? "หน้าถัดไป" : upNext ? "เพลงต่อไป" : "จบ"}
        </button>
        <button className="btn" onClick={() => setPrefs({ ...prefs, zoom: Math.max(60, prefs.zoom - 20) })}>
          <span className="ico">A−</span>เล็กลง
        </button>
        <button className="btn" onClick={() => setPrefs({ ...prefs, zoom: Math.min(300, prefs.zoom + 20) })}>
          <span className="ico">A+</span>ใหญ่ขึ้น
        </button>
        <button className="btn" onClick={() => setPrefs({ ...prefs, invert: !prefs.invert })}>
          <span className="ico">🌙</span>{prefs.invert ? "สีปกติ" : "พื้นดำ"}
        </button>
        <button className="btn" onClick={nextSong} disabled={!upNext}>
          <span className="ico">⏭</span>ข้ามเพลง
        </button>
        <button className="btn" onClick={() => vote("like")} disabled={Boolean(voted[song.id])}>
          <span className="ico">👍</span>อ่านง่าย
        </button>
        <button className="btn" onClick={() => vote("dislike")} disabled={Boolean(voted[song.id])}>
          <span className="ico">👎</span>อ่านยาก
        </button>
      </div>

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
