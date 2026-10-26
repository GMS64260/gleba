import Link from "next/link";
import Image from "next/image";
import { GithubLogo } from "@/lib/phosphor-icons";

/**
 * Navigation et pied de page partagés par l'accueil public et les pages
 * métier, dans la charte « carnet de ferme » (papier, craie, encre, sauge,
 * Fraunces pour la marque). Le pied de page porte le maillage complet des
 * pages publiques : chaque page indexable reste à un clic de toutes les autres.
 */
export function MarketingShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-papier text-encre">
      <a
        href="#contenu"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-craie focus:px-4 focus:py-3 focus:text-sm focus:font-semibold focus:text-encre focus:outline focus:outline-2 focus:outline-sauge"
      >
        Aller au contenu
      </a>
      <MarketingNav />
      <main id="contenu">{children}</main>
      <MarketingFooter />
    </div>
  );
}

const METIERS = [
  ["/logiciel-maraichage", "Maraîchage"],
  ["/logiciel-verger", "Verger"],
  ["/logiciel-elevage", "Élevage"],
  ["/logiciel-micro-ferme", "Micro-ferme"],
] as const;

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sauge";

export const CLASSES_CTA = `inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-sauge bg-sauge px-5 text-sm font-semibold text-craie transition-colors duration-fast hover:border-foret hover:bg-foret ${FOCUS}`;
export const CLASSES_CTA_SECONDAIRE = `inline-flex min-h-11 items-center justify-center gap-2 whitespace-nowrap rounded-lg border border-lin bg-craie px-5 text-sm font-semibold text-encre transition-colors duration-fast hover:border-sauge hover:bg-sauge-doux ${FOCUS}`;

