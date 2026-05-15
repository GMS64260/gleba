/**
 * DEV3 #7 - Audit Marc 2026-05-14
 * GET /api/phyto/cuivre
 *
 * Retourne le compteur cuivre par parcelle pour l'utilisateur :
 *   - cumul kg Cu métal de l'année courante (plafond 4 kg/ha/an)
 *   - cumul kg Cu métal sur 7 années glissantes (plafond 28 kg/ha/7ans)
 *   - statut ok / warn (>75%) / alert (>100%)
 */

import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { requireAuthApi } from "@/lib/auth-utils"
import { cumuleParParcelle, type TraitementCuivreInput } from "@/lib/phyto/cuivre"

export async function GET() {
  const { error, session } = await requireAuthApi()
  if (error) return error

  const userId = session!.user.id
  const asOf = new Date()
  const dateMin7ans = new Date(asOf)
  dateMin7ans.setFullYear(dateMin7ans.getFullYear() - 7)

  const [parcelles, interventions, observations] = await Promise.all([
    prisma.parcelleGeo.findMany({
      where: { userId },
      select: { id: true, nom: true, surface: true },
    }),
    // QA Hélène 2026-05-15 — Bug #2 : on retire le filtre
    // `parcelleId: not null`. Une intervention "Bouillie bordelaise"
    // saisie sans rattachement parcellaire était silencieusement
    // ignorée → compteur cuivre annonçait "Conformité maximale" alors
    // qu'un traitement cuivré existait en base. On capte désormais
    // toute intervention de type traitement_phyto et on dérive la
    // parcelle via l'arbre (arbre_id → parcelle_geo_id) en fallback.
    prisma.intervention.findMany({
      where: {
        userId,
        type: "traitement_phyto",
        date: { gte: dateMin7ans },
      },
      include: { produitPhytoRef: true },
    }),
    // Observations Santé & Phyto qui contiennent les champs réglementaires
    prisma.observationSante.findMany({
      where: {
        userId,
        date: { gte: dateMin7ans },
        parcelleId: { not: null },
      },
    }),
  ])

  const parcelleSurfaces = new Map<string, number>()
  const parcelleNoms = new Map<string, string>()
  for (const p of parcelles) {
    if (p.surface != null) parcelleSurfaces.set(p.id, p.surface)
    parcelleNoms.set(p.id, p.nom)
  }

  // QA Hélène 2026-05-15 — Bug #2 : pré-charger la table arbres pour
  // dériver parcelle_geo_id quand l'intervention est rattachée à un
  // arbre mais pas directement à une parcelle.
  const arbreIds = interventions
    .map((i) => i.arbreId)
    .filter((id): id is number => id != null)
  const arbresMap = new Map<number, string | null>()
  if (arbreIds.length > 0) {
    const arbres = await prisma.arbre.findMany({
      where: { id: { in: arbreIds } },
      select: { id: true, parcelleGeoId: true },
    })
    for (const a of arbres) arbresMap.set(a.id, a.parcelleGeoId)
  }

  const traitements: TraitementCuivreInput[] = []

  for (const i of interventions) {
    const parcelleIdFromArbre = i.arbreId ? arbresMap.get(i.arbreId) ?? null : null
    const parcelleId =
      i.parcelleId ?? parcelleIdFromArbre ?? "__sans_parcelle__"
    traitements.push({
      date: i.date,
      parcelleId,
      surfaceHa: i.surfaceTraiteeHa ?? i.surfaceTraitee ?? null,
      doseAppliquee: i.doseAppliquee,
      uniteDose: i.uniteDose,
      volumeBouillieLHa: i.volumeBouillieLHa,
      produit: i.produitPhytoRef
        ? {
            contientCuivre: i.produitPhytoRef.contientCuivre,
            classification: i.produitPhytoRef.classification,
            nomCommercial: i.produitPhytoRef.nomCommercial,
            substanceActive: i.produitPhytoRef.substanceActive,
            cuivreMetalPct: i.produitPhytoRef.cuivreMetalPct,
            cuivreMetalGParUnite: i.produitPhytoRef.cuivreMetalGParUnite,
          }
        : {
            nomCommercial: i.produitPhyto,
            substanceActive: null,
          },
    })
  }

  for (const o of observations) {
    traitements.push({
      date: o.date,
      parcelleId: o.parcelleId ?? "__sans_parcelle__",
      surfaceHa: o.surfaceTraiteeHa,
      doseAppliquee: o.doseAppliquee,
      uniteDose: o.uniteDose,
      volumeBouillieLHa: o.volumeBouillieLHa,
      produit: {
        nomCommercial: o.produit,
        classification: o.methodeTraitement === "chimique_cuivre" ? "Chimique cuivré" : null,
      },
    })
  }
  // Bucket "Sans parcelle" : libellé explicite pour l'UI
  parcelleNoms.set("__sans_parcelle__", "Sans rattachement parcellaire")

  const cumuls = cumuleParParcelle(traitements, parcelleSurfaces, asOf)
  const enriched = cumuls.map((c) => ({
    ...c,
    parcelleNom: parcelleNoms.get(c.parcelleId) ?? c.parcelleId,
  }))

  return NextResponse.json({
    asOf: asOf.toISOString(),
    plafondAnnuel: 4,
    plafond7ans: 28,
    parcelles: enriched,
  })
}
