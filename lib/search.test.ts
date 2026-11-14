import { test } from "node:test";
import assert from "node:assert/strict";
import { normalize, searchSongs } from "./search.ts";
import type { Song } from "./types.ts";

const base: Song = {
  id: "", title: "", artist: "", aliases: "", yearBE: null, language: "ไทย",
  genre: "", images: ["x"], source: "", readability: 4, status: "ใช้ได้",
  plays: 0, likes: 0, dislikes: 0, youtube: "",
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
