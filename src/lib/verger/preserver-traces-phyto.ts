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
        notes: [snapshot, o.notes].filter(Boolean).join('\n'),
      },
    })
  }

  // 2. Opérations d'arbre de type « traitement » réellement effectuées. Ce
  // modèle ne porte ni AMM ni DAR : le registre les signalait déjà comme
  // champs manquants, on ne fabrique donc aucune donnée.
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
        dureeMinutes: op.dureeMinutes,
        nbPersonnes: op.nbPersonnes,
        coutTotal: op.cout,
        temperatureC: op.temperatureC,
        ventKmh: op.ventKmh,
        hygrometriePct: op.hygrometriePct,
        pluie24h: op.pluie24h,
        pluie24hMm: op.pluie24hMm,
        operateurId: op.operateurId,
        notes: [snapshot, op.notes].filter(Boolean).join('\n'),
      },
    })
  }

  return { observations: observations.length, operations: operations.length }
}
