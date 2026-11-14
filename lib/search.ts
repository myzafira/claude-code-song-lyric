import { singable, type Song } from "./types.ts";

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

export function scoreSong(query: string, song: Song): number {
  const q = normalize(query);
  if (!q) return 0;
  const words = query.split(/\s+/).map(normalize).filter(Boolean);
  let best = Math.max(
    fieldScore(q, song.title),
    fieldScore(q, song.aliases) * 0.9,
    fieldScore(q, song.artist) * 0.7,
    fieldScore(q, `${song.title}${song.artist}`) * 0.8,
  );
  // multi-word query such as "ตังเก คาราบาว": all words must hit somewhere
  if (best === 0 && words.length > 1) {
    const all = `${song.title} ${song.aliases} ${song.artist}`;
    if (words.every((w) => normalize(all).includes(w))) best = 50;
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

export function searchSongs(query: string, songs: Song[], limit = 20): Song[] {
  return songs
    .map((s) => ({ s, score: scoreSong(query, s) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.s);
}

export function popularSongs(songs: Song[], limit = 12): Song[] {
  return songs
    .filter(singable)
    .sort(
      (a, b) =>
        b.plays + b.likes * 3 - b.dislikes * 3 - (a.plays + a.likes * 3 - a.dislikes * 3),
    )
    .slice(0, limit);
}
