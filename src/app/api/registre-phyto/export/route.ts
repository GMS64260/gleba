/**
 * GET /api/registre-phyto/export?from=&to=&format=pdf|csv&parcelleId=&especeId=
 *
 * PROMPT 11 LOT C — Export du registre phyto pour contrôle DRAAF / Agence Bio.
 *
 * - PDF A4 paysage avec mentions légales en pied de page.
 * - CSV UTF-8 avec BOM, séparateur `;` (compatible Excel FR).
 */

import { NextRequest, NextResponse } from "next/server"
import { dispositionDocument, dispositionTelechargement } from "@/lib/http/disposition-fichier"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import PDFDocument from "pdfkit"
import { identifiantLegalAffichage } from "@/lib/territoires"
import { applicateurPhyto } from "@/lib/tracabilite/projection-phyto"
import { jourCivilStocke, jourLocalISO } from "@/lib/jour-civil"
import { classifierProduitHeuristique } from "@/lib/tracabilite/registre-phyto"
import { celluleCsv } from "@/lib/csv-cellule"
import { METHODES_OBSERVATION_REGISTRE } from "@/lib/tracabilite/conformite-observation-phyto"
import { chargerContexteRegistre, type ContexteRegistre } from "@/lib/tracabilite/contexte-registre"
import { LIBELLES_SOURCE, type SourceRegistre } from "@/lib/tracabilite/historique-phyto"

type Format = "pdf" | "csv"

// Revue de conformité du 2026-11-12 : l'ancien pied citait l'arrêté du 4 mai
// 2017 (délais et conditions d'emploi), pas le texte du registre, et
// affirmait une conformité que l'export ne vérifie pas seul.
const MENTION_LEGALE =
  "Registre d'utilisation des produits phytopharmaceutiques (arrêté du 24 décembre 2025, annexe I). " +
  "Les mentions marquées manquantes dans Gleba restent à compléter par l'exploitant."

