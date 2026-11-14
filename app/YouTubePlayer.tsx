"use client";

import { useEffect, useRef, useState } from "react";
import { AUTOSTART_DELAY_MS, AUTOSTART_RETRY_MS, nextAutostartStep } from "../lib/autostart";

/* Minimal typing for the YouTube IFrame Player API. */
type YTPlayer = {
  destroy: () => void;
  playVideo: () => void;
  mute: () => void;
  unMute: () => void;
  getPlayerState: () => number;
};
type YTNamespace = {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      host?: string;
      playerVars?: Record<string, number | string>;
      events?: {
        onReady?: () => void;
        onStateChange?: (e: { data: number }) => void;
        onError?: (e: { data: number }) => void;
      };
    },
  ) => YTPlayer;
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;

function loadApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (!apiPromise) {
    apiPromise = new Promise((resolve, reject) => {
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        prev?.();
        resolve(window.YT!);
      };
      const tag = document.createElement("script");
      tag.src = "https://www.youtube.com/iframe_api";
      tag.onerror = () => {
        apiPromise = null;
        reject(new Error("youtube_api_unavailable"));
      };
      document.head.appendChild(tag);
    });
  }
  return apiPromise;
}

const ENDED = 0;

/**
 * Plays an official video through YouTube's own embedded player, which is the
 * licensed way to show a rights holder's upload. Calls onEnded when it finishes
 * and onError when the owner does not allow embedding.
 *
 * If the clip hasn't started 5 seconds after it loads (browsers often block
 * autoplay with sound), it presses play; if the browser still blocks sound it
 * plays muted and shows a button to turn the sound on.
 */
export default function YouTubePlayer({
  videoId,
  onEnded,
  onError,
}: {
  videoId: string;
  onEnded: () => void;
  onError: (code: number) => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const handlers = useRef({ onEnded, onError });
  handlers.current = { onEnded, onError };
  const playerRef = useRef<YTPlayer | null>(null);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    let player: YTPlayer | null = null;
    let cancelled = false;
    const autoTimers: ReturnType<typeof setTimeout>[] = [];
    setMuted(false);
    const autostart = (attempt: number) => {
      if (cancelled || !player) return;
      let state: number | undefined;
      try {
        state = player.getPlayerState();
      } catch {
        state = undefined;
      }
      const step = nextAutostartStep(state, attempt);
      if (step === "none") return;
      try {
        if (step === "play-muted") {
          player.mute();
          setMuted(true);
        }
        player.playVideo();
      } catch {
        return;
      }
      autoTimers.push(setTimeout(() => autostart(attempt + 1), AUTOSTART_RETRY_MS));
    };
    // If YouTube can't be reached (offline venue, blocked network), say so instead of a black screen.
    const timer = setTimeout(() => !player && !cancelled && handlers.current.onError(-1), 15000);
    loadApi()
      .catch(() => {
        if (!cancelled) handlers.current.onError(-1);
        return null;
      })
      .then((YT) => {
        if (!YT || cancelled || !host.current) return;
        const el = document.createElement("div");
        host.current.replaceChildren(el);
        player = new YT.Player(el, {
          videoId,
          host: "https://www.youtube-nocookie.com",
          playerVars: { autoplay: 1, playsinline: 1, rel: 0, modestbranding: 1 },
          events: {
            onReady: () => {
              playerRef.current = player;
              autoTimers.push(setTimeout(() => autostart(0), AUTOSTART_DELAY_MS));
            },
            onStateChange: (e) => e.data === ENDED && handlers.current.onEnded(),
            onError: (e) => handlers.current.onError(e.data),
          },
        });
      });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      autoTimers.forEach(clearTimeout);
      playerRef.current = null;
      player?.destroy();
    };
  }, [videoId]);

  const unmute = () => {
    try {
      playerRef.current?.unMute();
      playerRef.current?.playVideo();
    } catch {
      /* player gone */
    }
    setMuted(false);
  };

  return (
    <div className="video-wrap">
      <div ref={host} className="video-host" />
      {muted && (
        <button type="button" className="btn unmute-btn" onClick={unmute}>
          🔊 แตะเพื่อเปิดเสียง
        </button>
      )}
    </div>
  );
}
