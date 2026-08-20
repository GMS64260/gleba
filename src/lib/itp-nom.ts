/**
 * Nommage d'un ITP côté serveur : une seule règle pour la création et pour le
 * renommage.
 *
 * Deux valeurs, deux rôles, jamais confondus (QA cmswxyuoi) :
 *   - `nom`          : le libellé, conservé TEL QUE SAISI (trim et espaces
 *                      multiples réduites, rien d'autre) ;
 *   - `nomNormalise` : la clé de comparaison (sans tiret, underscore, accent ni
 *                      casse), qui sert à la déduplication et à la recherche.
 *
 * Confondre les deux avait fait enregistrer « TEST-Marc-Phacelie-v7 » sous
 * « TEST Marc Phacelie v7 » : introuvable par le nom tapé, donc réputé perdu.
 */

import type { PrismaClient } from '@prisma/client'

import { nomEtCleReferentiel, normalizeReferentielKey } from './normalize'
import { visibiliteReferentiel } from './referentiel-communaute'

export interface NomItp {
  nom: string
  nomNormalise: string
}

/** Libellé affiché + clé de dédup pour une saisie utilisateur. */
export function nomItpDepuisSaisie(saisie: string): NomItp {
  return nomEtCleReferentiel(saisie)
}

export interface ConflitNomItp {
  id: string
  nom: string | null
}

/**
 * Cherche un ITP qui porterait déjà ce nom, dans le périmètre d'unicité qui
 * s'applique :
 *
 *   - catalogue officiel (`userId` null) : unicité globale du catalogue, exacte
 *     sur l'identifiant lisible et « molle » sur le nom normalisé ;
 *   - ITP personnel : unicité bornée à SES propres ITP, adossée à l'index
 *     unique partiel `itps_user_nomnorm_perso_key (user_id, nom_normalise)`.
 *
 * `exclureId` sert au renommage : un ITP n'entre pas en conflit avec lui-même.
 * Le repli `normalizeReferentielKey(id)` couvre les lignes anciennes dont
 * `nomNormalise` n'a jamais été renseigné (imports et seeds historiques).
 */
export async function conflitNomItp(
  prisma: PrismaClient,
  opts: {
    nom: string
    nomNormalise: string
    proprietaireId: string | null
    exclureId?: string
  }
): Promise<ConflitNomItp | null> {
  const { nom, nomNormalise, proprietaireId, exclureId } = opts

  if (proprietaireId === null) {
    const exact = await prisma.iTP.findFirst({
      where: { userId: null, id: nom, ...(exclureId ? { NOT: { id: exclureId } } : {}) },
      select: { id: true, nom: true },
    })
    if (exact) return exact

    const officiels = await prisma.iTP.findMany({
      where: { userId: null, ...(exclureId ? { NOT: { id: exclureId } } : {}) },
      select: { id: true, nom: true, nomNormalise: true },
    })
    return (
      officiels.find(
        (i) => (i.nomNormalise ?? normalizeReferentielKey(i.id)) === nomNormalise
      ) ?? null
    )
  }

  return prisma.iTP.findFirst({
    where: {
      userId: proprietaireId,
      nomNormalise,
      ...(exclureId ? { NOT: { id: exclureId } } : {}),
    },
    select: { id: true, nom: true },
  })
}

/** Message d'erreur 409 aligné entre la création et le renommage. */
export function messageConflitNomItp(conflit: ConflitNomItp, estOfficiel: boolean): string {
  const libelle = conflit.nom ?? conflit.id
  return estOfficiel
    ? `Un itinéraire similaire existe déjà : « ${libelle} ». Si c'est le même, utilisez-le ; sinon, choisissez un nom plus distinctif.`
    : `Vous avez déjà un itinéraire « ${libelle} » dans votre catalogue.`
}

/**
 * Itinéraire VISIBLE portant déjà ce nom, hors du périmètre d'unicité déjà
 * contrôlé — donc hors conflit bloquant.
 *
 * Le contrôle dur est volontairement étroit : un membre peut légitimement avoir
 * son « Radis printemps » à lui alors que le catalogue Gleba en propose un. Mais
 * le taire fait grossir le référentiel commun de quasi-doublons sans que
 * personne s'en aperçoive — c'est ainsi que, le 2026-08-18, un membre a recréé
 * « zinnia » et « cosmos » en aromatiques alors que les deux existaient déjà en
 * fleurs, avec leurs itinéraires. On signale sans bloquer, là où l'utilisateur
 * peut encore décider.
 */
export async function doublonVisibleItp(
  prisma: PrismaClient,
  opts: { nomNormalise: string; lecteurId: string; exclureId: string }
): Promise<ConflitNomItp | null> {
  if (!opts.nomNormalise) return null
  return prisma.iTP.findFirst({
    where: {
      AND: [
        { nomNormalise: opts.nomNormalise, actif: true, NOT: { id: opts.exclureId } },
        visibiliteReferentiel(opts.lecteurId),
      ],
    },
    select: { id: true, nom: true },
    orderBy: { userId: 'asc' },
  })
}

/**
 * Violation de l'index `itps_periode_unique_idx` traduite en message.
 *
 * Cet index interdit deux itinéraires qui partagent (auteur, espèce, semaine de
 * semis, semaine de plantation, semaine de récolte, type de planche). La
 * violation remontait en 500 « Erreur lors de la création de l'ITP » : rien ne
 * disait qu'il s'agissait d'un conflit de PÉRIODE, ni avec quel itinéraire — qui
 * pouvait d'ailleurs être invisible au demandeur avant que l'index ne soit borné
 * par auteur.
 */
export function estConflitPeriodeItp(erreur: unknown): boolean {
  const e = erreur as { code?: string; meta?: { target?: unknown } } | null
  if (!e) return false
  if (e.code === 'P2002') {
    const cible = JSON.stringify(e.meta?.target ?? '')
    return cible.includes('periode') || cible.includes('itps_periode_unique_idx')
  }
  return (e as { code?: string }).code === '23505'
}

/** Itinéraire déjà présent sur la même période, pour nommer le conflit. */
export async function itpMemePeriode(
  prisma: PrismaClient,
  opts: {
    proprietaireId: string | null
    especeId: string | null | undefined
    semaineSemis?: number | null
    semainePlantation?: number | null
    semaineRecolte?: number | null
    typePlanche?: string | null
    exclureId?: string
  }
): Promise<ConflitNomItp | null> {
  if (!opts.especeId) return null
  return prisma.iTP.findFirst({
    where: {
      userId: opts.proprietaireId,
      especeId: opts.especeId,
      semaineSemis: opts.semaineSemis ?? null,
      semainePlantation: opts.semainePlantation ?? null,
      semaineRecolte: opts.semaineRecolte ?? null,
      typePlanche: opts.typePlanche ?? null,
      sourceRecordId: null,
      ...(opts.exclureId ? { NOT: { id: opts.exclureId } } : {}),
    },
    select: { id: true, nom: true },
  })
}

/** Message 409 du conflit de période. */
export function messageConflitPeriodeItp(conflit: ConflitNomItp | null): string {
  return conflit
    ? `Vous avez déjà un itinéraire sur cette même période pour cette espèce : « ${conflit.nom ?? conflit.id} ». Modifiez une semaine ou le type de planche, ou repartez de celui-là.`
    : `Un itinéraire existe déjà sur cette même période pour cette espèce, avec le même type de planche. Modifiez une semaine ou le type de planche.`
}