export async function GET(request: NextRequest) {
  const { error, session } = await requireAuthApi()
  if (error) return error

  const sp = request.nextUrl.searchParams
  const format = (sp.get("format") || "pdf").toLowerCase() as Format
  const fromStr = sp.get("from")
  const toStr = sp.get("to")
  const parcelleId = sp.get("parcelleId")
  const especeId = sp.get("especeId")

  // Bornes en jours civils de l'exploitation, comme l'écran du registre
  // (`genererRegistrePhyto`) : « 2026-12-31 » lu par `new Date()` valait minuit
  // UTC, et un traitement marqué fait le 31/12 à 10 h sortait de l'export
  // annuel (revue du 2026-11-04).
  const from = fromStr ? debutJourCivil(fromStr) : new Date(new Date().getFullYear(), 0, 1)
  const to = toStr ? finJourCivil(toStr) : new Date(new Date().getFullYear(), 11, 31, 23, 59, 59, 999)
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    return NextResponse.json({ error: "Paramètres from/to invalides" }, { status: 400 })
  }
  if (format !== "pdf" && format !== "csv") {
    return NextResponse.json({ error: "Format invalide (pdf|csv)" }, { status: 400 })
  }

  const userId = session!.user.id
  // DEV3 #2 — filtres supplémentaires (méthode + recherche produit)
  const methodeFilter = sp.get("methode")
  const produitFilter = sp.get("produit")?.toLowerCase()

  const [user, exploitation, interventions, observations, operationsArbres] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, email: true, certiphytoNum: true, certiphytoValidite: true },
    }),
    // DEV3 #2 — En-tête PDF avec raison sociale + SIRET + agrément Ecocert
    prisma.exploitation.findUnique({
      where: { userId },
      select: {
        raisonSociale: true,
        territoire: true,
        siret: true,
        identifiantLegal: true,
        adresseSiege: true,
        codePostal: true,
        ville: true,
        certifBioOrganisme: true,
      },
    }),
    prisma.intervention.findMany({
      where: {
        userId,
        type: "traitement_phyto",
        // Un traitement planifié n'a pas été appliqué (même règle que l'écran).
        fait: true,
        date: { gte: from, lte: to },
        ...(parcelleId ? { OR: [{ parcelleId }, { plancheId: parcelleId }] } : {}),
      },
      include: {
        produitPhytoRef: true,
        operateur: { select: { name: true, email: true } },
        user: { select: { name: true, email: true } },
        parcelle: { select: { id: true, nom: true } },
      },
      orderBy: { date: "asc" },
    }),
    // DEV3 #2 — Inclure les observations Santé & Phyto du Verger qui
    // contiennent désormais les mêmes champs réglementaires (cf migration
    // 20260514260100). Filtre : observations avec produit/méthode chimique.
    prisma.observationSante.findMany({
      where: {
        userId,
        date: { gte: from, lte: to },
        OR: [
          { methodeTraitement: { in: [...METHODES_OBSERVATION_REGISTRE] } },
          { produit: { not: null } },
          { numAMM: { not: null } },
        ],
        ...(parcelleId ? { parcelleId } : {}),
      },
      include: {
        arbre: { select: { id: true, nom: true, espece: true, variete: true } },
        operateur: { select: { name: true, email: true } },
        user: { select: { name: true, email: true } },
        parcelle: { select: { id: true, nom: true } },
      },
      orderBy: { date: "asc" },
    }),
    // 3ᵉ source de l'écran (QA cmsoghh2b) : les traitements saisis dans
    // Verger > Opérations. L'export les omettait : la « Bouillie bordelaise
    // 3 kg » d'un pommier figurait à l'écran mais pas dans le PDF remis au
    // contrôleur (revue du 2026-11-04).
    prisma.operationArbre.findMany({
      where: {
        userId,
        type: "traitement",
        fait: true,
        date: { gte: from, lte: to },
        OR: [{ produit: { not: null } }, { description: { not: null } }],
        ...(parcelleId ? { arbre: { parcelleGeoId: parcelleId } } : {}),
      },
      include: {
        arbre: { select: { id: true, nom: true, espece: true, variete: true, parcelleGeo: { select: { nom: true } } } },
        user: { select: { name: true, email: true } },
        operateur: { select: { name: true, email: true } },
      },
      orderBy: { date: "asc" },
    }),
  ])

  // Lookups séparés pour culture/planche/arbre (le modèle Intervention n'a
  // pas de relations Prisma directes vers ces entités — cf route GET existante).
  const cultureIds = [...new Set(interventions.map((i) => i.cultureId).filter((x): x is number => x != null))]
  const plancheIds = [...new Set(interventions.map((i) => i.plancheId).filter((x): x is string => !!x))]
  const arbreIds = [...new Set(interventions.map((i) => i.arbreId).filter((x): x is number => x != null))]

  const [cultures, planches, arbres] = await Promise.all([
    cultureIds.length > 0
      ? prisma.culture.findMany({
          // Colonnes sans clé étrangère : chaque lecture reste bornée au compte.
          where: { id: { in: cultureIds }, userId },
          include: { espece: { select: { id: true, nom: true } }, variete: { select: { id: true, nom: true } }, planche: { select: { nom: true } } },
        })
      : Promise.resolve([]),
    plancheIds.length > 0
      ? prisma.planche.findMany({ where: { id: { in: plancheIds }, userId }, select: { id: true, nom: true } })
      : Promise.resolve([]),
    arbreIds.length > 0
      ? prisma.arbre.findMany({ where: { id: { in: arbreIds }, userId }, select: { id: true, nom: true, espece: true, variete: true } })
      : Promise.resolve([]),
  ])

  const cultureById = new Map(cultures.map((c) => [c.id, c]))
  const plancheById = new Map(planches.map((p) => [p.id, p]))
  const arbreById = new Map(arbres.map((a) => [a.id, a]))

  // Modèle ligne d'export normalisé + filtrage post-fetch par especeId/methode/produit.
  // Contexte réglementaire d'une ligne (culture, localisation, conduite
  // biologique) : celui figé à l'enregistrement, sinon relu des fiches
  // actuelles pour les lignes antérieures (revue de conformité, C4).
  const contexteDe = async (
    ligne: { date: Date; cultureRegistre?: string | null; localisationRegistre?: string | null; conduiteBio?: boolean | null },
    refs: Parameters<typeof chargerContexteRegistre>[2],
  ): Promise<ContexteRegistre> =>
    ligne.cultureRegistre != null || ligne.localisationRegistre != null || ligne.conduiteBio != null
      ? {
          cultureRegistre: ligne.cultureRegistre ?? null,
          localisationRegistre: ligne.localisationRegistre ?? null,
          conduiteBio: ligne.conduiteBio ?? null,
        }
      : chargerContexteRegistre(prisma, userId, refs, ligne.date)
  const contextesIntervention = await Promise.all(
    interventions.map((i) =>
      contexteDe(i, { cultureId: i.cultureId, plancheId: i.plancheId, arbreId: i.arbreId, parcelleId: i.parcelleId }),
    ),
  )
  const contextesObservation = await Promise.all(
    observations.map((o) => contexteDe(o, { arbreId: o.arbreId, parcelleId: o.parcelleId })),
  )
  const contextesOperation = await Promise.all(
    operationsArbres.map((op) => contexteDe({ date: op.date }, { arbreId: op.arbreId })),
  )

  const lignesIntervention = interventions.map((i, index) => {
    const ref = i.produitPhytoRef
    const contexte = contextesIntervention[index]
    const culture = i.cultureId ? cultureById.get(i.cultureId) : null
    const planche = culture?.planche ?? (i.plancheId ? plancheById.get(i.plancheId) : null)
    const arbre = i.arbreId ? arbreById.get(i.arbreId) : null
    const espece = culture?.espece.nom ?? culture?.espece.id ?? arbre?.espece ?? null
    const variete = culture?.variete?.nom ?? culture?.variete?.id ?? arbre?.variete ?? null
    return {
      source: "intervention",
      // Jour civil, comme l'écran du registre (cmvnulry1) : `slice(0, 10)` de
      // l'ISO donnait la veille d'un traitement saisi entre minuit et 2 h à Paris.
      date: jourCivilStocke(i.date) ?? "",
      parcelle: i.parcelle?.nom ?? planche?.nom ?? null,
      espece,
      variete,
      // surfaceTraitee est saisie en m² : conversion en ha pour la colonne
      // "Surface traitée (ha)" du registre officiel (audit #37, facteur 10 000).
      surfaceHa:
        i.surfaceTraiteeHa ??
        (i.surfaceTraitee != null ? i.surfaceTraitee / 10000 : null),
      cible: i.cibleTraitement ?? null,
      methode: ref?.classification ?? null,
      // Ce qui a été enregistré sur le traitement prime sur le référentiel
      // actuel (revue de conformité du 2026-11-12, C4).
      produit: i.produitPhyto ?? ref?.nomCommercial ?? null,
      amm: i.numAMM ?? ref?.amm ?? null,
      substance: ref?.substanceActive ?? null,
      classification: ref?.classification ?? null,
      autoriseAB: ref?.autoriseAB ?? null,
      dose: i.doseAppliquee != null ? `${i.doseAppliquee} ${i.uniteDose ?? ""}`.trim() : null,
      doseValeur: i.doseAppliquee ?? null,
      doseUnite: i.uniteDose ?? null,
      volumeBouillie: i.volumeBouillieLHa ?? null,
      volumeBouillieTotal: i.volumeBouillieLTotal ?? null,
      dar: i.dar ?? null,
      temperatureC: i.temperatureC ?? null,
      ventKmh: i.ventKmh ?? null,
      hygrometriePct: i.hygrometriePct ?? null,
      pluie24h: i.pluie24h,
      pluie24hMm: i.pluie24hMm ?? null,
      epiPortes: i.epiPortes,
      zntRespectee: i.zntRespectee,
      zntDistanceM: i.zntDistanceM ?? null,
      // QA cmvgeltj1 — opérateur saisi en texte libre (notes) avant le titulaire du compte.
      operateur: applicateurPhyto(i),
      certiphytoNum: i.certiphytoNum ?? null,
      certiphytoValidite: i.certiphytoValidite?.toISOString().slice(0, 10) ?? null,
      justification: i.justification ?? null,
      ...mentionsAnnexeI(contexte, {
        stadeBBCH: i.stadeBBCH,
        heureDebut: i.heureDebut,
        heureFin: i.heureFin,
        rentreeAnticipee: i.rentreeAnticipee,
        siretBeneficiaire: i.siretBeneficiaire,
        numLot: i.intrantNumLot,
      }),
    }
  })

  const lignesObservation = observations.map((o, index) => ({
    source: "observation_sante",
    date: jourCivilStocke(o.date) ?? "",
    parcelle: o.parcelle?.nom ?? null,
    espece: o.arbre?.espece ?? null,
    variete: o.arbre?.variete ?? null,
    surfaceHa: o.surfaceTraiteeHa ?? null,
    cible: o.diagnostic ?? o.symptome ?? null,
    methode: o.methodeTraitement ?? null,
    produit: o.produit ?? null,
    amm: o.numAMM ?? null,
    substance: null as string | null,
    classification: o.methodeTraitement ?? null,
    autoriseAB: null as boolean | null,
    dose: o.doseAppliquee != null ? `${o.doseAppliquee} ${o.uniteDose ?? ""}`.trim() : null,
    doseValeur: o.doseAppliquee ?? null,
    doseUnite: o.uniteDose ?? null,
    volumeBouillie: o.volumeBouillieLHa ?? null,
    volumeBouillieTotal: o.volumeBouillieLTotal ?? null,
    dar: o.dar ?? null,
    temperatureC: o.temperatureC ?? null,
    ventKmh: o.ventKmh ?? null,
    hygrometriePct: o.hygrometriePct ?? null,
    pluie24h: o.pluie24h,
    pluie24hMm: o.pluie24hMm ?? null,
    epiPortes: o.epiPortes,
    zntRespectee: o.zntRespectee,
    zntDistanceM: o.zntDistanceM ?? null,
    operateur: applicateurPhyto(o),
    certiphytoNum: o.certiphytoNum ?? null,
    certiphytoValidite: null as string | null,
    justification: o.traitement ?? null,
    ...mentionsAnnexeI(contextesObservation[index], { stadeBBCH: o.stadeBBCH }),
  }))

  const lignesOperation = operationsArbres.map((op, index) => {
    const classification = classifierProduitHeuristique(op.produit ?? null)
    return {
      source: "operation_arbre",
      date: jourCivilStocke(op.date) ?? "",
      parcelle: op.arbre?.parcelleGeo?.nom ?? null,
      espece: op.arbre?.espece ?? null,
      variete: op.arbre?.variete ?? null,
      // Quantité absolue (kg, L) : pas de surface saisie sur une opération.
      surfaceHa: null as number | null,
      cible: null as string | null,
      methode: classification,
      produit: op.produit ?? null,
      amm: null as string | null,
      substance: null as string | null,
      classification,
      autoriseAB: null as boolean | null,
      dose: op.quantite != null ? `${op.quantite} ${op.unite ?? ""}`.trim() : null,
      doseValeur: op.quantite ?? null,
      doseUnite: op.unite ?? null,
      volumeBouillie: null as number | null,
      volumeBouillieTotal: null as number | null,
      dar: null as number | null,
      temperatureC: op.temperatureC ?? null,
      ventKmh: op.ventKmh ?? null,
      hygrometriePct: op.hygrometriePct ?? null,
      pluie24h: null as boolean | null,
      pluie24hMm: null as number | null,
      epiPortes: [] as string[],
      zntRespectee: null as boolean | null,
      zntDistanceM: null as number | null,
      operateur: applicateurPhyto(op),
      certiphytoNum: null as string | null,
      certiphytoValidite: null as string | null,
      justification: op.description ?? null,
      ...mentionsAnnexeI(contextesOperation[index], {}),
    }
  })

  const lignes = [...lignesIntervention, ...lignesObservation, ...lignesOperation]
    .filter((l) => !especeId || l.espece === especeId)
    .filter((l) => !methodeFilter || l.methode === methodeFilter)
    .filter((l) => !produitFilter || (l.produit?.toLowerCase().includes(produitFilter)))
    .sort((a, b) => a.date.localeCompare(b.date))

  // Rectifications et suppressions de traitements faites pendant la période
  // (arrêté du 24 décembre 2025, art. 3 : l'original reste retrouvable).
  const rectifications = await prisma.registrePhytoHistorique.findMany({
    where: { userId, createdAt: { gte: from, lte: to } },
    orderBy: { createdAt: "asc" },
    select: { createdAt: true, source: true, sourceId: true, action: true, avant: true, motif: true },
  })

  if (format === "csv") {
    return buildCsv(lignes, user, exploitation, from, to, rectifications)
  }
  return buildPdf(lignes, user, exploitation, from, to, request, rectifications)
}

