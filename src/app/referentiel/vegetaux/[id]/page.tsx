import type { Metadata } from "next";
import { Suspense } from "react";
import { estTypeVerger } from "@/lib/validations/espece";
import { libellePeriodeSemaines } from "@/lib/semaines-lisibles";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, CalendarDays, Droplets, Leaf, MapPin, Ruler, Sprout, TreeDeciduous } from "lucide-react";

import { MarketingShell } from "@/components/seo/MarketingShell";
import { PhotoContributionForm } from "@/components/referentiel/PhotoContributionForm";
import { FicheCommunaute } from "@/components/encyclopedie/FicheCommunaute";
import { ReferenceSource } from "@/components/encyclopedie/ReferenceSource";
import { ErreurEncyclopedie, lireCommunauteVegetal } from "@/lib/encyclopedie/service";
import type { CommunauteVegetalVue } from "@/lib/encyclopedie/types";
import prisma from "@/lib/prisma";
import { ZONE_CLIMAT_LABEL, type ZoneClimat } from "@/lib/terroir";
import { nomPublic, originePublique, visibiliteEnfantPublic, visibiliteReferentielPublic } from "@/lib/referentiel-public";
import { nomAffichableItp } from "@/lib/itp-label";
import { dureeCycleItpJours } from "@/lib/cultures/dates-itp";
import { ogBase } from "@/lib/seo/og";
import { valeurRenseignee } from "@/lib/referentiel-valeur";

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
        select: { id: true, nom: true, userId: true, bio: true, semaineRecolte: true, dureeRecolte: true, semaineFloraison: true, dureeFloraison: true, groupePollinisation: true, ploidie: true },
        orderBy: [{ nom: "asc" }, { id: "asc" }],
        take: 24,
      },
      // Compte réel des itinéraires publiables, pour pouvoir annoncer ce que la
      // liste ne montre pas : elle est bornée à 24, sans un mot, sous une carte
      // de /referentiel qui en annonce 115 pour le mesclun. Un visiteur voyait
      // 24 encadrés tous « Mesclun asiatique-moutarde » et aucun des 91 autres.
      _count: {
        select: {
          itps: { where: { AND: [{ actif: true }, visibiliteEnfantPublic()] } },
        },
      },
      itps: {
        // `actif: false` = scénario dont les semaines publiées sortent de
        // l'intervalle ISO 1–52, conservé pour audit. Il n'était filtré que dans
        // `GET /api/itps` : la page publique le référençait, libellé « source »
        // compris, avec des semaines que la base a ramenées dans 1–52 — donc un
        // titre qui contredit ses propres valeurs.
        where: { AND: [{ actif: true }, visibiliteEnfantPublic()] },
        select: { id: true, nom: true, userId: true, zoneClimat: true, typePlanche: true, modeDemarrage: true, semaineSemis: true, semainePlantation: true, semaineRecolte: true, semaineImplantationDebut: true, dureeCulture: true, delaiPremiereRecolteAnnees: true, statutValidation: true, espacement: true, sourceReference: true, sourceUrl: true, sourceLicence: true, sourceVersion: true },
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
  const description = valeurRenseignee(espece.description) || `Fiche agricole de ${name} : variétés, exigences et itinéraires techniques selon le terroir.`;
  const url = `https://gleba.fr/referentiel/vegetaux/${encodeURIComponent(espece.id)}`;
  return { title: `${name} — Variétés, culture et terroirs`, description, alternates: { canonical: url }, openGraph: { ...ogBase, title: `${name} — Référentiel Gleba`, description, url, type: "article" } };
}

/**
 * Qualité de la référence, dite au visiteur.
 *
 * La page publiait côte à côte les scénarios sourcés (INRAE, DOI) et les 122
 * entrées historiques dont 80 sont une grille arithmétique (+4 / +8 semaines,
 * durée de culture uniformément à 84 jours) : neuf cartes de poireau dont
 * quatre annoncent une récolte mi-mai. Le statut existait déjà en base
 * (« a_revoir » sur les 122) mais n'était ni sélectionné ni affiché : rien ne
 * distinguait une référence documentée d'un repère à confirmer.
 */
