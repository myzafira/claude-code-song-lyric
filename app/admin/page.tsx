"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { AdminSong, Banner, Stats } from "@/lib/notion.ts";

type Tab = "stats" | "songs" | "banners";
type Draft = Partial<AdminSong>;

const STATUSES = ["รอตรวจ", "ใช้ได้", "ต้องหาใหม่"];
const LANGUAGES = ["ไทย", "อังกฤษ"];
const TYPE_LABEL: Record<string, string> = {
  search: "ค้นหา",
  search_miss: "ค้นไม่เจอ",
  queue_add: "เพิ่มเข้าคิว",
  play: "เปิดร้อง",
  like: "ชอบ",
  dislike: "ไม่ชอบ",
  request: "ขอเพลง",
};
const EMPTY: Draft = {
  title: "", artist: "", album: "", linkType: "", aliases: "", yearBE: null, language: "ไทย", genre: "", status: "รอตรวจ",
  youtube: "", youtubeChannel: "", lyricsLink: "", licensed: false, licenseNote: "", lyrics: "", imageUrls: "",
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, { ...init, headers: { "content-type": "application/json" }, cache: "no-store" });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || `ผิดพลาด (${res.status})`), { status: res.status });
  return data as T;
}

export default function AdminPage() {
  const [state, setState] = useState<"checking" | "login" | "in" | "off">("checking");
  const [tab, setTab] = useState<Tab>("stats");

  const check = useCallback(async () => {
    try {
      await api("/api/admin/songs?probe=1");
      setState("in");
    } catch (e) {
      setState((e as { status?: number }).status === 503 ? "off" : "login");
    }
  }, []);
  useEffect(() => {
    check();
  }, [check]);

  const logout = async () => {
    await api("/api/admin/logout", { method: "POST" }).catch(() => {});
    setState("login");
  };

  return (
    <main className="wrap admin">
      <div className="admin-head">
        <h1 className="brand">ผู้ดูแล <span>Easy Song Lyric</span></h1>
        <a className="btn ghost" href="/">← หน้าร้องเพลง</a>
      </div>
      {state === "checking" && <p className="hint">กำลังตรวจสอบ…</p>}
      {state === "off" && (
        <div className="notice">
          ยังไม่ได้เปิดใช้หน้าผู้ดูแล ต้องตั้งค่า <b>ADMIN_USER</b> และ <b>ADMIN_PASSWORD</b> (อย่างน้อย 12 ตัวอักษร) ใน
          Vercel แล้ว redeploy ก่อน
        </div>
      )}
      {state === "login" && <Login onDone={() => setState("in")} />}
      {state === "in" && (
        <>
          <div className="tabs">
            <button className={`btn ${tab === "stats" ? "accent" : ""}`} onClick={() => setTab("stats")}>📊 สถิติ</button>
            <button className={`btn ${tab === "songs" ? "accent" : ""}`} onClick={() => setTab("songs")}>🎵 จัดการเพลง</button>
            <button className={`btn ${tab === "banners" ? "accent" : ""}`} onClick={() => setTab("banners")}>🔗 แบนเนอร์</button>
            <button className="btn ghost" onClick={logout}>ออกจากระบบ</button>
          </div>
          {tab === "stats" ? <StatsTab /> : tab === "songs" ? <SongsTab /> : <BannersTab />}
        </>
      )}
    </main>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const [user, setUser] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError("");
    try {
      await api("/api/admin/login", { method: "POST", body: JSON.stringify({ user, password }) });
      onDone();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="panel form" onSubmit={submit}>
      <label>ชื่อผู้ใช้<input value={user} onChange={(e) => setUser(e.target.value)} autoComplete="username" required /></label>
      <label>รหัสผ่าน<input type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required /></label>
      {error && <p className="err">{error}</p>}
      <button className="btn go" disabled={busy}>{busy ? "กำลังเข้า…" : "เข้าสู่ระบบ"}</button>
    </form>
  );
}

function StatsTab() {
  const [days, setDays] = useState(30);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    setStats(null);
    setError("");
    api<Stats>(`/api/admin/stats?days=${days}`).then(setStats, (e) => setError(e.message));
  }, [days]);
  return (
    <section>
      <div className="tabs">
        {[7, 30, 90].map((d) => (
          <button key={d} className={`btn ${days === d ? "accent" : "ghost"}`} onClick={() => setDays(d)}>{d} วัน</button>
        ))}
      </div>
      {error && <p className="err">{error}</p>}
      {!stats && !error && <p className="hint">กำลังโหลด…</p>}
      {stats && (
        <>
          <div className="tiles">
            <div className="tile"><b>{stats.sessions}</b><span>ผู้ใช้ (ครั้งที่เปิดแอป)</span></div>
            {Object.keys(TYPE_LABEL).map((t) => (
              <div className="tile" key={t}><b>{stats.totals[t] ?? 0}</b><span>{TYPE_LABEL[t]}</span></div>
            ))}
          </div>
          <h2>🙋 เพลงที่คนหาแต่ไม่เจอ / ขอให้เพิ่ม</h2>
          <p className="hint">เพิ่มเพลงเหล่านี้ได้ที่แท็บ “จัดการเพลง” (ใช้เฉพาะคลิปจากช่องทางการของค่ายเพลง)</p>
          <List rows={stats.missing.map((m) => [m.query, `ค้น ${m.count}${m.requested ? ` · ขอ ${m.requested}` : ""}`])} />
          <h2>🔥 เพลงที่เปิดร้องบ่อย</h2>
          <List rows={stats.topPlayed.map((m) => [m.title || m.songId, `${m.count} ครั้ง`])} />
          <h2>👎 เพลงที่ควรตรวจ (มีคนกดไม่ชอบ)</h2>
          <List rows={stats.problems.map((m) => [m.title || m.songId, `${m.count} ครั้ง`])} />
        </>
      )}
    </section>
  );
}

