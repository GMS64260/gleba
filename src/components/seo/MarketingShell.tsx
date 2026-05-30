import Link from "next/link";
import Image from "next/image";
import { Github, Megaphone, Shield } from "lucide-react";

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
  return (
    <nav className="w-full px-6 md:px-8 py-5 flex items-center justify-between max-w-6xl mx-auto">
      <Link href="/" aria-label="Accueil Gleba">
        <Image
          src="/gleba-logo.png"
          alt="Gleba"
          width={400}
          height={136}
          className="h-12 sm:h-16 w-auto"
          priority
        />
      </Link>
      <div className="flex items-center gap-5">
        <Link
          href="/communaute"
          className="hidden sm:flex items-center gap-1.5 text-sm text-slate-400 hover:text-violet-600 transition-colors"
        >
          <Megaphone className="h-4 w-4" />
          <span>Community Voice</span>
        </Link>
        <a
          href="https://github.com/GMS64260/gleba"
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-700 transition-colors"
        >
          <Github className="h-4 w-4" />
          <span>Source</span>
        </a>
        <Link
          href="/register"
          className="inline-flex items-center px-4 py-2 rounded-full bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium transition-colors shadow-sm"
        >
          Essayer Gleba
        </Link>
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
          <span className="text-slate-300">v1.0.0</span>
        </div>
        <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          <Link href="/logiciel-maraichage" className="hover:text-emerald-600 transition-colors">
            Maraîchage
          </Link>
          <Link href="/logiciel-verger" className="hover:text-emerald-600 transition-colors">
            Verger
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
