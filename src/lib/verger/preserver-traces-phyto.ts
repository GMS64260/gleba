/**
 * Conservation des traces phytosanitaires d'un arbre supprimé.
 *
 * QA cmswxinhf — le registre phyto (Traçabilité > Registre phytosanitaire) lit
 * trois tables : `Intervention`, `ObservationSante` (formulaire Verger >
 * Santé & Phyto, qui porte AMM, dose, DAR, ZNT, EPI, opérateur, certiphyto) et
 * `OperationArbre` de type « traitement ». Seule la première survivait à la
 * suppression de l'arbre : la route DELETE la détachait (`arbreId = null`, nom
 * snapshoté dans les notes). Les deux autres portent un `arbre_id` OBLIGATOIRE
 * en cascade — un traitement complet saisi depuis la fiche santé disparaissait
 * donc du registre avec l'arbre, et son compteur retombait.
 *
 * Le registre phytosanitaire est une obligation de tenue et de conservation :
 * supprimer une fiche d'arbre ne peut pas effacer un traitement appliqué. On
 * matérialise donc ces traces dans `Intervention` — le modèle du registre, dont
 * `arbreId` est nullable et sans contrainte de clé étrangère — avant de laisser
 * la cascade faire son travail. L'identité de l'arbre est snapshotée comme pour
 * le bois et les interventions, afin que le registre reste lisible.
 */

import type { Prisma } from '@prisma/client'
import { chargerContexteRegistre, contexteEstFige, type ContexteRegistre } from '@/lib/tracabilite/contexte-registre'

export interface ArbreSupprime {
  id: number
  nom: string
  espece: string | null
}

/**
 * Préfixe de la note qui conserve l'identité de l'arbre supprimé. Écrit ici,
 * relu par le registre phyto du verger : c'est le seul lien qui reste entre une
 * intervention détachée et l'arbre qui l'a portée (`Intervention.arbreId` est
 * remis à NULL, et il n'y a pas de clé étrangère à conserver).
 */
export const PREFIXE_ARBRE_SUPPRIME = '[Arbre supprimé : '

/** Compose la note d'identité de l'arbre supprimé. */
export function noteArbreSupprime(arbre: ArbreSupprime): string {
  const identite = `${arbre.nom}${arbre.espece ? ` (${arbre.espece})` : ''}`
  return `${PREFIXE_ARBRE_SUPPRIME}${identite}]`
}

/**
 * Identité de l'arbre supprimé lue dans les notes d'une intervention détachée,
 * `null` si la note n'en porte pas.
 *
 * Ticket cmsx6acih (QA 2026-08-17) : la suppression conservait bien la trace
 * (l'intervention existe, avec son AMM, sa dose, son DAR et sa ZNT), mais le
 * registre phyto du VERGER ne montrait que les interventions rattachées à un
 * arbre existant. La trace détachée n'était donc lisible que dans
 * /tracabilite — l'écran qui venait de promettre sa conservation la comptait
 * en moins.
 */
export function arbreSupprimeDansNotes(notes: string | null | undefined): string | null {
  if (!notes) return null
  const premiereLigne = notes.split('\n')[0]
  if (!premiereLigne.startsWith(PREFIXE_ARBRE_SUPPRIME)) return null
  const identite = premiereLigne.slice(PREFIXE_ARBRE_SUPPRIME.length).replace(/]$/, '').trim()
  return identite || null
}

/** Mêmes méthodes de traitement que le filtre du registre (registre-phyto.ts). */
const METHODES_TRAITEMENT = [
  'chimique_conventionnel',
  'chimique_cuivre',
  'biocontrole',
  'biologique_purin',
  'chimique',
  'biologique',
]

/**
 * Ligne `Intervention` détachée de l'arbre supprimé. Le marqueur
 * `contexteFige` et les provenances sont des clés OBLIGATOIRES : une
 * projection qui les oublie ne compile pas. Sans le marqueur, un contexte
 * délibérément vidé (trois mentions nulles) passait pour « jamais figé » et
 * était relu sur les fiches, réécrivant la dénomination effacée par
 * l'exploitant (contre-revue ADV158-1).
 */