function List({ rows }: { rows: [string, string][] }) {
  if (!rows.length) return <p className="hint">ยังไม่มีข้อมูล</p>;
  return (
    <ol className="panel rows">
      {rows.map(([a, b], i) => (
        <li key={i}><span>{a}</span><b>{b}</b></li>
      ))}
    </ol>
  );
}

function SongsTab() {
  const [songs, setSongs] = useState<AdminSong[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [editing, setEditing] = useState<Draft | null>(null);

  const load = useCallback(() => {
    setError("");
    api<{ songs: AdminSong[] }>("/api/admin/songs").then((d) => setSongs(d.songs), (e) => setError(e.message));
  }, []);
  useEffect(load, [load]);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (songs ?? []).filter(
      (s) =>
        (!status || s.status === status) &&
        (!needle || `${s.title} ${s.artist} ${s.album} ${s.aliases}`.toLowerCase().includes(needle)),
    );
  }, [songs, q, status]);

  if (editing) {
    return (
      <SongForm
        initial={editing}
        onCancel={() => setEditing(null)}
        onSaved={() => {
          setEditing(null);
          load();
        }}
      />
    );
  }
  return (
    <section>
      <div className="search">
        <input placeholder="ค้นในรายการเพลง" value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn go" onClick={() => setEditing({ ...EMPTY })}>＋ เพิ่มเพลง</button>
      </div>
      <div className="tabs">
        {["", ...STATUSES].map((s) => (
          <button key={s || "all"} className={`btn small ${status === s ? "accent" : "ghost"}`} onClick={() => setStatus(s)}>
            {s || "ทั้งหมด"}
          </button>
        ))}
      </div>
      {error && <p className="err">{error}</p>}
      {!songs && !error && <p className="hint">กำลังโหลด…</p>}
      {songs && <p className="hint">{shown.length} จาก {songs.length} เพลง</p>}
      {shown.map((s) => (
        <div className="card" key={s.id}>
          <div className="info">
            <div className="title">{s.title}</div>
            <div className="meta">
              {s.artist || "ไม่ระบุศิลปิน"}{s.yearBE ? ` · ${s.yearBE}` : ""} · {s.status || "ไม่มีสถานะ"}
            </div>
            <div className="meta">
              {s.youtube ? "🎬 คลิป" : "— ไม่มีคลิป"} · {s.lyricsLink ? "📖 ลิงก์" : "— ไม่มีลิงก์"} ·{" "}
              {s.licensed ? "✅ ได้รับอนุญาต" : "ไม่มีสิทธิ์แสดงเนื้อเพลง"} · ▶ {s.plays} 👍 {s.likes} 👎 {s.dislikes}
            </div>
          </div>
          <button className="btn accent" onClick={() => setEditing(s)}>แก้ไข</button>
        </div>
      ))}
    </section>
  );
}

