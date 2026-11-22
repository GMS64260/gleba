"use client";

import Image from "next/image";
import { useState } from "react";
import { filmMatin } from "@/lib/seo/video-matin";

export function FilmMatinYouTube() {
  const [lecture, setLecture] = useState(false);

  if (lecture) {
    return (
      <iframe
        ref={(lecteur) => lecteur?.focus()}
        title={filmMatin.titre + " sur YouTube"}
        src={filmMatin.lecteurYouTube + "?autoplay=1&playsinline=1"}
        className="block aspect-video w-full rounded-xl bg-encre"
        allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
      />
    );
  }

  return (
    <a
      href={filmMatin.youtube}
      aria-label={`Lire « ${filmMatin.titre} » avec YouTube`}
      onClick={(event) => {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        setLecture(true);
      }}
      className="group relative block aspect-video overflow-hidden rounded-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sauge"
    >
      <Image src={filmMatin.affiche} width={1280} height={720} alt="" unoptimized className="block h-auto w-full" />
      <span className="absolute bottom-[17%] left-[6%] inline-flex min-h-9 items-center gap-2 rounded-lg bg-foret px-3 text-sm font-semibold text-white group-hover:bg-encre sm:min-h-11 sm:px-4">
        <span aria-hidden="true">▶</span> Lire avec YouTube
      </span>
    </a>
  );
}
