import Image from "next/image";
import { Camera } from "lucide-react";

type Props = {
  /**
   * Chemin de l'image dans /public (ex: "/screenshots/maraichage-calendrier.png").
   * Si non fourni, un placeholder visuel s'affiche pour signaler "image à venir".
   */
  src?: string;
  alt: string;
  caption?: string;
  /** Ratio largeur/hauteur. Par défaut 16/9. Ex: "4/3", "1/1", "21/9". */
  aspectRatio?: string;
  /** Hauteur min en px (utile sur mobile). */
  minHeight?: number;
  className?: string;
  priority?: boolean;
};

/**
 * Bloc image / capture d'écran pour les pages SEO.
 *
 * Mode placeholder (src absent) : carré teal/emerald avec icône + texte
 * indiquant à Guillaume où ajouter une capture, avec le `alt` et le ratio attendus.
 *
 * Mode image : <Image> Next.js avec figcaption optionnelle.
 */
export function ScreenshotPlaceholder({
  src,
  alt,
  caption,
  aspectRatio = "16/9",
  minHeight = 240,
  className = "",
  priority = false,
}: Props) {
  return (
    <figure className={`my-10 ${className}`}>
      <div
        className="relative w-full overflow-hidden rounded-2xl border border-slate-200 bg-gradient-to-br from-emerald-50 via-white to-teal-50 shadow-sm"
        style={{ aspectRatio, minHeight: src ? undefined : minHeight }}
      >
        {src ? (
          <Image
            src={src}
            alt={alt}
            fill
            sizes="(max-width: 768px) 100vw, 900px"
            className="object-cover"
            priority={priority}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-white/80 border border-emerald-100 backdrop-blur-sm">
              <Camera className="h-5 w-5 text-emerald-600" strokeWidth={1.5} />
            </div>
            <p className="text-sm font-medium text-slate-700">
              Capture d&apos;écran à venir
            </p>
            <p className="text-xs text-slate-500 max-w-md">
              <span className="font-mono text-emerald-700">alt</span> attendu&nbsp;: « {alt} »
              <br />
              Ratio&nbsp;: <span className="font-mono">{aspectRatio}</span>
            </p>
          </div>
        )}
      </div>
      {caption && (
        <figcaption className="mt-3 text-center text-sm text-slate-500 italic">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
