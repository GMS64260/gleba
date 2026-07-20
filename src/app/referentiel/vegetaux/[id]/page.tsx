import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Droplets, Leaf, MapPin, Ruler, Sprout, TreeDeciduous } from "lucide-react";

import { MarketingShell } from "@/components/seo/MarketingShell";
import { PhotoContributionForm } from "@/components/referentiel/PhotoContributionForm";
import prisma from "@/lib/prisma";
import { ZONE_CLIMAT_LABEL, type ZoneClimat } from "@/lib/terroir";
import { nomPublic, originePublique, visibiliteEnfantPublic, visibiliteReferentielPublic } from "@/lib/referentiel-public";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

async function getEspece(id: string) {
  return prisma.espece.findFirst({
    where: { AND: [{ id }, visibiliteReferentielPublic] },
    select: {
      id: true, nom: true, nomLatin: true, type: true, description: true, userId: true,
      vivace: true, besoinEau: true, besoinFroid: true, zonesAdaptees: true,
      densite: true, temperatureGerm: true, joursLevee: true, irrigation: true,
      famille: { select: { id: true, nomFr: true } },
      varietes: {
        where: visibiliteEnfantPublic(),
        select: { id: true, nom: true, userId: true, bio: true, semaineRecolte: true, groupePollinisation: true, ploidie: true },
        orderBy: [{ nom: "asc" }, { id: "asc" }],
        take: 24,
      },
      itps: {
        where: visibiliteEnfantPublic(),
        select: { id: true, nom: true, userId: true, zoneClimat: true, typePlanche: true, modeDemarrage: true, semaineSemis: true, semainePlantation: true, semaineRecolte: true, dureeCulture: true, espacement: true, sourceReference: true },
        orderBy: [{ zoneClimat: "asc" }, { nom: "asc" }],
        take: 24,
      },
      medias: {
        where: { statut: "VALIDE" },
        select: { id: true, url: true, miniatureUrl: true, urlOrigine: true, auteur: true, licence: true, urlLicence: true, citation: true, organe: true, description: true, principale: true },
        orderBy: [{ principale: "desc" }, { createdAt: "asc" }],
        take: 12,
      },
    },
  });
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const espece = await getEspece(decodeURIComponent(id));
  if (!espece) return { title: "Végétal introuvable" };
  const name = nomPublic(espece);
  const description = espece.description || `Fiche agricole de ${name} : variétés, exigences et itinéraires techniques selon le terroir.`;
  const url = `https://gleba.fr/referentiel/vegetaux/${encodeURIComponent(espece.id)}`;
  return { title: `${name} — Variétés, culture et terroirs`, description, alternates: { canonical: url }, openGraph: { title: `${name} — Référentiel Gleba`, description, url, type: "article" } };
}

