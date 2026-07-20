import type { Metadata } from "next";
import Link from "next/link";
import { BookOpen, ChevronRight, Globe2, Leaf, MapPin, Search, Sprout, TreeDeciduous } from "lucide-react";

import { MarketingShell } from "@/components/seo/MarketingShell";
import prisma from "@/lib/prisma";
import { nomPublic, originePublique, visibiliteEnfantPublic, visibiliteReferentielPublic } from "@/lib/referentiel-public";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Référentiel agricole ouvert — Végétaux, variétés et itinéraires techniques",
  description: "Explorez le référentiel agricole contributif de Gleba : légumes, arbres fruitiers, variétés et itinéraires techniques contextualisés par climat et terroir.",
  alternates: { canonical: "https://gleba.fr/referentiel" },
  openGraph: {
    title: "Le référentiel agricole ouvert de Gleba",
    description: "Des connaissances agricoles structurées, sourcées et adaptées aux terroirs.",
    url: "https://gleba.fr/referentiel",
    type: "website",
  },
};

type PageProps = {
  searchParams: Promise<{ q?: string; type?: string }>;
};

const TYPES = [
  { value: "", label: "Tous" },
  { value: "legume", label: "Légumes" },
  { value: "aromatique", label: "Aromatiques" },
  { value: "engrais_vert", label: "Engrais verts" },
  { value: "arbre_fruitier", label: "Arbres fruitiers" },
  { value: "petit_fruit", label: "Petits fruits" },
] as const;

const TYPE_LABELS: Record<string, string> = Object.fromEntries(
  TYPES.filter((type) => type.value).map((type) => [type.value, type.label]),
);