function QualiteBadge({ statut }: { statut: string }) {
  if (statut === "source_documentee") {
    return (
      <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-800">
        Source documentée
      </span>
    );
  }
  if (statut === "personnel") {
    return (
      <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-medium text-amber-800">
        Contribution d&apos;un membre
      </span>
    );
  }
  return (
    <span className="rounded-full bg-slate-200 px-2 py-1 text-xs font-medium text-slate-700">
      Repère à confirmer
    </span>
  );
}

/**
 * Durée du cycle réellement appliquée par la planification, et non la colonne
 * `dureeCulture` brute : 589 itinéraires portent les deux valeurs et elles
 * divergent. Pour un arbre fruitier, on annonce le délai en années plutôt qu'un
 * nombre de jours qui ne parle à personne.
 */
/**
 * Faits lisibles d'une variété : périodes de floraison et de récolte saisies
 * (2026-10-07), puis groupe de floraison et ploïdie du catalogue.
 */
function faitsVariete(variete: {
  semaineFloraison: number | null;
  dureeFloraison: number | null;
  semaineRecolte: number | null;
  dureeRecolte: number | null;
  groupePollinisation: string | null;
  ploidie: string | null;
}): string[] {
  const floraison = libellePeriodeSemaines(variete.semaineFloraison, variete.dureeFloraison);
  const recolte = libellePeriodeSemaines(variete.semaineRecolte, variete.dureeRecolte);
  const groupe = valeurRenseignee(variete.groupePollinisation);
  return [
    floraison && `Floraison ${floraison}`,
    recolte && `Récolte ${recolte}`,
    groupe && `Groupe de floraison ${groupe}`,
    valeurRenseignee(variete.ploidie),
  ].filter((fait): fait is string => Boolean(fait));
}

function cycleLisible(itp: {
  semaineSemis: number | null;
  semainePlantation: number | null;
  semaineRecolte: number | null;
  semaineImplantationDebut: number | null;
  dureeCulture: number | null;
  delaiPremiereRecolteAnnees: number | null;
}): string {
  const annees = itp.delaiPremiereRecolteAnnees;
  if (annees && annees > 0) {
    return `première récolte au bout de ${annees} an${annees > 1 ? "s" : ""}`;
  }
  const jours = dureeCycleItpJours(itp);
  return jours ? `${jours} jours` : "Non précisé";
}