export interface LigneInterventionADetacher {
  source: 'intervention'
  date: Date
  contexteFige: boolean | null
  cultureRegistre: string | null
  localisationRegistre: string | null
  conduiteBio: boolean | null
  origineCultureRegistre: string | null
  origineConduiteBio: string | null
}

/**
 * Observation de santé ou opération d'arbre matérialisée en intervention.
 * Ces modèles n'ont pas de colonne `contexteFige` : leur contexte est
 * toujours DÉDUIT des fiches par le serveur (création, réalisation, bulk,
 * assistant) et jamais saisi ni effacé par l'utilisateur, si bien que
 * « trois mentions nulles » y signifie bien « jamais figé ».
 */
export interface LigneTraceArbre {
  source: 'observation' | 'operation'
  date: Date
  cultureRegistre?: string | null
  localisationRegistre?: string | null
  conduiteBio?: boolean | null
}

/** Contexte écrit sur une intervention détachée : figé, avec ses provenances. */
export interface ContexteInterventionConserve extends ContexteRegistre {
  contexteFige: true
  origineCultureRegistre: string | null
  origineConduiteBio: string | null
}

/**
 * Contexte du registre (culture, localisation, conduite biologique) à porter
 * par la trace détachée. Revue Codex CR-PHY-01 (2026-11-12) : la trace perdait
 * le contexte figé et le stade BBCH, alors que l'arbre, sa parcelle et sa zone
 * disparaissent avec lui (arrêté du 24 décembre 2025, art. 3 et annexe I). Le
 * contexte figé (même entièrement vidé, règle partagée `contexteEstFige`) est
 * recopié tel quel, provenances comprises ; à défaut, il est relu MAINTENANT,
 * tant que l'arbre existe encore, sans rien inventer : une mention relue est
 * « déduite », jamais « saisie ».
 */
export async function contexteAConserver(
  tx: Prisma.TransactionClient,
  userId: string,
  ligne: LigneInterventionADetacher,
  refs: Parameters<typeof chargerContexteRegistre>[2],
): Promise<ContexteInterventionConserve>
export async function contexteAConserver(
  tx: Prisma.TransactionClient,
  userId: string,
  ligne: LigneTraceArbre,
  refs: Parameters<typeof chargerContexteRegistre>[2],
): Promise<ContexteRegistre>
export async function contexteAConserver(
  tx: Prisma.TransactionClient,
  userId: string,
  ligne: LigneInterventionADetacher | LigneTraceArbre,
  refs: Parameters<typeof chargerContexteRegistre>[2],
): Promise<ContexteRegistre | ContexteInterventionConserve> {
  if (contexteEstFige(ligne)) {
    const contexte: ContexteRegistre = {
      cultureRegistre: ligne.cultureRegistre ?? null,
      localisationRegistre: ligne.localisationRegistre ?? null,
      conduiteBio: ligne.conduiteBio ?? null,
    }
    if (ligne.source !== 'intervention') return contexte
    return {
      ...contexte,
      contexteFige: true,
      origineCultureRegistre: ligne.origineCultureRegistre,
      origineConduiteBio: ligne.origineConduiteBio,
    }
  }
  const relu = await chargerContexteRegistre(tx, userId, refs, ligne.date)
  if (ligne.source !== 'intervention') return relu
  return {
    ...relu,
    contexteFige: true,
    origineCultureRegistre: relu.cultureRegistre != null ? 'deduite' : null,
    origineConduiteBio: relu.conduiteBio != null ? 'deduite' : null,
  }
}

export interface TracesPhytoPreservees {
  observations: number
  operations: number
}