function SongForm({ initial, onCancel, onSaved }: { initial: Draft; onCancel: () => void; onSaved: () => void }) {
  const [d, setD] = useState<Draft>(initial);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const isNew = !initial.id;
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((p) => ({ ...p, [k]: v }));
  const field = (k: "title" | "artist" | "album" | "aliases" | "genre" | "youtube" | "youtubeChannel" | "lyricsLink" | "licenseNote", label: string, hint?: string) => (
    <label>
      {label}
      <input value={(d[k] as string) ?? ""} onChange={(e) => set(k, e.target.value)} />
      {hint && <small>{hint}</small>}
    </label>
  );

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (d.licensed && !d.licenseNote?.trim()) {
      setError("ติ๊กว่าได้รับอนุญาตแล้ว ต้องกรอกรายละเอียดการอนุญาต (ใคร เมื่อไร) ด้วย");
      return;
    }
    setBusy(true);
    setError("");
    const body = {
      title: d.title, artist: d.artist, album: d.album, linkType: d.linkType, aliases: d.aliases, yearBE: d.yearBE ?? null, language: d.language,
      genre: d.genre, status: d.status, youtube: d.youtube, youtubeChannel: d.youtubeChannel,
      lyricsLink: d.lyricsLink, licenseNote: d.licenseNote, licensed: d.licensed,
      ...(d.licensed ? { lyrics: d.lyrics, imageUrls: d.imageUrls } : {}),
    };
    try {
      await api(isNew ? "/api/admin/songs" : `/api/admin/songs/${d.id}`, {
        method: isNew ? "POST" : "PATCH",
        body: JSON.stringify(body),
      });
      onSaved();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="panel form" onSubmit={save}>
      <h2>{isNew ? "เพิ่มเพลงใหม่" : `แก้ไข: ${initial.title}`}</h2>
      {field("title", "ชื่อเพลง *")}
      {field("artist", "ศิลปิน")}
      {field("album", "อัลบั้ม", "ใส่เฉพาะเมื่อตรวจจากแหล่งทางการแล้ว (เช่น หน้าอัลบั้มบน Spotify/ค่ายเพลง)")}
      {field("aliases", "ชื่ออื่น / คำค้น", "คั่นด้วยจุลภาค เช่น ชื่อท่อนฮุก หรือชื่อภาษาอังกฤษ")}
      <div className="row">
        <label>
          ปี พ.ศ.
          <input inputMode="numeric" value={d.yearBE ?? ""} onChange={(e) => set("yearBE", e.target.value ? Number(e.target.value) : null)} />
        </label>
        <label>
          ภาษา
          <select value={d.language ?? ""} onChange={(e) => set("language", e.target.value)}>
            <option value="">-</option>
            {LANGUAGES.map((x) => <option key={x}>{x}</option>)}
          </select>
        </label>
        <label>
          สถานะ
          <select value={d.status ?? ""} onChange={(e) => set("status", e.target.value)}>
            {STATUSES.map((x) => <option key={x}>{x}</option>)}
          </select>
        </label>
      </div>
      {field("genre", "แนวเพลง")}
      <div className="notice">
        ⚖️ ใช้เฉพาะคลิปจาก<b>ช่องทางการของค่ายเพลงหรือศิลปิน</b> และลิงก์เนื้อเพลงไปยังเว็บที่ได้รับลิขสิทธิ์ (เช่น JOOX,
        Musixmatch, Spotify) เท่านั้น ห้ามคัดลอกเนื้อเพลงจากเว็บอื่น
      </div>
      {field("youtube", "ลิงก์คลิป YouTube (ช่องทางการ)", "เช่น https://www.youtube.com/watch?v=…")}
      {field("youtubeChannel", "ชื่อช่อง YouTube", "เช่น GMM Karaoke")}
      <label>
        แบบคลิป
        <select value={d.linkType ?? ""} onChange={(e) => set("linkType", e.target.value)}>
          <option value="">ให้ระบบเดาจากชื่อช่อง (ช่องคาราโอเกะ = คาราโอเกะ)</option>
          <option value="คาราโอเกะ">คาราโอเกะ (มีแต่ดนตรีกับเนื้อเพลง ไม่มีเสียงร้อง)</option>
          <option value="มีเสียงร้อง">มีเสียงร้อง (MV / Lyric video)</option>
        </select>
      </label>
      {field("lyricsLink", "ลิงก์หน้าเนื้อเพลง (เว็บที่ได้รับลิขสิทธิ์)")}
      <label className="check">
        <input type="checkbox" checked={!!d.licensed} onChange={(e) => set("licensed", e.target.checked)} />
        ได้รับอนุญาตจากเจ้าของลิขสิทธิ์ให้แสดงเนื้อเพลงในแอป
      </label>
      {field("licenseNote", "รายละเอียดการอนุญาต", "ใครอนุญาต เมื่อไร เอกสารอ้างอิง (จำเป็นเมื่อติ๊กด้านบน)")}
      {d.licensed && (
        <>
          <label>
            เนื้อเพลง (เฉพาะที่ได้รับอนุญาต)
            <textarea rows={10} value={d.lyrics ?? ""} onChange={(e) => set("lyrics", e.target.value)} />
          </label>
          <label>
            ลิงก์รูปเนื้อเพลง (บรรทัดละ 1 รูป, เฉพาะที่ได้รับอนุญาต)
            <textarea rows={3} value={d.imageUrls ?? ""} onChange={(e) => set("imageUrls", e.target.value)} />
          </label>
        </>
      )}
      {error && <p className="err">{error}</p>}
      <div className="row">
        <button className="btn go" disabled={busy}>{busy ? "กำลังบันทึก…" : "💾 บันทึก"}</button>
        <button type="button" className="btn ghost" onClick={onCancel}>ยกเลิก</button>
        {d.url && <a className="btn ghost" href={d.url} target="_blank" rel="noreferrer">เปิดใน Notion</a>}
      </div>
    </form>
  );
}