export default async function FicheVegetalPage({ params }: PageProps) {
  const { id } = await params;
  const espece = await getEspece(decodeURIComponent(id));
  if (!espece) notFound();
  const name = nomPublic(espece);
  const isTree = estTypeVerger(espece.type);
  const zones = espece.zonesAdaptees?.split(",").map((zone) => valeurRenseignee(zone)).filter((zone): zone is string => zone !== null) ?? [];
  // Ticket QA cmvnu7ad8 — une sentinelle d'import (« NON_TROUVE ») se lit absente.
  const descriptionEspece = valeurRenseignee(espece.description);
  const besoinFroid = valeurRenseignee(espece.besoinFroid);
  let communaute: CommunauteVegetalVue;
  try {
    communaute = await lireCommunauteVegetal(espece.id);
  } catch (error) {
    if (error instanceof ErreurEncyclopedie && error.status === 404) notFound();
    throw error;
  }

  return (
    <MarketingShell>
      <article className="mx-auto max-w-6xl px-4 pb-12 pt-8 sm:px-6 sm:pt-12">
        <Link href="/referentiel" className="inline-flex items-center gap-2 text-sm font-medium text-emerald-700 hover:text-emerald-900"><ArrowLeft className="h-4 w-4" /> Retour au référentiel</Link>
        <header className="mt-6 rounded-xl border border-lin bg-craie p-6 sm:p-9">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-emerald-700 text-white">{isTree ? <TreeDeciduous className="h-8 w-8" /> : <Leaf className="h-8 w-8" />}</div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2"><span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-emerald-800 shadow-sm">{originePublique(espece)}</span>{espece.vivace && <span className="rounded-full bg-white px-2.5 py-1 text-xs text-slate-600 shadow-sm">Vivace</span>}</div>
              <h1 className="mt-3 font-display text-4xl font-normal tracking-tight text-foret sm:text-5xl">{name}</h1>
              {espece.nomLatin && <p className="mt-2 text-lg italic text-slate-500">{espece.nomLatin}</p>}
              {descriptionEspece && <p className="mt-5 max-w-3xl text-base leading-7 text-slate-700">{descriptionEspece}</p>}
            </div>
          </div>
        </header>

        <Suspense fallback={<p className="py-6 text-sm text-ardoise">Chargement de la fiche…</p>}>
        <FicheCommunaute especeId={espece.id} nom={name} initialData={communaute}>
        <section id="images-documentaires" className="mt-8 scroll-mt-8">
          <h2 className="font-display text-2xl text-foret">Images documentaires</h2>
          {espece.medias.length ? (
            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {espece.medias.map((media) => <figure key={media.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white"><div className="relative aspect-[4/3] bg-slate-100"><Image src={media.url} alt={`${name} — ${media.organe}`} fill sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw" className="object-cover" /></div><figcaption className="p-4 text-xs leading-5 text-slate-600"><div className="font-medium text-slate-800">{media.organe}{media.description ? ` — ${media.description}` : ""}</div><div className="mt-1">{media.citation}</div><div className="mt-1 flex flex-wrap gap-3"><a href={media.urlLicence} target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline">{media.licence}</a>{media.urlOrigine && <a href={media.urlOrigine} target="_blank" rel="noopener noreferrer" className="text-emerald-700 hover:underline">Voir l’original</a>}</div></figcaption></figure>)}
            </div>
          ) : <Empty>Aucune image validée pour le moment. Vous pouvez proposer votre propre photo.</Empty>}
          <details className="mt-4 rounded-xl border border-lin bg-white p-4"><summary className="flex min-h-11 cursor-pointer items-center font-medium text-foret">Proposer une photo pour cette fiche</summary><PhotoContributionForm especeId={espece.id} nom={name} /></details>
        </section>

        <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Fact icon={Sprout} label="Famille" value={valeurRenseignee(espece.famille?.nomFr) ?? valeurRenseignee(espece.famille?.id) ?? "À documenter"} />
          <Fact icon={Droplets} label="Besoin en eau" value={espece.besoinEau ? `${espece.besoinEau}/5` : valeurRenseignee(espece.irrigation) ?? "À documenter"} />
          <Fact icon={Ruler} label="Densité indicative" value={espece.densite ? `${espece.densite} plants/m²` : "À documenter"} />
          <Fact icon={CalendarDays} label="Levée" value={espece.joursLevee ? `${espece.joursLevee} jours` : valeurRenseignee(espece.temperatureGerm) ?? "À documenter"} />
        </section>

        <section className="mt-10">
          <div className="flex items-center gap-3"><MapPin className="h-6 w-6 text-emerald-700" /><div><h2 className="text-2xl font-bold text-slate-900">Enveloppe climatique</h2><p className="text-sm text-slate-500">Repères généraux à affiner avec le sol et le microclimat de chaque parcelle.</p></div></div>
          <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex flex-wrap gap-2">{zones.length ? zones.map((zone) => <span key={zone} className="rounded-full bg-emerald-50 px-3 py-1.5 text-sm text-emerald-800">{zoneLabel(zone)}</span>) : <span className="text-sm text-slate-500">Zones adaptées encore non documentées.</span>}</div>
            {besoinFroid && <p className="mt-4 text-sm text-slate-600">Besoin de froid : <strong>{besoinFroid}</strong></p>}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold text-slate-900">Itinéraires techniques par contexte</h2>
          <p className="mt-1 text-sm text-slate-500">Ces calendriers sont des références contextualisées, pas des garanties de réussite.</p>
          {espece.itps.length ? <div className="mt-4 grid gap-4 md:grid-cols-2">{espece.itps.map((itp) => <div key={itp.id} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex flex-wrap items-start justify-between gap-2"><h3 className="font-semibold text-slate-900">{nomAffichableItp(itp)}</h3><div className="flex flex-wrap items-center gap-2"><QualiteBadge statut={itp.statutValidation} /><span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{itp.zoneClimat ? zoneLabel(itp.zoneClimat) : "Référence générale"}</span></div></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><MiniFact label="Conduite" value={valeurRenseignee(itp.typePlanche) ?? "Non précisée"} /><MiniFact label="Démarrage" value={valeurRenseignee(itp.modeDemarrage) ?? "Non précisé"} /><MiniFact label="Semis" value={week(itp.semaineSemis)} /><MiniFact label="Plantation" value={week(itp.semainePlantation)} /><MiniFact label="Récolte" value={week(itp.semaineRecolte)} /><MiniFact label="Cycle" value={cycleLisible(itp)} /></dl>{(valeurRenseignee(itp.sourceReference) || valeurRenseignee(itp.sourceUrl) || valeurRenseignee(itp.sourceLicence) || valeurRenseignee(itp.sourceVersion)) && <div className="mt-4 space-y-1 border-t border-lin pt-3 text-xs leading-5 text-ardoise">{valeurRenseignee(itp.sourceReference) && <p>Source déclarée : {valeurRenseignee(itp.sourceReference)}</p>}{valeurRenseignee(itp.sourceUrl) && <p><ReferenceSource source={valeurRenseignee(itp.sourceUrl)!} /></p>}{valeurRenseignee(itp.sourceVersion) && <p>Version : {valeurRenseignee(itp.sourceVersion)}</p>}{valeurRenseignee(itp.sourceLicence) && <p>Licence : {valeurRenseignee(itp.sourceLicence)}</p>}</div>}</div>)}</div> : <Empty>Les itinéraires contextualisés de ce végétal restent à documenter.</Empty>}
          {espece._count.itps > espece.itps.length && (
            <p className="mt-4 text-sm text-slate-500">
              {espece.itps.length} itinéraires affichés sur {espece._count.itps} publiés pour ce
              végétal.
            </p>
          )}
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-bold text-slate-900">Variétés</h2>
          {espece.varietes.length ? <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{espece.varietes.map((variete) => <div key={variete.id} className="rounded-xl border border-slate-200 bg-white p-4"><div className="flex items-start justify-between gap-2"><h3 className="font-medium text-slate-900">{nomPublic(variete)}</h3><span className="text-xs text-slate-400">{originePublique(variete)}</span></div>{faitsVariete(variete).length > 0 && <p className="mt-2 text-xs text-slate-500">{faitsVariete(variete).join(" · ")}</p>}</div>)}</div> : <Empty>Aucune variété publique n’est encore rattachée à cette fiche.</Empty>}
        </section>

        <aside className="mt-8 rounded-xl border border-lin bg-papier p-5 text-sm leading-6 text-ardoise"><strong className="text-encre">Repères à vérifier localement.</strong> Les itinéraires et les caractéristiques du catalogue gardent leur provenance. Les textes communautaires sont relus et conservent leurs sources ; les retours du terrain décrivent une expérience dans son contexte.</aside>
        </FicheCommunaute>
        </Suspense>
      </article>
    </MarketingShell>
  );
}

function zoneLabel(zone: string) { return ZONE_CLIMAT_LABEL[zone as ZoneClimat] || zone.replaceAll("_", " "); }
function week(value: number | null) { return value ? `Semaine ${value}` : "Non précisé"; }
function Fact({ icon: Icon, label, value }: { icon: typeof Leaf; label: string; value: string }) { return <div className="rounded-2xl border border-slate-200 bg-white p-4"><Icon className="h-5 w-5 text-emerald-700" /><div className="mt-3 text-xs font-medium uppercase tracking-wide text-slate-400">{label}</div><div className="mt-1 font-medium text-slate-800">{value}</div></div>; }
function MiniFact({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs text-slate-400">{label}</dt><dd className="mt-0.5 text-slate-700">{value}</dd></div>; }
function Empty({ children }: { children: React.ReactNode }) { return <div className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600">{children}</div>; }