type Rectification = {
  createdAt: Date
  source: string
  sourceId: number
  action: string
  avant: unknown
  motif: string | null
}

/** Résumé lisible de l'état d'avant d'une rectification. */
function resumeAvant(r: Rectification): string {
  const a = (r.avant ?? {}) as Record<string, unknown>
  const date = typeof a.date === "string" ? dateFr(jourCivilStocke(new Date(a.date)) ?? "") : ""
  const produit = a.produitPhyto ?? a.produit ?? a.description ?? ""
  const amm = a.numAMM ? ` (AMM ${a.numAMM})` : ""
  const dose = a.doseAppliquee != null ? ` ${a.doseAppliquee} ${a.uniteDose ?? ""}`.trimEnd() : a.quantite != null ? ` ${a.quantite} ${a.unite ?? ""}`.trimEnd() : ""
  return [date, `${produit}${amm}${dose}`.trim()].filter(Boolean).join(" · ")
}

/** Mentions de l'annexe I de l'arrêté du 24 décembre 2025, communes aux trois sources. */
function mentionsAnnexeI(
  contexte: ContexteRegistre,
  m: {
    stadeBBCH?: string | null
    heureDebut?: string | null
    heureFin?: string | null
    rentreeAnticipee?: string | null
    siretBeneficiaire?: string | null
    numLot?: string | null
  },
) {
  return {
    cultureRegistre: contexte.cultureRegistre,
    localisation: contexte.localisationRegistre,
    conduiteBio: contexte.conduiteBio,
    stadeBBCH: m.stadeBBCH ?? null,
    heureDebut: m.heureDebut ?? null,
    heureFin: m.heureFin ?? null,
    rentreeAnticipee: m.rentreeAnticipee ?? null,
    siretBeneficiaire: m.siretBeneficiaire ?? null,
    numLot: m.numLot ?? null,
  }
}

