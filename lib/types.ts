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
};

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
