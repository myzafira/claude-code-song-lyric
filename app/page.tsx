"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { LINK_TYPE_LABEL, singable, type LinkType, type Song } from "@/lib/types.ts";
import SingView from "./SingView";
import Banners from "./Banners";
import { sendLog } from "@/lib/client-log.ts";

const QUEUE_KEY = "esl.queue.v1";
const MAX_QUEUE = 50;

const meta = (s: Song) =>
  [s.artist, s.album ? `อัลบั้ม ${s.album}` : "", s.yearBE ? `พ.ศ. ${s.yearBE}` : ""].filter(Boolean).join(" · ");

type By = "all" | "title" | "artist" | "album";
const BY_OPTIONS: [By, string][] = [
  ["all", "ทั้งหมด"],
  ["title", "ชื่อเพลง"],
  ["artist", "นักร้อง"],
  ["album", "อัลบั้ม"],
];
const TYPE_OPTIONS: [LinkType | "all", string][] = [
  ["all", "ทุกแบบ"],
  ["karaoke", "🎼 คาราโอเกะ"],
  ["vocal", "🎙️ มีเสียงร้อง"],
];
const PLACEHOLDER: Record<By, string> = {
  all: "พิมพ์ชื่อเพลง นักร้อง หรืออัลบั้ม",
  title: "พิมพ์ชื่อเพลง",
  artist: "พิมพ์ชื่อนักร้อง หรือชื่อวง",
  album: "พิมพ์ชื่ออัลบั้ม",
};

function TypeBadge({ s }: { s: Song }) {
  if (!s.linkType) return null;
  return (
    <span className={`badge ${s.linkType}`} title={LINK_TYPE_LABEL[s.linkType]}>
      {s.linkType === "karaoke" ? "🎼 คาราโอเกะ" : "🎙️ มีเสียงร้อง"}
    </span>
  );
}