/** « AAAA-MM-JJ » → « JJ/MM/AAAA » (annexe II de l'arrêté du 24 décembre 2025). */
function dateFr(jour: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(jour)
  return m ? `${m[3]}/${m[2]}/${m[1]}` : jour
}

function ouiNon(v: unknown): string | null {
  return v === null || v === undefined ? null : v ? "Oui" : "Non"
}

type Exploitation = {
  raisonSociale: string
  territoire?: string | null
  siret: string | null
  identifiantLegal?: string | null
  adresseSiege: string
  codePostal: string
  ville: string
  certifBioOrganisme: string | null
} | null

// ─────────────────────────────────────────────────────────────────────────────
// CSV — UTF-8 avec BOM, séparateur `;` (Excel FR)
// ─────────────────────────────────────────────────────────────────────────────

type Ligne = Record<string, string | number | boolean | null>

// Cellules par `celluleCsv` : guillemets ET neutralisation des préfixes de
// formule (=, +, -, @) ; l'ancien échappement laissait « =HYPERLINK(…) »
// s'exécuter à l'ouverture du fichier dans un tableur.

function buildCsv(
  lignes: Array<Record<string, unknown>>,
  user: { name: string | null; email: string; certiphytoNum: string | null; certiphytoValidite: Date | null } | null,
  exploitation: Exploitation,
  from: Date,
  to: Date,
  rectifications: Rectification[],
): NextResponse {
  const siretDetenteur = exploitation?.siret ?? null
  const headers = [
    "Date",
    "SIRET détenteur",
    "SIRET bénéficiaire (prestation)",
    "Horaire début",
    "Horaire fin",
    "Culture",
    "Localisation (GPS WGS84)",
    "Conduite biologique",
    "Stade BBCH",
    "N° lot",
    "Rentrée anticipée",
    "Parcelle",
    "Espèce",
    "Variété",
    "Surface traitée (ha)",
    "Cible",
    "Produit",
    "N° AMM",
    "Substance active",
    // Revue de conformité du 2026-11-12 (C7) : ni la classification ni le
    // statut AB ne valent autorisation ; à vérifier sur l'AMM du produit.
    "Classification (indicative)",
    "AB selon le référentiel (à vérifier sur l'AMM)",
    "Dose appliquée",
    "Dose (valeur)",
    "Unité de dose",
    "Volume bouillie (L/ha)",
    "Volume bouillie (L total)",
    "DAR (j)",
    "Température (°C)",
    "Vent (km/h)",
    "Hygrométrie (%)",
    "Pluie ±24h",
    "Pluie (mm)",
    "EPI portés",
    "ZNT respectée",
    "ZNT distance (m)",
    "Opérateur",
    "N° Certiphyto",
    "Validité Certiphyto",
    "Justification / Action",
  ]

  const rows: string[] = []
  rows.push(headers.join(";"))
  for (const l of lignes) {
    rows.push(
      [
        dateFr(String(l.date ?? "")),
        siretDetenteur,
        l.siretBeneficiaire,
        l.heureDebut,
        l.heureFin,
        l.cultureRegistre,
        l.localisation,
        ouiNon(l.conduiteBio),
        l.stadeBBCH,
        l.numLot,
        l.rentreeAnticipee,
        l.parcelle,
        l.espece,
        l.variete,
        l.surfaceHa,
        l.cible,
        l.produit,
        l.amm,
        l.substance,
        l.classification,
        l.autoriseAB === null ? null : l.autoriseAB ? "Oui" : "Non",
        l.dose,
        l.doseValeur,
        l.doseUnite,
        l.volumeBouillie,
        l.volumeBouillieTotal,
        l.dar,
        l.temperatureC,
        l.ventKmh,
        l.hygrometriePct,
        l.pluie24h === null || l.pluie24h === undefined ? null : l.pluie24h ? "Oui" : "Non",
        l.pluie24hMm,
        Array.isArray(l.epiPortes) ? (l.epiPortes as string[]).join("|") : null,
        l.zntRespectee === null || l.zntRespectee === undefined ? null : l.zntRespectee ? "Oui" : "Non",
        l.zntDistanceM,
        l.operateur,
        l.certiphytoNum,
        l.certiphytoValidite,
        l.justification,
      ]
        .map(celluleCsv)
        .join(";")
    )
  }
  if (rectifications.length > 0) {
    rows.push("")
    rows.push(["Rectifications et suppressions de la période", "", "", "", ""].map(celluleCsv).join(";"))
    rows.push(["Le", "Action", "Source", "État d'avant", "Motif"].map(celluleCsv).join(";"))
    for (const r of rectifications) {
      rows.push(
        [
          dateFr(jourLocalISO(r.createdAt)),
          r.action,
          `${LIBELLES_SOURCE[r.source as SourceRegistre] ?? r.source} n° ${r.sourceId}`,
          resumeAvant(r),
          r.motif,
        ]
          .map(celluleCsv)
          .join(";"),
      )
    }
  }

  // En-tête en haut du CSV : exploitation + SIRET + agrément + période
  const emetteur = exploitation?.raisonSociale || user?.name || user?.email || ""
  const ident = exploitation ? identifiantLegalAffichage(exploitation) : null
  const siret = ident ? ` (${ident.label} ${ident.valeur})` : ""
  const agrement = exploitation?.certifBioOrganisme ? ` — Certification : ${exploitation.certifBioOrganisme}` : ""
  const periode = `${jourLocalISO(from)} → ${jourLocalISO(to)}`
  const header = [
    `Registre phytosanitaire — ${emetteur}${siret}${agrement}`,
    `Période : ${periode}`,
    MENTION_LEGALE,
    "",
  ].map(celluleCsv).join("\r\n")

  const bom = "﻿"
  const body = bom + header + "\r\n" + rows.join("\r\n") + "\r\n"
  const filename = `registre-phyto-${jourLocalISO(from)}_${jourLocalISO(to)}.csv`
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": dispositionTelechargement(filename),
    },
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF — A4 paysage, tableau dense, mentions légales en pied de page
// ─────────────────────────────────────────────────────────────────────────────

