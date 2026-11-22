import type { Metadata } from "next";
import Link from "next/link";
import { CLASSES_CTA } from "@/components/seo/MarketingShell";
import { ogBase } from "@/lib/seo/og";
import { filmMatin as film, jsonLdFilmMatin } from "@/lib/seo/video-matin";

export const metadata: Metadata = {
  title: { absolute: film.titre + " — Démo du logiciel agricole" },
  description: film.description,
  alternates: { canonical: film.canonical },
  openGraph: {
    ...ogBase,
    type: "video.other",
    url: film.canonical,
    title: film.titre,
    description: film.description,
    images: [{ url: film.imageUrl, width: 1200, height: 630, alt: film.titre }],
    videos: [{ url: film.contentUrl, type: "video/mp4", width: 1920, height: 1080 }],
  },
  twitter: { card: "summary_large_image", title: film.titre, description: film.description, images: [film.imageUrl] },
};

export default function VideoMatinPage() {
  return (
    <article className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:py-14">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLdFilmMatin) }} />
      <h1 className="font-heading text-3xl font-semibold tracking-tight text-encre sm:text-5xl">{film.titre}</h1>
      <p className="mb-5 mt-3 text-ardoise">Démonstration · {film.secondes} secondes · Sous-titres français</p>
      <video
        aria-label={film.titre}
        controls
        playsInline
        preload="none"
        width={1920}
        height={1080}
        poster={film.affiche}
        className="block aspect-video w-full rounded-xl bg-encre focus-visible:outline-sauge"
      >
        <source src={film.fichier} type="video/mp4" />
        <track kind="captions" src={film.sousTitres} srcLang="fr" label="Français" />
        <a href={film.fichier}>Télécharger la vidéo</a>
      </video>
      <p className="mt-5 max-w-3xl text-lg leading-relaxed text-ardoise">{film.description}</p>
      <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3">
        <Link href="/login?demo=1" className={CLASSES_CTA}>Essayer la démo</Link>
        <a href={film.youtube} className="font-semibold text-sauge underline underline-offset-4">Voir sur YouTube</a>
      </div>
      <details id="transcription" className="mt-8 max-w-3xl border-t border-lin pt-4">
        <summary className="cursor-pointer font-semibold text-encre">Transcription de la vidéo</summary>
        <div className="mt-4 space-y-3 leading-relaxed text-ardoise">
          <p>Ce matin, les œufs à ramasser et les carottes pour le marché. Avant de sortir, je demande à l’assistant : est-ce le moment de semer mes fèves ? Avec les gelées annoncées, il me conseille d’attendre, et de vérifier que la terre ne colle plus.</p>
          <p>En attendant, mes carottes sont prêtes. Je retrouve la planche B10 sur le plan. De retour du jardin, je clique sur « Récolter ». Huit kilos de carottes. Je note le poids et je valide. Mes huit kilos sont déjà en stock.</p>
          <p>J’en garde cinq pour le marché. Les trois autres, je les mets en vente dans ma boutique en ligne. Et voilà mes carottes côté client. Un kilo dans le panier. À toi d’essayer la démo.</p>
        </div>
      </details>
    </article>
  );
}