export async function preserverTracesPhytoArbre(
  tx: Prisma.TransactionClient,
  userId: string,
  arbre: ArbreSupprime,
): Promise<TracesPhytoPreservees> {
  const snapshot = noteArbreSupprime(arbre)

  // 1. Observations de santé porteuses d'un traitement (registre réglementaire).
  const observations = await tx.observationSante.findMany({
    where: {
      userId,
      arbreId: arbre.id,
      OR: [
        { methodeTraitement: { in: METHODES_TRAITEMENT } },
        { produit: { not: null } },
        { numAMM: { not: null } },
      ],
    },
  })

  for (const o of observations) {
    const contexte = await contexteAConserver(tx, userId, { ...o, source: 'observation' }, { arbreId: arbre.id, parcelleId: o.parcelleId })
    await tx.intervention.create({
      data: {
        userId,
        type: 'traitement_phyto',
        date: o.date,
        fait: true,
        // Détachée dès la création : l'arbre n'existera plus après cette
        // transaction, et `Intervention.arbreId` n'a pas de clé étrangère.
        arbreId: null,
        parcelleId: o.parcelleId,
        description: o.traitement ?? o.diagnostic ?? null,
        produitPhyto: o.produit,
        numAMM: o.numAMM,
        cibleTraitement: o.diagnostic ?? o.symptome ?? null,
        doseAppliquee: o.doseAppliquee,
        uniteDose: o.uniteDose,
        // Le formulaire santé saisit la surface en hectares : on conserve les
        // deux unités pour que le registre puisse totaliser en m² sans perdre
        // la valeur d'origine.
        surfaceTraiteeHa: o.surfaceTraiteeHa,
        surfaceTraitee: o.surfaceTraiteeHa != null ? o.surfaceTraiteeHa * 10_000 : null,
        volumeBouillieLHa: o.volumeBouillieLHa,
        volumeBouillieLTotal: o.volumeBouillieLTotal,
        dar: o.dar,
        temperatureC: o.temperatureC,
        ventKmh: o.ventKmh,
        hygrometriePct: o.hygrometriePct,
        pluie24h: o.pluie24h,
        pluie24hMm: o.pluie24hMm,
        epiPortes: o.epiPortes,
        zntRespectee: o.zntRespectee,
        zntDistanceM: o.zntDistanceM,
        operateurId: o.operateurId,
        certiphytoNum: o.certiphytoNum,
        justification: o.traitement ?? null,
        stadeBBCH: o.stadeBBCH ?? null,
        ...contexte,
        notes: [snapshot, o.notes].filter(Boolean).join('\n'),
      },
    })
  }

  // 2. Opérations d'arbre de type « traitement » réellement effectuées. Ce
  // modèle ne porte pas d'AMM : le registre la signalait déjà comme champ
  // manquant, on n'en fabrique pas. Le DAR de l'étiquette et la nature du
  // produit, saisis depuis la migration 20261113210000, suivent la trace
  // (contre-revue B11 : le registre les perdait avec l'arbre).
  const operations = await tx.operationArbre.findMany({
    where: {
      userId,
      arbreId: arbre.id,
      type: 'traitement',
      fait: true,
      OR: [{ produit: { not: null } }, { description: { not: null } }],
    },
  })

  for (const op of operations) {
    const contexte = await contexteAConserver(tx, userId, { ...op, source: 'operation' }, { arbreId: arbre.id })
    await tx.intervention.create({
      data: {
        userId,
        type: 'traitement_phyto',
        date: op.date,
        fait: true,
        arbreId: null,
        description: op.description,
        produitPhyto: op.produit,
        doseAppliquee: op.quantite,
        uniteDose: op.unite,
        dar: op.dar,
        natureProduit: op.natureProduit,
        dureeMinutes: op.dureeMinutes,
        nbPersonnes: op.nbPersonnes,
        coutTotal: op.cout,
        temperatureC: op.temperatureC,
        ventKmh: op.ventKmh,
        hygrometriePct: op.hygrometriePct,
        pluie24h: op.pluie24h,
        pluie24hMm: op.pluie24hMm,
        operateurId: op.operateurId,
        ...contexte,
        notes: [snapshot, op.notes].filter(Boolean).join('\n'),
      },
    })
  }

  return { observations: observations.length, operations: operations.length }
}
