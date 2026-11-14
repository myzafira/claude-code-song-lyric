"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { singable, type Song } from "@/lib/types.ts";
import SingView from "./SingView";
import { sendLog } from "@/lib/client-log.ts";

const QUEUE_KEY = "esl.queue.v1";
const MAX_QUEUE = 50;

const meta = (s: Song) => [s.artist, s.yearBE ? `พ.ศ. ${s.yearBE}` : ""].filter(Boolean).join(" · ");

export default function Home() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [queue, setQueue] = useState<Song[]>([]);
  const [singing, setSinging] = useState(false);
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
        const res = await fetch(`/api/songs?q=${encodeURIComponent(q)}`, { signal: ctrl.signal });
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
  }, [query]);

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

  if (singing && queue.length > 0) {
    return (
      <SingView
        queue={queue}
        onDone={(remaining) => {
          setQueue(remaining);
          setSinging(false);
        }}
      />
    );
  }

  const q = query.trim();

  return (
    <main className="wrap">
      <h1 className="brand">
        🎤 ร้องเพลง<span>กัน</span>
      </h1>

      <form className="search" onSubmit={(e) => { e.preventDefault(); (document.activeElement as HTMLElement)?.blur(); }} role="search">
        <input
          type="search"
          inputMode="search"
          placeholder="พิมพ์ชื่อเพลง หรือชื่อนักร้อง"
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

      <h2 className="section-title">{q ? (loading ? "กำลังค้นหา…" : `ผลการค้นหา "${q}"`) : "เพลงยอดนิยม"}</h2>
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
          <button className="btn go" onClick={() => setSinging(true)} disabled={queue.length === 0}>
            ▶ เริ่มร้อง{queue.length ? `: ${queue[0].title}` : ""}
          </button>
        </div>
      </div>

      {toast && <div className="toast" role="status">{toast}</div>}
    </main>
  );
}
