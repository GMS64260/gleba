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

import { displayReferentielName, normalizeReferentielKey } from './normalize'
import { visibiliteReferentiel } from './referentiel-communaute'

export interface NomItp {
  nom: string
  nomNormalise: string
}

/** Libellé affiché + clé de dédup pour une saisie utilisateur. */
export function nomItpDepuisSaisie(saisie: string): NomItp {
  const nom = displayReferentielName(saisie)
  return { nom, nomNormalise: normalizeReferentielKey(nom) }
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