async function buildPdf(
  lignes: Array<Record<string, unknown>>,
  user: { name: string | null; email: string; certiphytoNum: string | null; certiphytoValidite: Date | null } | null,
  exploitation: Exploitation,
  from: Date,
  to: Date,
  // L'URL appelante décide de l'affichage ou du téléchargement (2026-08-19).
  requete: NextRequest,
  rectifications: Rectification[],
): Promise<NextResponse> {
  const buffer = await new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({
      size: "A4",
      layout: "landscape",
      margin: 30,
      // bufferPages permet d'utiliser switchToPage() après tout le rendu
      // pour redessiner les footers avec la pagination "Page X / Y".
      bufferPages: true,
      info: {
        Title: `Registre phyto ${jourLocalISO(from)}_${jourLocalISO(to)}`,
        Author: exploitation?.raisonSociale || user?.name || user?.email || "Gleba",
        Subject: "Registre d'utilisation des produits phytopharmaceutiques - Arrêté du 24 décembre 2025",
        Keywords: "registre,phytosanitaire,bio,traçabilité",
      },
    })
    const chunks: Buffer[] = []
    doc.on("data", (c) => chunks.push(c))
    doc.on("end", () => resolve(Buffer.concat(chunks)))
    doc.on("error", reject)

    // DEV3 #2 — Numérotation de pages : on incrémente à chaque addPage et
    // on dessine le footer en fin pour tracer "Page X / Y". pdfkit ne supporte
    // pas la pagination dynamique en un seul pass : on garde une stratégie
    // par accumulation puis post-traitement via switchToPage.
    let totalPages = 1

    const drawFooter = (pageNum: number) => {
      const pageBottom = doc.page.height - 38
      doc
        .fontSize(7)
        .fillColor("#64748b")
        .font("Helvetica")
        .text(MENTION_LEGALE, 30, pageBottom, {
          width: doc.page.width - 60,
          align: "center",
        })
      doc.text(
        `Exporté le ${new Date().toLocaleDateString("fr-FR")} via Gleba — gleba.fr  ·  Page ${pageNum} / ${totalPages}`,
        30,
        pageBottom + 10,
        { width: doc.page.width - 60, align: "center" }
      )
    }

    // ── EN-TÊTE ──
    // Bloc émetteur enrichi : raison sociale, SIRET, agrément Ecocert/BV
    const expName = exploitation?.raisonSociale || user?.name || user?.email || "Émetteur"
    doc.fontSize(15).fillColor("#0f172a").font("Helvetica-Bold")
      .text("Registre phytosanitaire", 30, 30)
    doc.fontSize(10).fillColor("#0f172a").font("Helvetica-Bold")
      .text(expName, 30, 52)
    doc.fontSize(8.5).fillColor("#334155").font("Helvetica")
    if (exploitation) {
      doc.text(
        `${exploitation.adresseSiege} — ${exploitation.codePostal} ${exploitation.ville}`,
        30,
        67
      )
      {
        const ident = identifiantLegalAffichage(exploitation)
        if (ident) doc.text(`${ident.label} ${ident.valeur}`, 30, 79)
      }
      if (exploitation.certifBioOrganisme) {
        doc.fillColor("#047857").font("Helvetica-Bold")
        doc.text(`Agrément AB : ${exploitation.certifBioOrganisme}`, 30, 91)
        doc.fillColor("#334155").font("Helvetica")
      }
    } else {
      doc.text(user?.email || "", 30, 67)
    }

    if (user?.certiphytoNum) {
      doc.text(
        `Certiphyto opérateur : ${user.certiphytoNum}${
          user.certiphytoValidite
            ? ` (valide jusqu'au ${user.certiphytoValidite.toLocaleDateString("fr-FR")})`
            : ""
        }`,
        30,
        exploitation?.certifBioOrganisme ? 104 : 91
      )
    }
    doc.text(
      // « → » n'existe pas dans la police standard du PDF (WinAnsi).
      `Période : du ${from.toLocaleDateString("fr-FR")} au ${to.toLocaleDateString("fr-FR")}`,
      doc.page.width - 250,
      52,
      { width: 220, align: "right" }
    )
    doc.text(`Lignes : ${lignes.length}`, doc.page.width - 250, 65, { width: 220, align: "right" })

    // ── TABLEAU ──
    const tableTop = exploitation ? 130 : 110
    // Annexe I de l'arrêté du 24 décembre 2025 : culture, localisation,
    // conduite biologique et stade ajoutés ; total 782 pt (A4 paysage, marges 30).
    const cols: Array<{ key: string; label: string; w: number }> = [
      { key: "date", label: "Date (horaire)", w: 50 },
      { key: "culture", label: "Culture (stade)", w: 70 },
      { key: "localisation", label: "Localisation", w: 95 },
      { key: "bio", label: "Bio", w: 22 },
      { key: "surfaceHa", label: "Surf.(ha)", w: 35 },
      { key: "cible", label: "Cible", w: 50 },
      { key: "produit", label: "Produit (AMM)", w: 100 },
      { key: "classification", label: "Classif. (indic.)", w: 55 },
      { key: "dose", label: "Dose", w: 45 },
      { key: "volumeBouillie", label: "Bouillie", w: 35 },
      { key: "dar", label: "DAR", w: 22 },
      { key: "meteo", label: "Météo (T°/V/H)", w: 60 },
      { key: "operateur", label: "Opérateur (Certiphyto)", w: 75 },
      { key: "justification", label: "Justification / rentrée", w: 68 },
    ]

    const drawHeader = (y: number): number => {
      doc.rect(30, y, doc.page.width - 60, 18).fillColor("#e2e8f0").fill()
      doc.fillColor("#1e293b").fontSize(7.5).font("Helvetica-Bold")
      let x = 30
      for (const c of cols) {
        doc.text(c.label, x + 2, y + 5, { width: c.w - 4 })
        x += c.w
      }
      return y + 18
    }

    let y = drawHeader(tableTop)
    doc.fontSize(7).font("Helvetica").fillColor("#1e293b")

    const formatRow = (l: Record<string, unknown>) => {
      const meteo = [l.temperatureC, l.ventKmh, l.hygrometriePct]
        .map((v, idx) => (v == null ? "—" : `${v}${idx === 0 ? "°C" : idx === 1 ? "km/h" : "%"}`))
        .join(" / ")
      const operateurCol = `${l.operateur ?? ""}${l.certiphytoNum ? ` (${l.certiphytoNum})` : ""}`
      const especeVar = [l.espece, l.variete].filter(Boolean).join(" — ") || "—"
      const produitAmm = `${l.produit ?? "—"}${l.amm ? ` (AMM ${l.amm})` : ""}`
      const horaire = [l.heureDebut, l.heureFin].filter(Boolean).join("-")
      const culture = String(l.cultureRegistre ?? especeVar)
      const justification = [l.justification, l.rentreeAnticipee ? `Rentrée anticipée : ${l.rentreeAnticipee}` : null]
        .filter(Boolean)
        .join(" · ")
      return {
        date: `${dateFr(String(l.date ?? ""))}${horaire ? ` (${horaire})` : ""}`,
        culture: `${culture}${l.stadeBBCH ? ` (BBCH ${l.stadeBBCH})` : ""}`,
        localisation: String(l.localisation ?? l.parcelle ?? "—"),
        bio: ouiNon(l.conduiteBio) ?? "—",
        surfaceHa: l.surfaceHa != null ? String(l.surfaceHa) : "—",
        cible: String(l.cible ?? "—"),
        produit: produitAmm,
        substance: String(l.substance ?? "—"),
        classification: String(l.classification ?? "—"),
        dose: String(l.dose ?? "—"),
        volumeBouillie: l.volumeBouillie != null ? String(l.volumeBouillie) : "—",
        dar: l.dar != null ? String(l.dar) : "—",
        meteo,
        operateur: operateurCol,
        justification: justification || "—",
      }
    }

    for (const ligne of lignes) {
      const row = formatRow(ligne)
      // Hauteur dynamique : max sur les colonnes texte longues
      let rowHeight = 14
      for (const c of cols) {
        const txt = (row as Record<string, string>)[c.key] ?? ""
        const h = doc.heightOfString(txt, { width: c.w - 4 }) + 4
        if (h > rowHeight) rowHeight = h
      }
      // Page break (laisse de l'espace pour la zone signature en dernière page)
      if (y + rowHeight > doc.page.height - 55) {
        totalPages++
        doc.addPage({ size: "A4", layout: "landscape", margin: 30 })
        y = drawHeader(30)
        doc.fontSize(7).font("Helvetica").fillColor("#1e293b")
      }

      let x = 30
      for (const c of cols) {
        const txt = (row as Record<string, string>)[c.key] ?? ""
        doc.text(txt, x + 2, y + 2, { width: c.w - 4 })
        x += c.w
      }
      // Séparateur
      doc.moveTo(30, y + rowHeight).lineTo(doc.page.width - 30, y + rowHeight).strokeColor("#e2e8f0").lineWidth(0.3).stroke()
      y += rowHeight
    }

    if (lignes.length === 0) {
      doc.fontSize(10).fillColor("#64748b")
        .text("Aucun traitement sur la période.", 30, y + 12)
    }

    // Rectifications et suppressions de la période : l'état d'avant reste
    // retrouvable (arrêté du 24 décembre 2025, art. 3).
    if (rectifications.length > 0) {
      if (y + 40 > doc.page.height - 55) {
        totalPages++
        doc.addPage({ size: "A4", layout: "landscape", margin: 30 })
        y = 30
      } else {
        y += 16
      }
      doc.fontSize(9).fillColor("#0f172a").font("Helvetica-Bold")
        .text("Rectifications et suppressions de la période", 30, y)
      y += 14
      doc.fontSize(7).font("Helvetica").fillColor("#1e293b")
      for (const r of rectifications) {
        const texte =
          `${dateFr(jourLocalISO(r.createdAt))} · ${r.action} · ` +
          `${LIBELLES_SOURCE[r.source as SourceRegistre] ?? r.source} n° ${r.sourceId} · ` +
          `avant : ${resumeAvant(r) || "—"}${r.motif ? ` · motif : ${r.motif}` : ""}`
        const h = doc.heightOfString(texte, { width: doc.page.width - 60 }) + 3
        if (y + h > doc.page.height - 55) {
          totalPages++
          doc.addPage({ size: "A4", layout: "landscape", margin: 30 })
          y = 30
          doc.fontSize(7).font("Helvetica").fillColor("#1e293b")
        }
        doc.text(texte, 30, y, { width: doc.page.width - 60 })
        y += h
      }
    }

    // DEV3 #2 — Zone signature en bas de la dernière page (pour signature
    // manuscrite après impression, lors d'un contrôle DRAAF / Agence Bio).
    const signatureY = Math.max(y + 20, doc.page.height - 110)
    if (signatureY + 60 < doc.page.height - 30) {
      doc.fontSize(8.5).fillColor("#1e293b").font("Helvetica-Bold")
        .text("Certification du registre", 30, signatureY)
      doc.fontSize(7.5).fillColor("#334155").font("Helvetica")
        .text(
          "Je soussigné(e), responsable de l'exploitation, certifie que les informations consignées ci-dessus sont exactes et conformes à la réglementation en vigueur.",
          30,
          signatureY + 14,
          { width: doc.page.width - 60 }
        )
      // Cadres signature
      doc.fontSize(7).fillColor("#64748b")
      doc.text("Fait à : ____________________________", 30, signatureY + 40)
      doc.text("Le : ____________________________", 30, signatureY + 52)
      doc.text("Signature et cachet :", doc.page.width - 250, signatureY + 40)
      doc.rect(doc.page.width - 250, signatureY + 50, 220, 40).strokeColor("#94a3b8").lineWidth(0.5).stroke()
    }

    // DEV3 #2 — Pagination finale avec switchToPage : on (re-)dessine les
    // footers sur chaque page maintenant qu'on connaît `totalPages`.
    for (let p = 0; p < totalPages; p++) {
      doc.switchToPage(p)
      drawFooter(p + 1)
    }
    doc.end()
  })

  const filename = `registre-phyto-${jourLocalISO(from)}_${jourLocalISO(to)}.pdf`
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": dispositionDocument(requete, filename),
      "Cache-Control": "no-cache",
    },
  })
}


// Type util pour le tooling.
export type RegistrePhytoLigne = Ligne

/** Début du jour civil « AAAA-MM-JJ » (heure de l'exploitation) ; repli : date ISO lue telle quelle. */
function debutJourCivil(valeur: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valeur)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(valeur)
}

/** Fin du jour civil « AAAA-MM-JJ » (23:59:59.999) ; repli : date ISO lue telle quelle. */
function finJourCivil(valeur: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(valeur)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 23, 59, 59, 999) : new Date(valeur)
}