function BannersTab() {
  const [data, setData] = useState<{ enabled: boolean; banners: Banner[] } | null>(null);
  const [error, setError] = useState("");
  const load = useCallback(() => {
    setError("");
    api<{ enabled: boolean; banners: Banner[] }>("/api/admin/banners").then(setData, (e) => setError(e.message));
  }, []);
  useEffect(load, [load]);
  const blank: Banner = { id: "", title: "", subtitle: "", link: "https://", image: "", active: true, order: (data?.banners.length ?? 0) + 1 };
  return (
    <section>
      <p className="hint">แบนเนอร์แสดงใต้ชื่อแอปในหน้าหลัก กดแล้วเปิด web app อื่นในแท็บใหม่ (ไม่แสดงตอนกำลังร้องเพลง)</p>
      {error && <p className="err">{error}</p>}
      {data && !data.enabled && (
        <div className="notice">ยังไม่ได้เชื่อมฐานข้อมูลแบนเนอร์ ตอนนี้แอปแสดงแบนเนอร์ค่าเริ่มต้น (Palmiste) อยู่</div>
      )}
      {data?.enabled && (
        <>
          {data.banners.map((b) => <BannerForm key={b.id} initial={b} onSaved={load} />)}
          <h2>เพิ่มแบนเนอร์ใหม่</h2>
          <BannerForm key={`new-${data.banners.length}`} initial={blank} onSaved={load} />
        </>
      )}
    </section>
  );
}

function BannerForm({ initial, onSaved }: { initial: Banner; onSaved: () => void }) {
  const [b, setB] = useState(initial);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const isNew = !initial.id;
  const set = <K extends keyof Banner>(k: K, v: Banner[K]) => setB((p) => ({ ...p, [k]: v }));
  const run = async (method: "POST" | "PATCH" | "DELETE") => {
    setBusy(true);
    setMsg("");
    try {
      const { id, ...body } = b;
      await api(isNew ? "/api/admin/banners" : `/api/admin/banners/${id}`, {
        method,
        body: method === "DELETE" ? undefined : JSON.stringify(body),
      });
      setMsg("บันทึกแล้ว ✓ (หน้าหลักอัปเดตภายใน 5 นาที)");
      onSaved();
    } catch (err) {
      setMsg((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <form className="panel form banner-form" onSubmit={(e) => { e.preventDefault(); run(isNew ? "POST" : "PATCH"); }}>
      <div className="row">
        <label>ชื่อ<input value={b.title} onChange={(e) => set("title", e.target.value)} required /></label>
        <label>ข้อความรอง<input value={b.subtitle} onChange={(e) => set("subtitle", e.target.value)} /></label>
      </div>
      <label>ลิงก์ปลายทาง<input value={b.link} onChange={(e) => set("link", e.target.value)} required /></label>
      <div className="row">
        <label>ลิงก์รูป (ไม่บังคับ)<input value={b.image} onChange={(e) => set("image", e.target.value)} /></label>
        <label style={{ maxWidth: 120 }}>ลำดับ<input inputMode="numeric" value={b.order} onChange={(e) => set("order", Number(e.target.value) || 0)} /></label>
      </div>
      <label className="check"><input type="checkbox" checked={b.active} onChange={(e) => set("active", e.target.checked)} />แสดงในหน้าหลัก</label>
      {msg && <p className={msg.includes("✓") ? "hint" : "err"}>{msg}</p>}
      <div className="row">
        <button className="btn go" disabled={busy}>{isNew ? "＋ เพิ่ม" : "💾 บันทึก"}</button>
        {!isNew && <button type="button" className="btn ghost" disabled={busy} onClick={() => run("DELETE")}>ลบ</button>}
      </div>
    </form>
  );
}
