import Link from "next/link";
import {
  Sprout,
  Layers,
  TreeDeciduous,
  Egg,
  Calendar,
  Home,
  Milestone,
  Bot,
  RefreshCw,
  ListChecks,
  Carrot,
  PawPrint,
  Dog,
  Rabbit,
  type LucideIcon,
} from "lucide-react";

type Page = { href: string; label: string; icon: LucideIcon };

const CORE_PAGES: Page[] = [
  { href: "/logiciel-micro-ferme", label: "Logiciel pour micro-ferme", icon: Home },
  { href: "/logiciel-maraichage", label: "Logiciel de maraîchage", icon: Sprout },
  { href: "/logiciel-verger", label: "Logiciel de verger", icon: TreeDeciduous },
  { href: "/logiciel-elevage", label: "Ateliers d'élevage", icon: Egg },
];

const MARAICHAGE_PAGES: Page[] = [
  { href: "/planification-maraichage", label: "Planification maraîchère", icon: Calendar },
  { href: "/rotation-cultures-maraichage", label: "Rotations de cultures", icon: RefreshCw },
  { href: "/itineraire-technique-maraichage", label: "Itinéraires techniques", icon: ListChecks },
  { href: "/calendrier-semis", label: "Calendrier de semis", icon: Calendar },
  { href: "/logiciel-potager", label: "Plan de potager", icon: Carrot },
  { href: "/logiciel-permaculture", label: "Ferme en permaculture", icon: Layers },
];

const VERGER_PAGES: Page[] = [
  { href: "/logiciel-arboriculture", label: "Logiciel d'arboriculture", icon: TreeDeciduous },
];

const ELEVAGE_PAGES: Page[] = [
  { href: "/logiciel-elevage-volailles", label: "Gestion d'élevage de volailles", icon: Egg },
  { href: "/logiciel-elevage-ovin", label: "Gestion d'élevage ovin", icon: Egg },
  { href: "/logiciel-elevage-caprin", label: "Gestion d'élevage caprin", icon: Egg },
  { href: "/logiciel-elevage-canin-felin", label: "Élevage canin et félin", icon: Dog },
  { href: "/logiciel-elevage-equin", label: "Gestion d'élevage équin", icon: PawPrint },
  { href: "/logiciel-elevage-nac", label: "Gestion d'élevage NAC", icon: Rabbit },
];

const DISCOVERY_PAGES: Page[] = [
  { href: "/assistant-ia-agricole", label: "Assistant IA agricole", icon: Bot },
  { href: "/referentiel", label: "Référentiel agricole public", icon: Sprout },
  { href: "/communaute", label: "Feuille de route publique", icon: Milestone },
];

function contextualPages(currentPath: string): Page[] {
  if (currentPath.includes("elevage")) return ELEVAGE_PAGES;
  if (currentPath.includes("verger") || currentPath.includes("arboriculture")) return VERGER_PAGES;
  if (
    currentPath.includes("maraichage") ||
    currentPath.includes("cultures") ||
    currentPath.includes("semis") ||
    currentPath.includes("potager") ||
    currentPath.includes("permaculture")
  ) {
    return MARAICHAGE_PAGES;
  }
  return [MARAICHAGE_PAGES[0], VERGER_PAGES[0]];
}

/**
 * Maillage hiérarchisé : les quatre pages de positionnement restent présentes,
 * puis seules les pages du même métier complètent le parcours. Cela évite de
 * diluer chaque intention dans une liste exhaustive de toutes les verticales.
 */
export function InternalLinks({ currentPath }: { currentPath: string }) {
  const uniquePages = new Map<string, Page>();
  for (const page of [...CORE_PAGES, ...contextualPages(currentPath), ...DISCOVERY_PAGES]) {
    if (page.href !== currentPath) uniquePages.set(page.href, page);
  }
  const pages = Array.from(uniquePages.values());

  return (
    <section className="border-t border-lin bg-craie px-4 py-16 sm:px-6">
      <nav aria-labelledby="titre-parcours" className="mx-auto max-w-6xl">
        <h2 id="titre-parcours" className="font-display text-[26px] font-medium tracking-tight text-encre sm:text-[30px]">
          Explorer les parcours de la micro-ferme
        </h2>
        <ul className="mt-8 grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
          {pages.map(({ href, label, icon: Icon }) => (
            <li key={href} className="border-t border-lin">
              <Link
                href={href}
                className="flex min-h-12 items-center gap-3 py-3 text-[15px] font-medium text-encre transition-colors duration-fast hover:text-foret hover:underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sauge"
              >
                <Icon className="h-5 w-5 shrink-0 text-sauge" aria-hidden />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}
