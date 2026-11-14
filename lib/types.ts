export type Song = {
  id: string;
  title: string;
  artist: string;
  aliases: string;
  yearBE: number | null;
  language: string;
  genre: string;
  images: string[];
  source: string;
  readability: number | null;
  status: string;
  plays: number;
  likes: number;
  dislikes: number;
  youtube: string;
  lyrics: string;
};

/** A song can be sung when it has lyric images or lyric text. */
export const hasLyricsText = (s: Song) => (s.lyrics ?? "").trim().length > 0;
export const singable = (s: Song) => (s.images?.length ?? 0) > 0 || hasLyricsText(s);

/**
 * Show web images when they exist and people have not marked them hard to read;
 * otherwise fall back to the app's own large-text view.
 */
export function preferImages(s: Song): boolean {
  if (s.images.length === 0) return false;
  if (!hasLyricsText(s)) return true;
  return s.dislikes < s.likes + 3 && (s.readability ?? 3) >= 3;
}

export type LogType =
  | "search"
  | "search_miss"
  | "queue_add"
  | "play"
  | "like"
  | "dislike"
  | "request";

export type LogEvent = {
  type: LogType;
  query?: string;
  songId?: string;
  songTitle?: string;
  results?: number;
  session?: string;
  device?: string;
};
