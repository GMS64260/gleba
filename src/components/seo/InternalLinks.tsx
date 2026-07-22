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
  type LucideIcon,
} from "lucide-react";

type Page = { href: string; label: string; icon: LucideIcon };

const ALL_PAGES: Page[] = [
  { href: "/logiciel-maraichage", label: "Logiciel de maraîchage", icon: Sprout },
  { href: "/planification-maraichage", label: "Planification maraîchère", icon: Calendar },
  { href: "/rotation-cultures-maraichage", label: "Rotations de cultures", icon: RefreshCw },
  { href: "/itineraire-technique-maraichage", label: "Itinéraires techniques", icon: ListChecks },
  { href: "/logiciel-potager", label: "Logiciel de potager", icon: Carrot },
  { href: "/logiciel-micro-ferme", label: "Logiciel pour micro-ferme", icon: Home },
  { href: "/logiciel-permaculture", label: "Logiciel de permaculture", icon: Layers },
  { href: "/logiciel-verger", label: "Logiciel de verger", icon: TreeDeciduous },
  { href: "/logiciel-arboriculture", label: "Logiciel d'arboriculture", icon: TreeDeciduous },
  { href: "/logiciel-elevage", label: "Logiciel d'élevage", icon: Egg },
  { href: "/logiciel-elevage-volailles", label: "Gestion d'élevage de volailles", icon: Egg },
  { href: "/logiciel-elevage-ovin", label: "Gestion d'élevage ovin", icon: Egg },
  { href: "/logiciel-elevage-caprin", label: "Gestion d'élevage caprin", icon: Egg },
  { href: "/calendrier-semis", label: "Calendrier de semis", icon: Calendar },
  { href: "/assistant-ia-agricole", label: "Assistant IA agricole", icon: Bot },
  { href: "/referentiel", label: "Référentiel agricole public", icon: Sprout },
  { href: "/communaute", label: "Community Voice", icon: Milestone },
];

/**
 * Bloc de maillage interne entre les pages cibles SEO.
 * Exclut automatiquement la page courante. Toutes les pages sont affichées :
 * les pages filles doivent recevoir des liens depuis chaque page mère.
 */
export function InternalLinks({ currentPath }: { currentPath: string }) {
  const pages = ALL_PAGES.filter((p) => p.href !== currentPath);

  return (
    <section className="py-16 px-4 bg-white/60">
      <div className="max-w-4xl mx-auto">
        <h2 className="font-heading text-2xl sm:text-3xl font-extralight text-slate-900 tracking-tight text-center mb-10">
          Allez plus loin avec <span className="font-normal">Gleba</span>
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
