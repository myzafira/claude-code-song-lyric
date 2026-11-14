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

export function parseImageUrls(raw: string): string[] {
  return raw
    .split(/[\s,]+/)
    .map((s) => s.trim())
    .filter((s) => /^https?:\/\//i.test(s));
}

function toSong(page: any): Song {
  const p = page.properties ?? {};
  return {
    id: page.id,
    title: text(p["Song"]),
    artist: text(p["Artist"]),
    aliases: text(p["Aliases"]),
    yearBE: num(p["Year BE"]),
    language: sel(p["Language"]),
    genre: sel(p["Genre"]),
    images: parseImageUrls(text(p["Image URLs"])),
    source: url(p["Source"]),
    readability: num(p["Readability"]),
    status: sel(p["Status"]),
    plays: num(p["Plays"]) ?? 0,
    likes: num(p["Likes"]) ?? 0,
    dislikes: num(p["Dislikes"]) ?? 0,
    youtube: url(p["YouTube"]),
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
  source: "", readability: 5, status: "ใช้ได้", plays: 0, likes: 0, dislikes: 0, youtube: "",
});

const DEMO_SONGS: Song[] = [
  demo("demo-1", "ตัวอย่างเพลงลูกทุ่ง", "ศิลปินตัวอย่าง", 2525, "ไทย", "ลูกทุ่ง"),
  demo("demo-2", "ตัวอย่างเพลงเพื่อชีวิต", "ศิลปินตัวอย่าง", 2530, "ไทย", "เพื่อชีวิต"),
  demo("demo-3", "ตัวอย่างเพลงสตริง", "ศิลปินตัวอย่าง", 2540, "ไทย", "สตริง"),
  demo("demo-4", "Sample English Song", "Sample Artist", 2520, "อังกฤษ", "สากล"),
  demo("demo-5", "ตัวอย่างเพลงลูกกรุง", "ศิลปินตัวอย่าง", 2516, "ไทย", "ลูกกรุง"),
  demo("demo-6", "Another Sample Song", "Sample Band", 2535, "อังกฤษ", "สากล"),
];