export default async function ReferentielPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = params.q?.trim().slice(0, 80) ?? "";
  const type = TYPES.some((item) => item.value === params.type) ? params.type ?? "" : "";

  const where = {
    AND: [
      visibiliteReferentielPublic,
      type ? { type } : {},
      q
        ? {
            OR: [
              { nom: { contains: q, mode: "insensitive" as const } },
              { id: { contains: q, mode: "insensitive" as const } },
              { nomLatin: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {},
    ],
  };

  const [especes, total, catalogueTotal, varietes, itps] = await globalThis.Promise.all([
    prisma.espece.findMany({
      where,
      select: {
        id: true,
        nom: true,
        nomLatin: true,
        type: true,
        description: true,
        vivace: true,
        zonesAdaptees: true,
        userId: true,
        _count: {
          select: {
            varietes: { where: visibiliteEnfantPublic() },
            itps: { where: visibiliteEnfantPublic() },
          },
        },
      },
      orderBy: [{ type: "asc" }, { nom: "asc" }, { id: "asc" }],
      take: 120,
    }),
    prisma.espece.count({ where }),
    prisma.espece.count({ where: visibiliteReferentielPublic }),
    prisma.variete.count({ where: visibiliteEnfantPublic() }),
    prisma.iTP.count({ where: visibiliteEnfantPublic() }),
  ]);

  return (
    <MarketingShell>
      <section className="px-4 pb-10 pt-8 sm:px-6 sm:pt-14">
        <div className="mx-auto max-w-6xl">
          <div className="max-w-3xl">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-sm font-medium text-emerald-800">
              <BookOpen className="h-4 w-4" /> Encyclopédie agricole contributive
            </div>
            <h1 className="text-4xl font-bold tracking-tight text-slate-950 sm:text-6xl">
              Les végétaux et les pratiques, <span className="text-emerald-700">reliés à leur terroir</span>
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-600">
              Gleba ouvre progressivement son référentiel de cultures, variétés et itinéraires techniques. Une connaissance générale devient vraiment utile lorsqu’elle est replacée dans un climat, un sol et une pratique.
            </p>
          </div>

          <div className="mt-8 grid gap-3 sm:grid-cols-3">
            <Stat icon={Leaf} value={catalogueTotal} label="végétaux visibles" />
            <Stat icon={Sprout} value={varietes} label="variétés" />
            <Stat icon={MapPin} value={itps} label="itinéraires techniques" />
          </div>

          <form className="mt-10 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm" action="/referentiel">
            <div className="flex flex-col gap-3 md:flex-row">
              <label className="relative flex-1">
                <span className="sr-only">Rechercher un végétal</span>
                <Search className="pointer-events-none absolute left-3 top-3 h-5 w-5 text-slate-400" />
                <input
                  name="q"
                  defaultValue={q}
                  maxLength={80}
                  placeholder="Tomate, pommier, Malus domestica…"
                  className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-3 text-slate-900 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100"
                />
              </label>
              <select name="type" defaultValue={type} className="h-11 rounded-xl border border-slate-200 bg-white px-3 text-slate-700 outline-none focus:border-emerald-500">
                {TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}
              </select>
              <button className="h-11 rounded-xl bg-emerald-700 px-5 font-medium text-white transition hover:bg-emerald-800">Rechercher</button>
            </div>
          </form>

          <div className="mt-5 flex items-center justify-between gap-4">
            <p className="text-sm text-slate-500">{total} résultat{total > 1 ? "s" : ""}{total > especes.length ? ` · ${especes.length} affichés` : ""}</p>
            {(q || type) && <Link href="/referentiel" className="text-sm font-medium text-emerald-700 hover:text-emerald-900">Effacer les filtres</Link>}
          </div>

          {especes.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-slate-600">Aucun végétal public ne correspond à cette recherche.</div>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {especes.map((espece) => {
                const name = nomPublic(espece);
                const isTree = espece.type === "arbre_fruitier" || espece.type === "petit_fruit";
                const Icon = isTree ? TreeDeciduous : Leaf;
                return (
                  <Link key={espece.id} href={`/referentiel/vegetaux/${encodeURIComponent(espece.id)}`} className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700"><Icon className="h-5 w-5" /></div>
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${espece.userId === null ? "bg-emerald-50 text-emerald-700" : "bg-sky-50 text-sky-700"}`}>{originePublique(espece)}</span>
                    </div>
                    <h2 className="mt-4 text-xl font-semibold text-slate-900 group-hover:text-emerald-800">{name}</h2>
                    <p className="mt-1 min-h-5 text-sm italic text-slate-500">{espece.nomLatin || TYPE_LABELS[espece.type] || espece.type}</p>
                    <p className="mt-3 line-clamp-2 min-h-10 text-sm leading-5 text-slate-600">{espece.description || `${TYPE_LABELS[espece.type] || "Végétal"} du référentiel agricole Gleba.`}</p>
                    <div className="mt-4 flex items-center gap-3 border-t border-slate-100 pt-4 text-xs text-slate-500">
                      <span>{espece._count.varietes} variété{espece._count.varietes > 1 ? "s" : ""}</span>
                      <span>{espece._count.itps} ITP</span>
                      <ChevronRight className="ml-auto h-4 w-4 text-emerald-600 transition group-hover:translate-x-1" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          <div className="mt-12 grid gap-5 rounded-3xl bg-slate-950 p-6 text-white md:grid-cols-3 md:p-8">
            <KnowledgePromise icon={Globe2} title="Une base mondiale">Noms, synonymes et faits stables sont séparés des pratiques locales.</KnowledgePromise>
            <KnowledgePromise icon={MapPin} title="Des variantes de terroir">Climat, sol, exposition et système de culture contextualisent chaque ITP.</KnowledgePromise>
            <KnowledgePromise icon={BookOpen} title="Une connaissance traçable">Le référentiel évoluera avec sources, historique et contributions vérifiables.</KnowledgePromise>
          </div>
        </div>
      </section>
    </MarketingShell>
  );
}

function Stat({ icon: Icon, value, label }: { icon: typeof Leaf; value: number; label: string }) {
  return <div className="flex items-center gap-3 rounded-2xl border border-emerald-100 bg-white p-4"><div className="rounded-xl bg-emerald-50 p-2 text-emerald-700"><Icon className="h-5 w-5" /></div><div><div className="text-2xl font-bold text-slate-900">{value}</div><div className="text-sm text-slate-500">{label}</div></div></div>;
}

function KnowledgePromise({ icon: Icon, title, children }: { icon: typeof Leaf; title: string; children: React.ReactNode }) {
  return <div><Icon className="h-6 w-6 text-emerald-400" /><h2 className="mt-3 font-semibold">{title}</h2><p className="mt-1 text-sm leading-6 text-slate-300">{children}</p></div>;
}
