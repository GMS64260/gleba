import Link from "next/link";
import Image from "next/image";
import { BookOpen, Shield } from "lucide-react";

/**
 * Nav + footer partagés pour toutes les pages marketing / SEO.
 * Volontairement aligné avec le style de /login pour cohérence visuelle.
 */
export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-white via-emerald-50/20 to-white">
      <MarketingNav />
      <main>{children}</main>
      <MarketingFooter />
    </div>
  );
}

function MarketingNav() {
  const businessLinks = [
    ["/logiciel-maraichage", "Maraîchage"],
    ["/logiciel-potager", "Potager"],
    ["/logiciel-jardin", "Jardin"],
    ["/logiciel-arboriculture", "Arboriculture"],
    ["/logiciel-elevage", "Élevage"],
    ["/logiciel-permaculture", "Permaculture"],
    ["/calendrier-semis", "Calendrier semis"],
  ] as const;

  return (
    <nav aria-label="Navigation principale" className="w-full border-b border-slate-100 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-5 px-4 py-4 sm:px-6 lg:px-8">
        <Link href="/" aria-label="Accueil Gleba" className="shrink-0">
          <Image src="/gleba-logo.png" alt="Gleba" width={400} height={136} className="h-11 w-auto sm:h-14" priority />
        </Link>
        <div className="hidden items-center gap-1 lg:flex">
          {businessLinks.map(([href, label]) => (
            <Link key={href} href={href} className="rounded-full px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-emerald-50 hover:text-emerald-800">{label}</Link>
          ))}
        </div>
        <div className="flex shrink-0 items-center gap-3">
          <Link href="/referentiel" className="hidden items-center gap-1.5 text-sm font-medium text-slate-500 transition-colors hover:text-emerald-700 xl:flex"><BookOpen className="h-4 w-4" />Référentiel</Link>
          <Link href="/register" className="inline-flex items-center rounded-full bg-emerald-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition-colors hover:bg-emerald-800">Essayer Gleba</Link>
        </div>
      </div>
      <div className="border-t border-slate-100 px-3 py-2 lg:hidden">
        <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-1">
          {businessLinks.map(([href, label]) => (
            <Link key={href} href={href} className="whitespace-nowrap rounded-full px-3 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-emerald-50 hover:text-emerald-800">{label}</Link>
          ))}
        </div>
      </div>
    </nav>
  );
}

function MarketingFooter() {
  return (
    <footer className="py-10 px-4 border-t border-slate-100/80 mt-20">
      <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6 text-sm text-slate-400">
        <div className="flex items-center gap-3">
          <Image
            src="/gleba-logo.png"
            alt="Gleba"
            width={100}
            height={34}
            className="h-8 w-auto opacity-40"
          />
          <span className="text-slate-300">v1.1.0</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <Link href="/logiciel-maraichage" className="hover:text-emerald-600 transition-colors">
            Maraîchage
          </Link>
          <Link href="/logiciel-potager" className="hover:text-emerald-600 transition-colors">
            Potager
          </Link>
          <Link href="/logiciel-jardin" className="hover:text-emerald-600 transition-colors">
            Jardin
          </Link>
          <Link href="/logiciel-verger" className="hover:text-emerald-600 transition-colors">
            Arboriculture
          </Link>
          <Link href="/logiciel-elevage" className="hover:text-emerald-600 transition-colors">
            Élevage
          </Link>
          <Link href="/logiciel-permaculture" className="hover:text-emerald-600 transition-colors">
            Permaculture
          </Link>
          <Link href="/calendrier-semis" className="hover:text-emerald-600 transition-colors">
            Calendrier semis
          </Link>
          <Link href="/referentiel" className="hover:text-emerald-600 transition-colors">
            Référentiel
          </Link>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/mentions-legales" className="hover:text-slate-600 transition-colors">
            Mentions
          </Link>
          <Link href="/confidentialite" className="hover:text-slate-600 transition-colors">
            Confidentialité
          </Link>
          <span className="inline-flex items-center gap-1.5 text-xs">
            <Shield className="h-3 w-3" /> AGPL-3.0
          </span>
        </div>
      </div>
    </footer>
  );
}