export function Marque({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 font-display text-[26px] font-semibold leading-none tracking-tight text-foret ${className}`}>
      <Image src="/icon-192.png" alt="" width={32} height={32} className="h-8 w-8 rounded-md" />
      Gleba
    </span>
  );
}

function MarketingNav() {
  return (
    <header className="border-b border-lin bg-craie px-4 sm:px-6">
      <nav aria-label="Navigation principale" className="mx-auto flex max-w-6xl items-center justify-between gap-4 py-3">
        <Link href="/" aria-label="Gleba, accueil" className={`shrink-0 rounded-md ${FOCUS}`}>
          <Marque />
        </Link>
        <ul className="hidden items-center gap-1 lg:flex">
          {METIERS.map(([href, label]) => (
            <li key={href}>
              <Link href={href} className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-encre transition-colors duration-fast hover:bg-sauge-doux hover:text-foret ${FOCUS}`}>
                {label}
              </Link>
            </li>
          ))}
          <li>
            <Link href="/referentiel" className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-encre transition-colors duration-fast hover:bg-sauge-doux hover:text-foret ${FOCUS}`}>
              Référentiel
            </Link>
          </li>
        </ul>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Link href="/login" className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold text-encre transition-colors duration-fast hover:text-foret ${FOCUS}`}>
            Se connecter
          </Link>
          <Link href="/register" className={`${CLASSES_CTA} hidden px-4 sm:inline-flex`}>
            Créer mon carnet
          </Link>
        </div>
      </nav>
      <div className="-mx-4 border-t border-lin-doux sm:-mx-6 lg:hidden">
        <ul aria-label="Parcours métier" className="mx-auto flex max-w-2xl flex-wrap items-center justify-center gap-x-1 px-2 py-1">
          {METIERS.map(([href, label]) => (
            <li key={href}>
              <Link href={href} className={`inline-flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-encre hover:bg-sauge-doux ${FOCUS}`}>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}

const COLONNES: { titre: string; liens: [string, string][] }[] = [
  {
    titre: "Logiciels",
    liens: [
      ["/logiciel-micro-ferme", "Logiciel pour micro-ferme"],
      ["/logiciel-maraichage", "Logiciel de maraîchage"],
      ["/logiciel-verger", "Logiciel de verger"],
      ["/logiciel-arboriculture", "Logiciel d'arboriculture"],
      ["/logiciel-potager", "Plan de potager 2D et 3D"],
      ["/plan-de-ferme", "Plan de ferme sur le cadastre"],
      ["/logiciel-permaculture", "Ferme en permaculture"],
    ],
  },
  {
    titre: "Maraîchage",
    liens: [
      ["/planification-maraichage", "Planification maraîchère"],
      ["/rotation-cultures-maraichage", "Rotation des cultures"],
      ["/itineraire-technique-maraichage", "Itinéraires techniques"],
      ["/calendrier-semis", "Calendrier de semis"],
      ["/carnet-de-culture", "Carnet de culture"],
      ["/registre-phytosanitaire", "Registre phytosanitaire"],
      ["/assistant-ia-agricole", "Assistant IA agricole"],
    ],
  },
  {
    titre: "Élevage",
    liens: [
      ["/logiciel-elevage", "Ateliers d'élevage"],
      ["/logiciel-elevage-volailles", "Volailles"],
      ["/logiciel-elevage-ovin", "Ovins"],
      ["/logiciel-elevage-caprin", "Caprins"],
      ["/logiciel-elevage-equin", "Équins"],
      ["/logiciel-elevage-canin-felin", "Canins et félins"],
      ["/logiciel-elevage-nac", "NAC"],
    ],
  },
  {
    titre: "Ressources",
    liens: [
      ["/comparatif-logiciels-maraichage", "Comparatif des logiciels de maraîchage"],
      ["/registre-phytosanitaire-numerique", "Registre phyto numérique 2027"],
      ["/referentiel", "Référentiel agricole ouvert"],
      ["/glossaire", "Glossaire agricole"],
      ["/communaute?tab=roadmap", "Feuille de route publique"],
      ["/licence", "Licence AGPL-3.0"],
      ["/login?demo=1", "Ferme de démonstration"],
    ],
  },
];

function MarketingFooter() {
  return (
    <footer className="border-t border-lin bg-craie px-4 sm:px-6">
      <div className="mx-auto max-w-6xl py-14">
        <div className="grid gap-10 lg:grid-cols-[1.2fr_repeat(4,1fr)]">
          <div className="max-w-xs">
            <Marque />
            <p className="mt-4 text-sm leading-relaxed text-ardoise">
              Le carnet d&apos;exploitation libre des micro-fermes diversifiées : maraîchage, verger,
              élevage, traçabilité et gestion dans un même dossier.
            </p>
            <div className="mt-5 flex flex-col items-start gap-1 text-sm">
              <a href="mailto:contact@gleba.fr" className={`inline-flex min-h-11 items-center font-semibold text-sauge hover:underline ${FOCUS}`}>
                contact@gleba.fr
              </a>
              <a
                href="https://github.com/GMS64260/gleba"
                rel="noopener"
                className={`inline-flex min-h-11 items-center gap-2 text-encre hover:text-foret ${FOCUS}`}
              >
                <GithubLogo className="h-4 w-4" weight="regular" aria-hidden />
                Code source sur GitHub
              </a>
            </div>
          </div>
          {COLONNES.map((col) => (
            <div key={col.titre}>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-ardoise">{col.titre}</p>
              <ul className="mt-3 space-y-0.5">
                {col.liens.map(([href, label]) => (
                  <li key={href}>
                    <Link href={href} className={`inline-flex min-h-9 items-center text-sm text-encre transition-colors duration-fast hover:text-foret hover:underline ${FOCUS}`}>
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-12 flex flex-col gap-3 border-t border-lin pt-6 text-xs text-ardoise sm:flex-row sm:items-center sm:justify-between">
          <p>Logiciel libre sous licence AGPL-3.0 · Hébergement gratuit pendant la bêta</p>
          <ul className="flex flex-wrap gap-x-5 gap-y-1">
            <li><Link href="/mentions-legales" className={`inline-flex min-h-9 items-center hover:text-encre ${FOCUS}`}>Mentions légales</Link></li>
            <li><Link href="/confidentialite" className={`inline-flex min-h-9 items-center hover:text-encre ${FOCUS}`}>Confidentialité</Link></li>
            <li><Link href="/cgv" className={`inline-flex min-h-9 items-center hover:text-encre ${FOCUS}`}>CGV</Link></li>
          </ul>
        </div>
      </div>
    </footer>
  );
}
