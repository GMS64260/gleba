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
  { href: "/communaute", label: "Community Voice", icon: Milestone },
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
    <section className="py-16 px-4 bg-white/60">
      <div className="max-w-4xl mx-auto">
        <h2 className="font-heading text-2xl sm:text-3xl font-extralight text-slate-900 tracking-tight text-center mb-10">
          Explorez les parcours de la <span className="font-normal">micro-ferme</span>
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {pages.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className="flex items-center gap-3 p-4 rounded-xl border border-slate-100 bg-white hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors"
            >
              <Icon className="h-5 w-5 text-emerald-600" strokeWidth={1.5} />
              <span className="text-sm font-medium text-slate-700">{label}</span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
