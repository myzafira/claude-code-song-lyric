"use client";

import { useEffect, useRef, useState } from "react";
import { availableModes, defaultMode, hasLyricsText, youtubeId, type Song, type ViewMode } from "@/lib/types.ts";
import YouTubePlayer from "./YouTubePlayer";
import { sendLog } from "@/lib/client-log.ts";

const PREF_KEY = "esl.view.v1";

const MODE_LABEL: Record<ViewMode, string> = {
  video: "▶ คลิป",
  image: "🖼 ภาพ",
  text: "Aa ตัวหนังสือ",
  link: "🔗 ลิงก์",
};

const hostOf = (u: string) => {
  try {
    return new URL(u).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
};

type Prefs = { zoom: number; invert: boolean; videoZoom: number };

function loadPrefs(): Prefs {
  try {
    const p = JSON.parse(localStorage.getItem(PREF_KEY) ?? "{}");
    return {
      zoom: typeof p.zoom === "number" ? p.zoom : 100,
      invert: Boolean(p.invert),
      videoZoom: typeof p.videoZoom === "number" ? p.videoZoom : 100,
    };
  } catch {
    return { zoom: 100, invert: false, videoZoom: 100 };
  }
}

export default function SingView({
  queue,
  onDone,
  onMinimize,
}: {
  queue: Song[];
  onDone: (remaining: Song[]) => void;
  onMinimize?: (mini: boolean) => void;
}) {
  const [index, setIndex] = useState(0);
  const [page, setPage] = useState(0);
  const [prefs, setPrefs] = useState<Prefs>({ zoom: 100, invert: false, videoZoom: 100 });
  const [voted, setVoted] = useState<Record<string, "like" | "dislike">>({});
  const [broken, setBroken] = useState(false);
  const [hideUi, setHideUi] = useState(false);
  const [toast, setToast] = useState("");
  const [mini, setMini] = useState(false);
  const [full, setFull] = useState(false);
  const [canFull, setCanFull] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);

  const song = queue[index];
  const [mode, setMode] = useState<ViewMode>(song ? defaultMode(song) : "video");
  const [videoError, setVideoError] = useState(false);
  const textMode = mode === "text";
  const videoMode = mode === "video";
  const modes = song ? availableModes(song) : [];
  const total = mode === "image" ? (song?.images.length ?? 0) : 1;

  useEffect(() => setPrefs(loadPrefs()), []);
  useEffect(() => {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
    } catch {}
  }, [prefs]);

  // keep the screen on while singing, and go full screen when possible
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<typeof lock> } };
    const acquire = () => nav.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    acquire();
    const onVis = () => document.visibilityState === "visible" && acquire();
    document.addEventListener("visibilitychange", onVis);
    setCanFull(Boolean(document.documentElement.requestFullscreen));
    const onFs = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFs);
    document.documentElement.requestFullscreen?.().catch(() => {});
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      document.removeEventListener("fullscreenchange", onFs);
      lock?.release().catch(() => {});
      if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (!song) return;
    setMode(defaultMode(song));
    setVideoError(false);
    sendLog({ type: "play", songId: song.id, songTitle: song.title });
  }, [song]);

  useEffect(() => {
    setBroken(false);
    scroller.current?.scrollTo({ top: 0 });
  }, [index, page, mode]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 1600);
    return () => clearTimeout(t);
  }, [toast]);

  const finish = () => onDone(queue.slice(index + 1));

  // Window-style controls: minimise shrinks the stage to a small floating window (the song keeps playing),
  // maximise restores it and toggles full screen.
  const minimize = () => {
    setMini(true);
    onMinimize?.(true);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  };
  const maximize = () => {
    if (mini) {
      setMini(false);
      onMinimize?.(false);
      document.documentElement.requestFullscreen?.().catch(() => {});
      return;
    }
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };
  const nextSong = () => {
    if (index + 1 >= queue.length) return finish();
    setIndex(index + 1);
    setPage(0);
  };
  // In text mode one "page" is one screenful of the scrolling lyrics.
  const scrollBy = (dir: 1 | -1) => {
    const el = scroller.current;
    if (!el) return false;
    const atEnd = el.scrollTop + el.clientHeight >= el.scrollHeight - 4;
    if (dir === 1 && atEnd) return false;
    if (dir === -1 && el.scrollTop <= 0) return false;
    el.scrollBy({ top: dir * el.clientHeight * 0.85, behavior: "smooth" });
    return true;
  };
  const nextPage = () => {
    if (videoMode || mode === "link") return nextSong();
    if (textMode) return scrollBy(1) || nextSong();
    return page + 1 < total ? setPage(page + 1) : nextSong();
  };
  const prevPage = () => {
    if (textMode) return scrollBy(-1);
    if (page > 0) setPage(page - 1);
  };

  // Video zoom enlarges the player around its lower part, where karaoke lyrics usually run.
  const zoomBy = (dir: 1 | -1) =>
    setPrefs((p) =>
      videoMode
        ? { ...p, videoZoom: Math.min(250, Math.max(100, p.videoZoom + dir * 25)) }
        : { ...p, zoom: Math.min(300, Math.max(60, p.zoom + dir * 20)) },
    );

  const vote = (type: "like" | "dislike") => {
    if (!song || voted[song.id]) return;
    setVoted({ ...voted, [song.id]: type });
    sendLog({ type, songId: song.id, songTitle: song.title });
    setToast(type === "like" ? "ขอบคุณ! 👍" : "ขอบคุณ จะหาแบบที่อ่านง่ายกว่านี้");
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") nextPage();
      else if (e.key === "ArrowLeft" || e.key === "PageUp") prevPage();
      else if (e.key === "Escape" && !mini && !document.fullscreenElement) finish();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (!song) return null;
  const upNext = queue[index + 1];

  return (
    <div className={`stage${hideUi && !mini ? " hide-ui" : ""}${mini ? " mini" : ""}`}>
      <div className="stage-top">
        <div className="win-btns">
          <button className="btn ghost win" onClick={finish} aria-label="ปิด กลับไปหน้าคิว" title="ปิด">
            ✕
          </button>
          <button className="btn ghost win" onClick={minimize} disabled={mini} aria-label="ย่อหน้าต่างลง" title="ย่อลง">
            –
          </button>
          {(mini || canFull) && (
            <button
              className="btn ghost win"
              onClick={maximize}
              aria-label={mini ? "ขยายกลับเต็มหน้า" : full ? "ออกจากเต็มจอ" : "ขยายเต็มจอ"}
              title={mini ? "ขยาย" : full ? "ออกจากเต็มจอ" : "เต็มจอ"}
            >
              {full && !mini ? "❐" : "☐"}
            </button>
          )}
        </div>
        <div className="now">
          <b>{song.title}</b> {song.artist && `· ${song.artist}`}
          {total > 1 && ` · หน้า ${page + 1}/${total}`}
          {upNext ? ` · ต่อไป: ${upNext.title}` : " · เพลงสุดท้าย"}
        </div>
        {modes.length > 1 && (
          <button
            className="btn ghost"
            style={{ minHeight: 48, padding: "6px 12px", fontSize: "1rem" }}
            onClick={() => {
              setMode(modes[(modes.indexOf(mode) + 1) % modes.length]);
              setPage(0);
            }}
          >
            {MODE_LABEL[modes[(modes.indexOf(mode) + 1) % modes.length]]}
          </button>
        )}
      </div>

      <div
        ref={scroller}
        className={`stage-img${prefs.invert ? " invert" : ""}${textMode ? " text" : ""}${videoMode ? " video" : ""}`}
        onDoubleClick={() => !videoMode && setHideUi(!hideUi)}
      >
        {mode === "link" ? (
          <div className="stage-msg">
            <p style={{ color: "#fff", fontSize: "1.6rem" }}>{song.title}</p>
            <p>
              <a className="btn accent big-link" href={song.lyricsLink} target="_blank" rel="noopener noreferrer">
                📖 เปิดเนื้อเพลง
              </a>
            </p>
            <p>เปิดที่เว็บ {hostOf(song.lyricsLink)} (แหล่งที่ได้รับอนุญาต)</p>
            <p>ร้องจบแล้วกลับมาที่หน้านี้ แล้วกด ▶ เพลงต่อไป</p>
          </div>
        ) : videoMode ? (
          videoError ? (
            <div className="stage-msg">
              <p>เปิดคลิปในแอปไม่ได้ (เจ้าของปิดการฝังคลิป หรืออินเทอร์เน็ตมีปัญหา)</p>
              <p>
                <a className="btn accent" href={song.youtube} target="_blank" rel="noopener noreferrer">
                  เปิดใน YouTube
                </a>
              </p>
              <button className="btn" onClick={nextSong}>ข้ามไปเพลงต่อไป ▶</button>
            </div>
          ) : (
            <div className="video-box" style={{ transform: `scale(${prefs.videoZoom / 100})` }}>
            <YouTubePlayer
              videoId={youtubeId(song.youtube)!}
              onEnded={nextSong}
              onError={() => {
                setVideoError(true);
                sendLog({ type: "dislike", songId: song.id, songTitle: song.title, query: "video_error" });
              }}
            />
            </div>
          )
        ) : textMode ? (
          <div className="lyrics-text" style={{ fontSize: `${(2 * prefs.zoom) / 100}rem` }}>
            <div className="lyrics-title">{song.title}</div>
            {song.lyrics
              .trim()
              .split(/\n\s*\n/)
              .map((stanza, i) => (
                <p key={i}>
                  {stanza.split("\n").map((line, j) => (
                    <span key={j}>
                      {line}
                      <br />
                    </span>
                  ))}
                </p>
              ))}
            <div className="lyrics-end">— จบเพลง —</div>
          </div>
        ) : broken ? (
          <div className="stage-msg">
            <p>ภาพนี้โหลดไม่ได้</p>
            <button className="btn accent" onClick={nextPage}>ข้ามไป ▶</button>
          </div>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={`${song.id}-${page}`}
            src={song.images[page]}
            alt={`เนื้อเพลง ${song.title} หน้า ${page + 1}`}
            referrerPolicy="no-referrer"
            style={{ width: `${prefs.zoom}%` }}
            onError={() => {
              if (hasLyricsText(song)) setMode("text");
              else if (youtubeId(song.youtube)) setMode("video");
              else setBroken(true);
              sendLog({ type: "dislike", songId: song.id, songTitle: song.title, query: "image_error" });
            }}
          />
        )}
      </div>

      <div className="stage-bar">
        <button className="btn" onClick={prevPage} disabled={videoMode || mode === "link" || (!textMode && page === 0)}>
          <span className="ico">◀</span>ย้อนกลับ
        </button>
        <button className="btn accent" onClick={nextPage}>
          <span className="ico">▶</span>
          {(textMode || (mode === "image" && page + 1 < total)) ? "ถัดไป" : upNext ? "เพลงต่อไป" : "จบ"}
        </button>
        <button className="btn" onClick={() => zoomBy(-1)} disabled={mode === "link" || (videoMode && prefs.videoZoom <= 100)}>
          <span className="ico">A−</span>เล็กลง
        </button>
        <button className="btn" onClick={() => zoomBy(1)} disabled={mode === "link" || (videoMode && prefs.videoZoom >= 250)}>
          <span className="ico">A+</span>ใหญ่ขึ้น
        </button>
        <button className="btn" onClick={() => setPrefs({ ...prefs, invert: !prefs.invert })} disabled={mode !== "image"}>
          <span className="ico">🌙</span>{prefs.invert ? "สีปกติ" : "พื้นดำ"}
        </button>
        <button className="btn" onClick={nextSong} disabled={!upNext}>
          <span className="ico">⏭</span>ข้ามเพลง
        </button>
        <button className="btn" onClick={() => vote("like")} disabled={Boolean(voted[song.id])}>
          <span className="ico">👍</span>อ่านง่าย
        </button>
        <button className="btn" onClick={() => vote("dislike")} disabled={Boolean(voted[song.id])}>
          <span className="ico">👎</span>อ่านยาก
        </button>
      </div>

      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}