export default function Home() {
  const [query, setQuery] = useState("");
  const [by, setBy] = useState<By>("all");
  const [type, setType] = useState<LinkType | "all">("all");
  const [results, setResults] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [queue, setQueue] = useState<Song[]>([]);
  const [singing, setSinging] = useState(false);
  const [mini, setMini] = useState(false);
  const [toast, setToast] = useState("");
  const [requested, setRequested] = useState("");
  const loaded = useRef(false);
  const lastLogged = useRef("");

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(QUEUE_KEY) ?? "[]");
      if (Array.isArray(saved)) setQueue(saved);
    } catch {}
    loaded.current = true;
  }, []);

  useEffect(() => {
    if (!loaded.current) return;
    try {
      localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
    } catch {}
  }, [queue]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1800);
    return () => clearTimeout(t);
  }, [toast]);

  // search as the person types, with a short pause
  useEffect(() => {
    const q = query.trim();
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({ q, by, type });
        const res = await fetch(`/api/songs?${params}`, { signal: ctrl.signal });
        const data = await res.json();
        setResults(data.songs ?? []);
        setFailed(!res.ok);
        if (q.length >= 2 && q !== lastLogged.current) {
          lastLogged.current = q;
          sendLog({ type: data.songs?.length ? "search" : "search_miss", query: q, results: data.songs?.length ?? 0 });
        }
      } catch (e) {
        if ((e as Error).name !== "AbortError") setFailed(true);
      } finally {
        setLoading(false);
      }
    }, q ? 450 : 0);
    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, by, type]);

  const inQueue = useCallback((id: string) => queue.some((s) => s.id === id), [queue]);

  const add = (s: Song) => {
    if (inQueue(s.id) || queue.length >= MAX_QUEUE) return;
    setQueue((q) => [...q, s]);
    setToast(`เพิ่ม "${s.title}" เข้าคิวแล้ว`);
    sendLog({ type: "queue_add", songId: s.id, songTitle: s.title, query: query.trim() || undefined });
  };
  const remove = (i: number) => setQueue((q) => q.filter((_, j) => j !== i));
  const move = (i: number, d: number) =>
    setQueue((q) => {
      const j = i + d;
      if (j < 0 || j >= q.length) return q;
      const n = [...q];
      [n[i], n[j]] = [n[j], n[i]];
      return n;
    });

  const requestSong = () => {
    const q = query.trim();
    if (!q) return;
    sendLog({ type: "request", query: q });
    setRequested(q);
    setToast("รับคำขอแล้ว จะหาเพลงนี้มาเพิ่มให้");
  };

  const q = query.trim();
  const showSing = singing && queue.length > 0;

  // The sing view stays mounted while minimised so the song keeps playing in a small window.
  return (
    <>
      {showSing && (
        <SingView
          queue={queue}
          onMinimize={setMini}
          onDone={(remaining) => {
            setQueue(remaining);
            setSinging(false);
            setMini(false);
          }}
        />
      )}
      {(!showSing || mini) && (
    <main className={`wrap${showSing ? " under-mini" : ""}`}>
      <h1 className="brand">
        🎤 ร้องเพลง<span>กัน</span>
      </h1>
      <Banners />

      <form className="search" onSubmit={(e) => { e.preventDefault(); (document.activeElement as HTMLElement)?.blur(); }} role="search">
        <input
          type="search"
          inputMode="search"
          placeholder={PLACEHOLDER[by]}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="ค้นหาเพลง"
          autoComplete="off"
        />
        {query && (
          <button type="button" className="btn ghost" onClick={() => setQuery("")} aria-label="ล้างคำค้น">
            ✕
          </button>
        )}
      </form>

      <div className="filters">
        <div className="chips" role="group" aria-label="ค้นหาจาก">
          <span className="chips-label">ค้นจาก</span>
          {BY_OPTIONS.map(([v, label]) => (
            <button key={v} type="button" className={`chip${by === v ? " on" : ""}`} aria-pressed={by === v} onClick={() => setBy(v)}>
              {label}
            </button>
          ))}
        </div>
        <div className="chips" role="group" aria-label="แบบคลิป">
          <span className="chips-label">แบบคลิป</span>
          {TYPE_OPTIONS.map(([v, label]) => (
            <button key={v} type="button" className={`chip${type === v ? " on" : ""}`} aria-pressed={type === v} onClick={() => setType(v)}>
              {label}
            </button>
          ))}
        </div>
      </div>

      <h2 className="section-title">{q ? (loading ? "กำลังค้นหา…" : `ผลการค้นหา "${q}"${results.length ? ` (${results.length} เพลง)` : ""}`) : "เพลงยอดนิยม"}</h2>
      {failed && <div className="empty">โหลดรายการเพลงไม่ได้ ลองใหม่อีกครั้ง</div>}
      {!failed && !loading && results.length === 0 && q && (
        <div className="empty">
          <p>ยังไม่มีเพลงนี้ในระบบ</p>
          {requested === q ? (
            <p>✓ ส่งคำขอแล้ว</p>
          ) : (
            <button className="btn accent" onClick={requestSong}>
              🙋 ขอเพลงนี้
            </button>
          )}
        </div>
      )}
      <ul className="list">
        {results.map((s) => (
          <li key={s.id} className="card">
            <div className="info">
              <div className="title">{s.title}</div>
              <div className="meta">{meta(s)}</div>
              <TypeBadge s={s} />
            </div>
            {inQueue(s.id) ? (
              <button className="btn" disabled>
                ✓ ในคิว
              </button>
            ) : (
              <button className="btn accent" onClick={() => add(s)} disabled={!singable(s)}>
                ➕ คิว
              </button>
            )}
          </li>
        ))}
      </ul>

      <h2 className="section-title">คิวเพลง ({queue.length})</h2>
      {queue.length === 0 ? (
        <div className="empty">ค้นหาเพลง แล้วกด ➕ คิว เพื่อต่อคิวร้อง</div>
      ) : (
        <ol className="list">
          {queue.map((s, i) => (
            <li key={s.id} className="card queue-card">
              <div className="num">{i + 1}</div>
              <div className="info">
                <div className="title">{s.title}</div>
                <div className="meta">{meta(s)}</div>
              </div>
              <div className="controls">
              <button className="small-btn" onClick={() => move(i, -1)} disabled={i === 0} aria-label="เลื่อนขึ้น">▲</button>
              <button className="small-btn" onClick={() => move(i, 1)} disabled={i === queue.length - 1} aria-label="เลื่อนลง">▼</button>
              <button className="small-btn" onClick={() => remove(i)} aria-label="เอาออกจากคิว">✕</button>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="bottom">
        <div className="inner">
          <button className="btn go" onClick={() => setSinging(true)} disabled={queue.length === 0 || showSing}>
            ▶ เริ่มร้อง{queue.length ? `: ${queue[0].title}` : ""}
          </button>
        </div>
      </div>

      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
      )}
    </>
  );
}
