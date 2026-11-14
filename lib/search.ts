import { singable, type LinkType, type Song } from "./types.ts";

/** Which field to search: everything, or only song title, singer, or album. */
export type SearchBy = "all" | "title" | "artist" | "album";

export type SearchOptions = {
  by?: SearchBy;
  /** Only karaoke clips (no lead vocal) or only clips with the singer's voice. */
  type?: LinkType | "all";
  limit?: number;
};

// Thai tone marks and some vowel signs are often typed inconsistently,
// so they are dropped for matching. Spaces and punctuation are ignored too.
const THAI_MARKS = /[ัิ-ฺ็-๎]/g;

export function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFC")
    .replace(THAI_MARKS, "")
    .replace(/[^\p{L}\p{N}]+/gu, "");
}

function fieldScore(query: string, field: string): number {
  const f = normalize(field);
  if (!f || !query) return 0;
  if (f === query) return 100;
  if (f.startsWith(query)) return 80;
  if (f.includes(query)) return 60;
  // every query character appears in order (loose typo tolerance)
  let i = 0;
  for (const ch of f) if (ch === query[i]) i++;
  if (i === query.length && query.length >= 3) return 25;
  return 0;
}

export function scoreSong(query: string, song: Song, by: SearchBy = "all"): number {
  const q = normalize(query);
  if (!q) return 0;
  const words = query.split(/\s+/).map(normalize).filter(Boolean);
  let best: number;
  if (by === "title") {
    best = Math.max(fieldScore(q, song.title), fieldScore(q, song.aliases) * 0.9);
  } else if (by === "artist") {
    best = fieldScore(q, song.artist);
  } else if (by === "album") {
    best = fieldScore(q, song.album ?? "");
  } else {
    best = Math.max(
      fieldScore(q, song.title),
      fieldScore(q, song.aliases) * 0.9,
      fieldScore(q, song.artist) * 0.7,
      fieldScore(q, song.album ?? "") * 0.65,
      fieldScore(q, `${song.title}${song.artist}`) * 0.8,
    );
    // multi-word query such as "ตังเก คาราบาว": all words must hit somewhere
    if (best === 0 && words.length > 1) {
      const all = `${song.title} ${song.aliases} ${song.artist} ${song.album ?? ""}`;
      if (words.every((w) => normalize(all).includes(w))) best = 50;
    }
  }
  if (best === 0) return 0;
  // prefer songs people liked and whose images are easy to read
  const quality =
    (song.readability ?? 3) * 2 +
    Math.min(song.likes - song.dislikes, 20) * 0.3 +
    Math.min(song.plays, 50) * 0.05 +
    (singable(song) ? 5 : -30);
  return best + quality;
}

const typeMatches = (s: Song, type: SearchOptions["type"]) => !type || type === "all" || s.linkType === type;

export function searchSongs(query: string, songs: Song[], opts: SearchOptions | number = {}): Song[] {
  const o = typeof opts === "number" ? { limit: opts } : opts;
  const by = o.by ?? "all";
  // a singer or album search should list all of their songs, not only the top few
  const limit = o.limit ?? (by === "artist" || by === "album" ? 200 : 40);
  return songs
    .filter((s) => typeMatches(s, o.type))
    .map((s) => ({ s, score: scoreSong(query, s, by) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.s);
}

export function popularSongs(songs: Song[], limit = 12, type: SearchOptions["type"] = "all"): Song[] {
  return songs
    .filter((s) => singable(s) && typeMatches(s, type))
    .sort(
      (a, b) =>
        b.plays + b.likes * 3 - b.dislikes * 3 - (a.plays + a.likes * 3 - a.dislikes * 3),
    )
    .slice(0, limit);
}