export default async function FicheVegetalPage({ params }: PageProps) {
  const { id } = await params;
  const espece = await getEspece(decodeURIComponent(id));
  if (!espece) notFound();
  const name = nomPublic(espece);
  const isTree = espece.type === "arbre_fruitier" || espece.type === "petit_fruit";
  const zones = espece.zonesAdaptees?.split(",").map((zone) => zone.trim()).filter(Boolean) ?? [];

  return (
    <MarketingShell>
      <article className="mx-auto max-w-6xl px-4 pb-12 pt-8 sm:px-6 sm:pt-12">
        <Link href="/referentiel" className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-900"><ArrowLeft className="h-4 w-4" /> Retour au référentiel</Link>
        <header className="mt-6 rounded-3xl border border-emerald-100 bg-gradient-to-br from-emerald-50 to-white p-6 sm:p-9">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-700 text-white">{isTree ? <TreeDeciduous className="h-8 w-8" /> : <Leaf className="h-8 w-8" />}</div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-emerald-800 shadow-sm">{originePublique(espece)}</span>{espece.vivace && <span className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-600 shadow-sm">Vivace</span>}</div>
              <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl">{name}</h1>
              {espece.nomLatin && <p className="mt-2 text-lg italic text-slate-500">{espece.nomLatin}</p>}
              {espece.description && <p className="mt-5 max-w-3xl text-base leading-7 text-slate-700">{espece.description}</p>}
            </div>
          </div>
        </header>

        <section className="mt-8">
          <h2 className="text-2xl font-bold text-slate-900">Images documentaires</h2>
          {espece.medias.length ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {espece.medias.map((media) => <figure key={media.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="relative aspect-[4/3] bg-slate-100"><Image src={media.url} alt={`${name} — ${media.organe}`} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover" /></div><figcaption className="p-4 text-xs leading-5 text-slate-600"><div className="font-medium text-slate-800">{media.organe}{media.description ? ` — ${media.description}` : ""}</div><div className="mt-1">{media.citation}</div><div className="mt-1 flex flex-wrap gap-3"><a href={media.urlLicence} target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline">{media.licence}</a>{media.urlOrigine && <a href={media.urlOrigine} target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline">Voir l’original</a>}</div></figcaption></figure>)}
            </div>
          ) : <Empty>Aucune image validée pour le moment. Vous pouvez proposer votre propre photo.</Empty>}
          <PhotoContributionForm especeId={espece.id} nom={name} />
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact icon={Sprout} label="Famille" value={espece.famille?.nomFr || espece.famille?.id || "À documenter"} />
          <Fact icon={Droplets} label="Besoin en eau" value={espece.besoinEau ? `${espece.besoinEau}/5` : espece.irrigation || "À documenter"} />
          <Fact icon={Ruler} label="Densité indicative" value={espece.densite ? `${espece.densite} plants/m²` : "À documenter"} />
          <Fact icon={CalendarDays} label="Levée" value={espece.joursLevee ? `${espece.joursLevee} jours` : espece.temperatureGerm || "À documenter"} />
        </section>

        <section className="mt-10">
          <div className="flex items-center gap-3"><MapPin className="h-6 w-6 text-emerald-700" /><div><h2 className="text-2xl font-bold text-slate-900">Enveloppe climatique</h2><p className="text-sm text-slate-500">Repères généraux à affiner avec le sol et le microclimat de chaque parcelle.</p></div></div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap gap-2">{zones.length ? zones.map((zone) => <span key={zone} className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm text-emerald-800">{zoneLabel(zone)}</span>) : <span className="text-sm text-slate-500">Zones adaptées encore non documentées.</span>}</div>
            {espece.besoinFroid && <p className="mt-4 text-sm text-slate-600">Besoin de froid : <strong>{espece.besoinFroid}</strong></p>}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold text-slate-900">Itinéraires techniques par contexte</h2>
          <p className="mt-1 text-sm text-slate-500">Ces calendriers sont des références contextualisées, pas des garanties de réussite.</p>
          {espece.itps.length ? <div className="mt-4 grid gap-4 md:grid-cols-2">{espece.itps.map((itp) => <div key={itp.id} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-2"><h3 className="font-semibold text-slate-900">{nomPublic(itp)}</h3><span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{itp.zoneClimat ? zoneLabel(itp.zoneClimat) : "Référence générale"}</span></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><MiniFact label="Conduite" value={itp.typePlanche || "Non précisée"} /><MiniFact label="Démarrage" value={itp.modeDemarrage || "Non précisé"} /><MiniFact label="Semis" value={week(itp.semaineSemis)} /><MiniFact label="Plantation" value={week(itp.semainePlantation)} /><MiniFact label="Récolte" value={week(itp.semaineRecolte)} /><MiniFact label="Cycle" value={itp.dureeCulture ? `${itp.dureeCulture} jours` : "Non précisé"} /></dl>{itp.sourceReference && <p className="mt-4 border-t border-slate-100 pt-3 text-xs text-slate-500">Source déclarée : {itp.sourceReference}</p>}</div>)}</div> : <Empty>Les itinéraires contextualisés de ce végétal restent à documenter.</Empty>}
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold text-slate-900">Variétés</h2>
          {espece.varietes.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{espece.varietes.map((variete) => <div key={variete.id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-2"><h3 className="font-medium text-slate-900">{nomPublic(variete)}</h3><span className="text-xs text-slate-400">{originePublique(variete)}</span></div>{(variete.groupePollinisation || variete.ploidie) && <p className="mt-2 text-xs text-slate-500">{[variete.groupePollinisation && `Floraison ${variete.groupePollinisation}`, variete.ploidie].filter(Boolean).join(" · ")}</p>}</div>)}</div> : <Empty>Aucune variété publique n’est encore rattachée à cette fiche.</Empty>}
        </section>

        <aside className="mt-12 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-6 text-amber-950"><strong>Repères à vérifier localement.</strong> Les informations affichées proviennent du catalogue Gleba et des contributions explicitement partagées. Une source n’est affichée que lorsqu’elle est effectivement renseignée sur l’itinéraire technique.</aside>
      </article>
    </MarketingShell>
  );
}

function zoneLabel(zone: string) { return ZONE_CLIMAT_LABEL[zone as ZoneClimat] || zone.replaceAll("_", " "); }
function week(value: number | null) { return value ? `Semaine ${value}` : "Non précisé"; }
function Fact({ icon: Icon, label, value }: { icon: typeof Leaf; label: string; value: string }) { return <div className="rounded-2xl border border-slate-200 bg-white p-4"><Icon className="h-5 w-5 text-emerald-700" /><div className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div><div className="mt-1 font-medium text-slate-800">{value}</div></div>; }
function MiniFact({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs text-slate-400">{label}</dt><dd className="mt-0.5 text-slate-700">{value}</dd></div>; }
function Empty({ children }: { children: React.ReactNode }) { return <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">{children}</div>; }
