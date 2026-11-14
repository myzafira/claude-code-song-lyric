import type { LogEvent, Song } from "./types.ts";

const API = "https://api.notion.com/v1";
const VERSION = "2022-06-28";
const CACHE_MS = 5 * 60 * 1000;

const token = () => process.env.NOTION_TOKEN ?? "";
const songsDb = () => process.env.NOTION_SONGS_DB ?? "";
const logDb = () => process.env.NOTION_LOG_DB ?? "";

export const notionEnabled = () => Boolean(token() && songsDb());

async function notion(path: string, method: string, body?: unknown) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${token()}`,
      "Notion-Version": VERSION,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Notion ${method} ${path} failed: ${res.status} ${await res.text()}`);
  }
  return res.json();
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const text = (p: any): string =>
  (p?.rich_text ?? p?.title ?? []).map((t: any) => t.plain_text).join("");
const num = (p: any): number | null => (typeof p?.number === "number" ? p.number : null);
const sel = (p: any): string => p?.select?.name ?? "";
const url = (p: any): string => p?.url ?? "";
const check = (p: any): boolean => p?.checkbox === true;

export function parseImageUrls(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//i.test(s));
}

function toSong(page: any): Song {
  const p = page.properties ?? {};
  // Lyrics are only sent to the browser when the rights holder has allowed it.
  const licensed = check(p["Licensed"]);
  return {
    id: page.id,
    title: text(p["Song"]),
    artist: text(p["Artist"]),
    aliases: text(p["Aliases"]),
    yearBE: num(p["Year BE"]),
    language: sel(p["Language"]),
    genre: sel(p["Genre"]),
    images: licensed ? parseImageUrls(text(p["Image URLs"])) : [],
    source: url(p["Source"]),
    readability: num(p["Readability"]),
    status: sel(p["Status"]),
    plays: num(p["Plays"]) ?? 0,
    likes: num(p["Likes"]) ?? 0,
    dislikes: num(p["Dislikes"]) ?? 0,
    youtube: url(p["YouTube"]),
    youtubeChannel: text(p["YouTube Channel"]),
    lyricsLink: url(p["Lyrics Link"]),
    lyrics: licensed ? text(p["Lyrics"]) : "",
    licensed,
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

let cache: { at: number; songs: Song[] } | null = null;

export async function getAllSongs(): Promise<Song[]> {
  if (!notionEnabled()) return DEMO_SONGS;
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.songs;
  const songs: Song[] = [];
  let cursor: string | undefined;
  do {
    const data = await notion(`/databases/${songsDb()}/query`, "POST", {
      page_size: 100,
      start_cursor: cursor,
      filter: { property: "Status", select: { does_not_equal: "ต้องหาใหม่" } },
    });
    for (const page of data.results) songs.push(toSong(page));
    cursor = data.has_more ? data.next_cursor : undefined;
  } while (cursor);
  cache = { at: Date.now(), songs };
  return songs;
}

const COUNTERS: Partial<Record<LogEvent["type"], "Plays" | "Likes" | "Dislikes">> = {
  play: "Plays",
  like: "Likes",
  dislike: "Dislikes",
};

export async function writeLog(ev: LogEvent): Promise<void> {
  if (!notionEnabled()) {
    console.log("[log]", JSON.stringify(ev));
    return;
  }
  const tasks: Promise<unknown>[] = [];
  if (logDb()) {
    const title = [ev.type, ev.songTitle || ev.query].filter(Boolean).join(": ").slice(0, 200);
    const rt = (s?: string) => ({ rich_text: s ? [{ text: { content: s.slice(0, 1900) } }] : [] });
    tasks.push(
      notion("/pages", "POST", {
        parent: { database_id: logDb() },
        properties: {
          Event: { title: [{ text: { content: title } }] },
          Type: { select: { name: ev.type } },
          Query: rt(ev.query),
          "Song ID": rt(ev.songId),
          Results: { number: ev.results ?? null },
          Session: rt(ev.session),
          Device: rt(ev.device),
        },
      }),
    );
  }
  const counter = COUNTERS[ev.type];
  if (counter && ev.songId && /^[0-9a-f-]{32,36}$/i.test(ev.songId)) {
    tasks.push(
      (async () => {
        const page = await notion(`/pages/${ev.songId}`, "GET");
        const current = num(page.properties?.[counter]) ?? 0;
        await notion(`/pages/${ev.songId}`, "PATCH", {
          properties: { [counter]: { number: current + 1 } },
        });
        if (cache) {
          const s = cache.songs.find((x) => x.id === ev.songId);
          if (s) {
            const key = counter.toLowerCase() as "plays" | "likes" | "dislikes";
            s[key] = current + 1;
          }
        }
      })(),
    );
  }
  const results = await Promise.allSettled(tasks);
  for (const r of results) if (r.status === "rejected") console.error(r.reason);
}

// Shown only when Notion is not configured, so the app can be tried locally.
const demo = (id: string, title: string, artist: string, yearBE: number, language: string, genre: string): Song => ({
  id, title, artist, aliases: "", yearBE, language, genre,
  images: [`/demo-lyric.svg?song=${encodeURIComponent(title)}`],
  source: "", readability: 5, status: "ใช้ได้", plays: 0, likes: 0, dislikes: 0, youtube: "", youtubeChannel: "", lyricsLink: "", lyrics: "", licensed: true,
});

const DEMO_SONGS: Song[] = [
  demo("demo-1", "ตัวอย่างเพลงลูกทุ่ง", "ศิลปินตัวอย่าง", 2525, "ไทย", "ลูกทุ่ง"),
  demo("demo-2", "ตัวอย่างเพลงเพื่อชีวิต", "ศิลปินตัวอย่าง", 2530, "ไทย", "เพื่อชีวิต"),
  demo("demo-3", "ตัวอย่างเพลงสตริง", "ศิลปินตัวอย่าง", 2540, "ไทย", "สตริง"),
  demo("demo-4", "Sample English Song", "Sample Artist", 2520, "อังกฤษ", "สากล"),
  demo("demo-5", "ตัวอย่างเพลงลูกกรุง", "ศิลปินตัวอย่าง", 2516, "ไทย", "ลูกกรุง"),
  demo("demo-6", "Another Sample Song", "Sample Band", 2535, "อังกฤษ", "สากล"),
  {
    ...demo("demo-7", "ตัวอย่างเพลงแบบตัวหนังสือ", "ศิลปินตัวอย่าง", 2538, "ไทย", "สตริง"),
    images: [],
    lyrics:
      "นี่คือท่อนแรก ตัวหนังสือใหญ่\nอ่านง่ายในที่มืด\n\nนี่คือท่อนที่สอง\nเว้นบรรทัดว่างเพื่อแบ่งท่อน\n\n(ซ้ำ *)\nร้องตามได้ทุกคน",
  },
];

/* ------------------------------------------------------------------ */
/* Admin: full song records, editing, and usage statistics             */
/* ------------------------------------------------------------------ */

export type AdminSong = {
  id: string;
  url: string;
  title: string;
  artist: string;
  aliases: string;
  yearBE: number | null;
  language: string;
  genre: string;
  status: string;
  youtube: string;
  youtubeChannel: string;
  lyricsLink: string;
  licensed: boolean;
  licenseNote: string;
  lyrics: string;
  imageUrls: string;
  plays: number;
  likes: number;
  dislikes: number;
  createdTime: string;
};

/* eslint-disable @typescript-eslint/no-explicit-any */
function toAdminSong(page: any): AdminSong {
  const p = page.properties ?? {};
  return {
    id: page.id,
    url: page.url ?? "",
    title: text(p["Song"]),
    artist: text(p["Artist"]),
    aliases: text(p["Aliases"]),
    yearBE: num(p["Year BE"]),
    language: sel(p["Language"]),
    genre: sel(p["Genre"]),
    status: sel(p["Status"]),
    youtube: url(p["YouTube"]),
    youtubeChannel: text(p["YouTube Channel"]),
    lyricsLink: url(p["Lyrics Link"]),
    licensed: check(p["Licensed"]),
    licenseNote: text(p["License Note"]),
    lyrics: text(p["Lyrics"]),
    imageUrls: text(p["Image URLs"]),
    plays: num(p["Plays"]) ?? 0,
    likes: num(p["Likes"]) ?? 0,
    dislikes: num(p["Dislikes"]) ?? 0,
    createdTime: page.created_time ?? "",
  };
}
/* eslint-enable @typescript-eslint/no-explicit-any */

async function queryAll(db: string, body: Record<string, unknown>, max = 2000) {
  const out: unknown[] = [];
  let cursor: string | undefined;
  do {
    const data = await notion(`/databases/${db}/query`, "POST", { ...body, page_size: 100, start_cursor: cursor });
    out.push(...data.results);
    cursor = data.has_more && out.length < max ? data.next_cursor : undefined;
  } while (cursor);
  return out;
}

export async function listSongsAdmin(): Promise<AdminSong[]> {
  const pages = await queryAll(songsDb(), { sorts: [{ timestamp: "created_time", direction: "descending" }] });
  return pages.map(toAdminSong);
}

export type SongInput = Partial<Omit<AdminSong, "id" | "url" | "plays" | "likes" | "dislikes" | "createdTime">>;

export const SONG_STATUSES = ["รอตรวจ", "ใช้ได้", "ต้องหาใหม่"];
export const SONG_LANGUAGES = ["ไทย", "อังกฤษ"];

/** Notion rich text allows 2,000 characters per piece, so long text is split. */
function richText(s: string) {
  const parts = [];
  for (let i = 0; i < s.length; i += 1900) parts.push({ text: { content: s.slice(i, i + 1900) } });
  return { rich_text: parts.slice(0, 100) };
}
const httpsOrNull = (s: string) => (/^https:\/\//i.test(s.trim()) ? s.trim() : null);
const selectOrNull = (s: string, allowed: string[]) => (allowed.includes(s) ? { name: s } : null);

/** Validates admin input and turns it into Notion properties. Throws a Thai message on bad input. */
export function songProperties(input: SongInput, creating: boolean) {
  const props: Record<string, unknown> = {};
  if (input.title !== undefined) {
    if (!input.title.trim()) throw new Error("ต้องใส่ชื่อเพลง");
    props["Song"] = { title: [{ text: { content: input.title.trim().slice(0, 200) } }] };
  } else if (creating) throw new Error("ต้องใส่ชื่อเพลง");
  if (input.artist !== undefined) props["Artist"] = richText(input.artist.trim());
  if (input.aliases !== undefined) props["Aliases"] = richText(input.aliases.trim());
  if (input.youtubeChannel !== undefined) props["YouTube Channel"] = richText(input.youtubeChannel.trim());
  if (input.licenseNote !== undefined) props["License Note"] = richText(input.licenseNote.trim());
  if (input.lyrics !== undefined) props["Lyrics"] = richText(input.lyrics);
  if (input.imageUrls !== undefined) props["Image URLs"] = richText(input.imageUrls.trim());
  if (input.yearBE !== undefined) {
    const y = input.yearBE;
    if (y !== null && (!Number.isInteger(y) || y < 2400 || y > 2700)) throw new Error("ปีต้องเป็น พ.ศ. เช่น 2530");
    props["Year BE"] = { number: y };
  }
  if (input.language !== undefined) props["Language"] = { select: selectOrNull(input.language, SONG_LANGUAGES) };
  if (input.genre !== undefined) props["Genre"] = { select: input.genre.trim() ? { name: input.genre.trim().replace(/,/g, " ").slice(0, 50) } : null };
  if (input.status !== undefined) props["Status"] = { select: selectOrNull(input.status, SONG_STATUSES) };
  for (const [key, name] of [["youtube", "YouTube"], ["lyricsLink", "Lyrics Link"]] as const) {
    const v = input[key];
    if (v === undefined) continue;
    if (v.trim() && !httpsOrNull(v)) throw new Error(`ลิงก์ ${name} ต้องขึ้นต้นด้วย https://`);
    props[name] = { url: httpsOrNull(v) };
  }
  if (input.licensed !== undefined) {
    // Lyrics may only be shown with the rights holder's permission, so ticking needs a note of who allowed it.
    if (input.licensed && !(input.licenseNote ?? "").trim()) {
      throw new Error("ติ๊กว่าได้รับอนุญาตแล้ว ต้องกรอกรายละเอียดการอนุญาต (ใคร เมื่อไร) ด้วย");
    }
    props["Licensed"] = { checkbox: input.licensed };
  }
  if (creating && input.status === undefined) props["Status"] = { select: { name: "รอตรวจ" } };
  return props;
}

export async function createSong(input: SongInput): Promise<AdminSong> {
  const page = await notion("/pages", "POST", {
    parent: { database_id: songsDb() },
    properties: songProperties(input, true),
  });
  cache = null;
  return toAdminSong(page);
}

export async function updateSong(id: string, input: SongInput): Promise<AdminSong> {
  if (!/^[0-9a-f-]{32,36}$/i.test(id)) throw new Error("รหัสเพลงไม่ถูกต้อง");
  const page = await notion(`/pages/${id}`, "PATCH", { properties: songProperties(input, false) });
  cache = null;
  return toAdminSong(page);
}

export const clearSongCache = () => {
  cache = null;
};

export type Stats = {
  days: number;
  totals: Record<string, number>;
  sessions: number;
  missing: { query: string; count: number; requested: number }[];
  topPlayed: { songId: string; title: string; count: number }[];
  problems: { songId: string; title: string; count: number }[];
};

/** Summarises the usage log so the admin can see what people want and what is broken. */
export async function getStats(days = 30): Promise<Stats> {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const pages: any[] = logDb()
    ? await queryAll(logDb(), { filter: { timestamp: "created_time", created_time: { on_or_after: since } } })
    : [];
  const totals: Record<string, number> = {};
  const sessions = new Set<string>();
  const missing = new Map<string, { query: string; count: number; requested: number }>();
  const played = new Map<string, { songId: string; title: string; count: number }>();
  const problems = new Map<string, { songId: string; title: string; count: number }>();
  for (const page of pages) {
    const p = page.properties ?? {};
    const type = sel(p["Type"]);
    const query = text(p["Query"]).trim();
    const songId = text(p["Song ID"]);
    const title = text(p["Event"]).replace(/^[a-z_]+:\s*/, "");
    totals[type] = (totals[type] ?? 0) + 1;
    const s = text(p["Session"]);
    if (s) sessions.add(s);
    if ((type === "search_miss" || type === "request") && query) {
      const key = normalizeKey(query);
      const m = missing.get(key) ?? { query, count: 0, requested: 0 };
      m.count++;
      if (type === "request") m.requested++;
      missing.set(key, m);
    }
    if (type === "play" && songId) {
      const e = played.get(songId) ?? { songId, title, count: 0 };
      e.count++;
      played.set(songId, e);
    }
    if (type === "dislike" && songId) {
      const e = problems.get(songId) ?? { songId, title, count: 0 };
      e.count++;
      problems.set(songId, e);
    }
  }
  /* eslint-enable @typescript-eslint/no-explicit-any */
  const top = <T extends { count: number }>(m: Map<string, T>, n = 15) =>
    [...m.values()].sort((a, b) => b.count - a.count).slice(0, n);
  return {
    days,
    totals,
    sessions: sessions.size,
    missing: [...missing.values()].sort((a, b) => b.requested - a.requested || b.count - a.count).slice(0, 20),
    topPlayed: top(played),
    problems: top(problems),
  };
}

const normalizeKey = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();

/* ------------------------------------------------------------------ */
/* Banners linking to our other web apps                               */
/* ------------------------------------------------------------------ */

export type Banner = { id: string; title: string; subtitle: string; link: string; image: string; active: boolean; order: number };

const bannerDb = () => process.env.NOTION_BANNER_DB ?? "";
export const bannersEnabled = () => Boolean(token() && bannerDb());

/** Shown when no banner database is set up yet, or it cannot be read. */
export const DEFAULT_BANNERS: Banner[] = [
  { id: "default", title: "Palmiste", subtitle: "เปิด web app Palmiste ของเรา", link: "https://palmiste.chaiyaput.xyz", image: "", active: true, order: 1 },
];

/* eslint-disable @typescript-eslint/no-explicit-any */
const toBanner = (page: any): Banner => {
  const p = page.properties ?? {};
  return {
    id: page.id,
    title: text(p["Title"]),
    subtitle: text(p["Subtitle"]),
    link: url(p["Link"]),
    image: url(p["Image"]),
    active: check(p["Active"]),
    order: num(p["Order"]) ?? 0,
  };
};
/* eslint-enable @typescript-eslint/no-explicit-any */

let bannerCache: { at: number; banners: Banner[] } | null = null;

export async function listBanners(includeInactive = false): Promise<Banner[]> {
  if (!bannersEnabled()) return includeInactive ? [] : DEFAULT_BANNERS;
  if (!includeInactive && bannerCache && Date.now() - bannerCache.at < 5 * 60 * 1000) return bannerCache.banners;
  const all = (await queryAll(bannerDb(), { sorts: [{ property: "Order", direction: "ascending" }] })).map(toBanner);
  if (includeInactive) return all;
  const banners = all.filter((b) => b.active && b.title && /^https:\/\//i.test(b.link));
  bannerCache = { at: Date.now(), banners };
  return banners;
}

export type BannerInput = Partial<Omit<Banner, "id">>;

function bannerProperties(b: BannerInput, creating: boolean) {
  const props: Record<string, unknown> = {};
  if (b.title !== undefined || creating) {
    if (!b.title?.trim()) throw new Error("ต้องใส่ชื่อแบนเนอร์");
    props["Title"] = { title: [{ text: { content: b.title.trim().slice(0, 100) } }] };
  }
  if (b.subtitle !== undefined) props["Subtitle"] = richText(b.subtitle.trim().slice(0, 200));
  if (b.link !== undefined || creating) {
    if (!httpsOrNull(b.link ?? "")) throw new Error("ลิงก์ต้องขึ้นต้นด้วย https://");
    props["Link"] = { url: httpsOrNull(b.link ?? "") };
  }
  if (b.image !== undefined) {
    if (b.image.trim() && !httpsOrNull(b.image)) throw new Error("ลิงก์รูปต้องขึ้นต้นด้วย https://");
    props["Image"] = { url: httpsOrNull(b.image) };
  }
  if (b.active !== undefined) props["Active"] = { checkbox: b.active };
  if (b.order !== undefined) props["Order"] = { number: Number.isFinite(b.order) ? b.order : 0 };
  return props;
}

function needBannerDb() {
  if (!bannersEnabled()) throw new Error("ยังไม่ได้ตั้งค่าฐานข้อมูลแบนเนอร์ (NOTION_BANNER_DB) ใน Vercel");
}

export async function createBanner(b: BannerInput): Promise<Banner> {
  needBannerDb();
  const page = await notion("/pages", "POST", { parent: { database_id: bannerDb() }, properties: bannerProperties(b, true) });
  bannerCache = null;
  return toBanner(page);
}

export async function updateBanner(id: string, b: BannerInput): Promise<Banner> {
  needBannerDb();
  if (!/^[0-9a-f-]{32,36}$/i.test(id)) throw new Error("รหัสแบนเนอร์ไม่ถูกต้อง");
  const page = await notion(`/pages/${id}`, "PATCH", { properties: bannerProperties(b, false) });
  bannerCache = null;
  return toBanner(page);
}

export async function deleteBanner(id: string): Promise<void> {
  needBannerDb();
  if (!/^[0-9a-f-]{32,36}$/i.test(id)) throw new Error("รหัสแบนเนอร์ไม่ถูกต้อง");
  await notion(`/pages/${id}`, "PATCH", { archived: true });
  bannerCache = null;
}
