export type Song = {
  id: string;
  title: string;
  artist: string;
  /** Album name, filled in only when checked against an official source. */
  album: string;
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
  youtubeChannel: string;
  /** Link out to a licensed lyrics page (opened on that site, never copied). */
  lyricsLink: string;
  lyrics: string;
  /** Rights holder has allowed us to show this song's lyrics (images/text). */
  licensed: boolean;
  /** "karaoke" = music and on-screen lyrics, no lead vocal; "vocal" = the singer's voice is in the clip. */
  linkType: LinkType;
};

export type LinkType = "karaoke" | "vocal";

export const LINK_TYPE_LABEL: Record<LinkType, string> = {
  karaoke: "คาราโอเกะ (ไม่มีเสียงร้อง)",
  vocal: "มีเสียงร้อง",
};

/**
 * Uses the value set in Notion when there is one. Otherwise karaoke channels and
 * clips titled karaoke count as karaoke, and other official clips (MV, lyric videos) as vocal.
 */
export function inferLinkType(explicit: string, channel: string): LinkType {
  if (explicit === "คาราโอเกะ" || explicit === "karaoke") return "karaoke";
  if (explicit === "มีเสียงร้อง" || explicit === "vocal") return "vocal";
  return /karaoke|คาราโอเกะ|instrumental/i.test(channel) ? "karaoke" : "vocal";
}

export type ViewMode = "video" | "image" | "text" | "link";

/** Extracts the 11-character video id from any common YouTube URL form. */
export function youtubeId(url: string | undefined): string | null {
  if (!url) return null;
  const m = url.match(/(?:youtu\.be\/|[?&]v=|\/embed\/|\/shorts\/|\/live\/)([\w-]{11})/);
  return m ? m[1] : null;
}

export const hasLyricsText = (s: Song) => Boolean(s.licensed) && (s.lyrics ?? "").trim().length > 0;
export const hasImages = (s: Song) => Boolean(s.licensed) && (s.images?.length ?? 0) > 0;
export const hasVideo = (s: Song) => youtubeId(s.youtube) !== null;
export const hasLink = (s: Song) => /^https:\/\//i.test(s.lyricsLink ?? "");

/**
 * A song can be sung when it has an official karaoke video, or lyrics that
 * the rights holder has licensed to us. Unlicensed lyrics are never shown.
 */
export const singable = (s: Song) => hasVideo(s) || hasImages(s) || hasLyricsText(s) || hasLink(s);

export function availableModes(s: Song): ViewMode[] {
  const modes: ViewMode[] = [];
  if (hasImages(s)) modes.push("image");
  if (hasLyricsText(s)) modes.push("text");
  if (hasVideo(s)) modes.push("video");
  if (hasLink(s)) modes.push("link");
  return modes;
}

/** Licensed lyrics first (big and clear), official video otherwise. */
export function defaultMode(s: Song): ViewMode {
  if (hasImages(s) && preferImages(s)) return "image";
  if (hasLyricsText(s)) return "text";
  if (hasImages(s)) return "image";
  if (hasVideo(s)) return "video";
  return "link";
}

/**
 * Show web images when they exist and people have not marked them hard to read;
 * otherwise fall back to the app's own large-text view.
 */
export function preferImages(s: Song): boolean {
  if (!hasImages(s)) return false;
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
