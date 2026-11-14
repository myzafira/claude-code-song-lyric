"use client";

import { useEffect, useState } from "react";
import type { Banner } from "@/lib/notion.ts";

/** A slim row of links to our other web apps. Hidden while singing so it never gets in the way. */
export default function Banners() {
  const [banners, setBanners] = useState<Banner[]>([]);
  useEffect(() => {
    fetch("/api/banners")
      .then((r) => r.json())
      .then((d) => setBanners(Array.isArray(d.banners) ? d.banners : []))
      .catch(() => {});
  }, []);
  if (!banners.length) return null;
  return (
    <nav className="banners" aria-label="web app อื่นๆ ของเรา">
      {banners.map((b) => (
        <a key={b.id} className="banner" href={b.link} target="_blank" rel="noopener">
          {b.image ? <img src={b.image} alt="" /> : <span className="banner-icon" aria-hidden>✨</span>}
          <span className="banner-text">
            <b>{b.title}</b>
            {b.subtitle && <small>{b.subtitle}</small>}
          </span>
          <span className="banner-go" aria-hidden>↗</span>
        </a>
      ))}
    </nav>
  );
}
