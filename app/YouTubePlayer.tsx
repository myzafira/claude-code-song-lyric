"use client";

import { useEffect, useRef } from "react";

/* Minimal typing for the YouTube IFrame Player API. */
type YTPlayer = { destroy: () => void };
type YTNamespace = {
  Player: new (
    el: HTMLElement,
    opts: {
      videoId: string;
      host?: string;
      playerVars?: Record<string, number | string>;
      events?: {
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

  useEffect(() => {
    let player: YTPlayer | null = null;
    let cancelled = false;
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
            onStateChange: (e) => e.data === ENDED && handlers.current.onEnded(),
            onError: (e) => handlers.current.onError(e.data),
          },
        });
      });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      player?.destroy();
    };
  }, [videoId]);

  return <div ref={host} className="video-host" />;
}
