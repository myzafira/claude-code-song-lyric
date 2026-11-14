import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, searchSongs } from "./search.ts";
import type { Song } from "./types.ts";

const base: Song = {
  id: "", title: "", artist: "", aliases: "", yearBE: null, language: "ไทย",
  genre: "", images: ["x"], source: "", readability: 4, status: "ใช้ได้",
  plays: 0, likes: 0, dislikes: 0, youtube: "", youtubeChannel: "", lyricsLink: "", lyrics: "", licensed: true, album: "", linkType: "karaoke",
};
const songs: Song[] = [
  { ...base, id: "1", title: "ตังเก", artist: "คาราบาว" },
  { ...base, id: "2", title: "คิดถึง", artist: "พงษ์สิทธิ์ คำภีร์" },
  { ...base, id: "3", title: "Hotel California", artist: "Eagles", language: "อังกฤษ" },
  { ...base, id: "4", title: "รักเธอเสมอ", artist: "ไม่ทราบ", aliases: "rak tur samer" },
];

test("normalize ignores tone marks, case and spaces", () => {
  assert.equal(normalize("รักเธอ เสมอ"), normalize("รกเธอเสมอ"));
  assert.equal(normalize("Hotel  California"), "hotelcalifornia");
});

test("finds Thai title", () => {
  assert.equal(searchSongs("ตังเก", songs)[0].id, "1");
});

test("finds by artist", () => {
  assert.equal(searchSongs("eagles", songs)[0].id, "3");
});

test("title plus artist query", () => {
  assert.equal(searchSongs("ตังเก คาราบาว", songs)[0].id, "1");
});

test("finds by alias", () => {
  assert.equal(searchSongs("rak tur", songs)[0].id, "4");
});

test("no match returns empty", () => {
  assert.equal(searchSongs("zzzz", songs).length, 0);
});

import { preferImages, singable } from "./types.ts";

test("text-only song is singable and shown as text", () => {
  const s = { ...base, images: [], lyrics: "ท่อนหนึ่ง" };
  assert.equal(singable(s), true);
  assert.equal(preferImages(s), false);
});

test("images that many people find hard to read fall back to text", () => {
  const s = { ...base, lyrics: "ท่อนหนึ่ง", likes: 1, dislikes: 5 };
  assert.equal(preferImages(s), false);
  assert.equal(preferImages({ ...s, dislikes: 0 }), true);
});

test("song without images or text is not singable", () => {
  assert.equal(singable({ ...base, images: [] }), false);
});

import { defaultMode, youtubeId } from "./types.ts";

test("unlicensed lyrics are never singable or shown", () => {
  const s = { ...base, licensed: false, lyrics: "ท่อนหนึ่ง" };
  assert.equal(singable(s), false);
  assert.equal(singable({ ...s, youtube: "https://www.youtube.com/watch?v=abcdefghijk" }), true);
  assert.equal(defaultMode({ ...s, youtube: "https://youtu.be/abcdefghijk" }), "video");
});

test("youtubeId parses common URL forms", () => {
  assert.equal(youtubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=3"), "dQw4w9WgXcQ");
  assert.equal(youtubeId("https://youtu.be/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(youtubeId("https://www.youtube.com/embed/dQw4w9WgXcQ"), "dQw4w9WgXcQ");
  assert.equal(youtubeId("https://example.com/x"), null);
});

test("a licensed lyrics link alone makes a song singable, opened on the source site", () => {
  const s = { ...base, images: [], licensed: false, lyricsLink: "https://www.joox.com/th/single/x" };
  assert.equal(singable(s), true);
  assert.equal(defaultMode(s), "link");
  assert.equal(singable({ ...s, lyricsLink: "javascript:alert(1)" }), false);
});

const more: Song[] = [
  { ...base, id: "k1", title: "เพลงหนึ่ง", artist: "นักร้องเอ", album: "อัลบั้มแรก", linkType: "karaoke" },
  { ...base, id: "k2", title: "เพลงสอง", artist: "นักร้องเอ", linkType: "karaoke" },
  { ...base, id: "v1", title: "นักร้องเอ รำลึก", artist: "วงบี", album: "รวมฮิต", linkType: "vocal" },
];

test("search by singer lists only that singer's songs", () => {
  const ids = searchSongs("นักร้องเอ", more, { by: "artist" }).map((s) => s.id).sort();
  assert.deepEqual(ids, ["k1", "k2"]);
});

test("search by album", () => {
  assert.deepEqual(searchSongs("อัลบั้มแรก", more, { by: "album" }).map((s) => s.id), ["k1"]);
  assert.equal(searchSongs("รวมฮิต", more)[0].id, "v1");
});

test("filter karaoke vs vocal", () => {
  assert.deepEqual(searchSongs("นักร้องเอ", more, { type: "vocal" }).map((s) => s.id), ["v1"]);
  assert.equal(searchSongs("นักร้องเอ", more, { type: "karaoke" }).length, 2);
});

test("link type is inferred from the channel unless set", async () => {
  const { inferLinkType } = await import("./types.ts");
  assert.equal(inferLinkType("", "GMM Karaoke (@gmmkaraoke)"), "karaoke");
  assert.equal(inferLinkType("", "Whattheduck (@whattheduckmusic)"), "vocal");
  assert.equal(inferLinkType("มีเสียงร้อง", "GMM Karaoke"), "vocal");
});
