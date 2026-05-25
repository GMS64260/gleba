import Link from "next/link";
import { ArrowRight, Github } from "lucide-react";

type Props = {
  title: string;
  subtitle?: string;
  primaryLabel?: string;
  primaryHref?: string;
};

export function CTASection({
  title,
  subtitle,
  primaryLabel = "Essayer Gleba gratuitement",
  primaryHref = "/register",
}: Props) {
  return (
    <section className="py-24 px-4">
      <div className="max-w-4xl mx-auto rounded-3xl bg-gradient-to-br from-emerald-900 via-emerald-900 to-teal-900 px-8 py-16 sm:px-16 sm:py-20 text-center relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage:
              "radial-gradient(circle, white 1px, transparent 1px)",
            backgroundSize: "20px 20px",
          }}
        />
        <div className="relative z-10">
          <h2 className="font-heading text-3xl sm:text-4xl lg:text-5xl font-extralight text-white tracking-tight">
            {title}
          </h2>
          {subtitle && (
            <p className="mt-6 text-base sm:text-lg text-emerald-100/70 font-light max-w-2xl mx-auto leading-relaxed">
              {subtitle}
            </p>
          )}
          <div className="mt-10 flex flex-col sm:flex-row gap-3 sm:gap-4 items-center justify-center">
            <Link
              href={primaryHref}
              className="inline-flex items-center gap-2 px-7 py-3.5 rounded-full bg-white text-emerald-900 hover:bg-emerald-50 font-medium text-sm transition-colors shadow-lg shadow-emerald-950/20"
            >
              {primaryLabel}
              <ArrowRight className="h-4 w-4" />
            </Link>
            <a
              href="https://github.com/GMS64260/gleba"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3.5 rounded-full border border-emerald-700/60 text-emerald-100/90 hover:bg-emerald-800/40 font-medium text-sm transition-colors"
            >
              <Github className="h-4 w-4" />
              Voir le code source
            </a>
          </div>
          <p className="mt-6 text-xs text-emerald-300/60">
            Gratuit · Open source AGPL-3.0 · Auto-hébergeable
          </p>
        </div>
      </div>
    </section>
  );
}
