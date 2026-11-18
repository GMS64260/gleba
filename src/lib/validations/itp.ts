/**
 * Schemas de validation Zod pour les ITPs (Itineraires Techniques de Plantes)
 */

import { z } from 'zod'
import { ZONES_CLIMAT } from '@/lib/terroir'

// Types de planche
// Feedback Marc 2026-05-16 — V2 Bug 7 : la base contient « Sous abri »
// (alias générique serre/tunnel) saisi via d'autres modules. Sans
// cette entrée, le Select du détail ITP retombait sur le placeholder
// « Sélectionner… » alors que la liste affichait bien « Sous abri ».
export const ITP_TYPE_PLANCHE = ['Plein champ', 'Sous abri', 'Serre', 'Tunnel', 'Chassis'] as const

// Schema de base pour un ITP
export const baseITPSchema = z.object({
  id: z.string().min(1, "L'identifiant de l'ITP est requis").max(100),
  especeId: z.string().nullable().optional(),
  semaineSemis: z.number().int().min(1).max(52).nullable().optional(),
  semainePlantation: z.number().int().min(1).max(52).nullable().optional(),
  semaineRecolte: z.number().int().min(1).max(52).nullable().optional(),
  semaineImplantationDebut: z.number().int().min(1).max(52).nullable().optional(),
  semaineImplantationFin: z.number().int().min(1).max(52).nullable().optional(),
  semaineRecolteFin: z.number().int().min(1).max(52).nullable().optional(),
  dureeRecolte: z.number().int().min(0).max(52).nullable().optional(),
  dureePepiniere: z.number().int().min(0).max(365).nullable().optional(),
  dureeCulture: z.number().int().min(0).max(365).nullable().optional(),
  nbRangs: z.number().int().min(1).max(20).nullable().optional(),
  espacement: z.number().min(1).max(200).nullable().optional(), // cm entre plants
  notes: z.string().max(5000).nullable().optional(),
  // Champs métier complémentaires
  typePlanche: z.string().max(50).nullable().optional(),
  decalageMax: z.number().int().min(0).max(52).nullable().optional(),
  espacementRangs: z.number().int().min(1).max(200).nullable().optional(), // cm entre rangs
  nbGrainesPlant: z.number().min(0).max(100).nullable().optional(),
  doseSemis: z.number().min(0).max(1000).nullable().optional(), // g/m2 ou g/ml
  // Zone climatique de calage (référentiel géographique). null = référentiel
  // métropolitain « moyen ». À la création côté serveur, un ITP perso hérite
  // par défaut de la zone de son auteur si celle-ci est une zone d'outre-mer.
  zoneClimat: z.enum(ZONES_CLIMAT).nullable().optional(),
  implantation: z.string().max(100).nullable().optional(),
  forcage: z.boolean().nullable().optional(),
  contexteClimatique: z.string().max(200).nullable().optional(),
  sourceReference: z.string().max(2000).nullable().optional(),
  sourceUrl: z.string().url().max(2000).nullable().optional(),
  sourceVersion: z.string().max(100).nullable().optional(),
  sourceLicence: z.string().max(300).nullable().optional(),
  commentaireAgronome: z.string().max(5000).nullable().optional(),
  delaiPremiereRecolteAnnees: z.number().int().min(0).max(30).nullable().optional(),
})

// Schéma pour la création
export const createITPSchema = baseITPSchema

/**
 * Schéma de mise à jour. L'`id` technique n'est jamais modifiable (c'est la clé
 * étrangère des cultures et des rotations), mais le LIBELLÉ doit l'être : sans
 * lui, une faute de saisie était définitive et l'ITP « TEST Marc Phacelie v7 »,
 * dont le nom avait été écrasé avant le correctif QA cmswxyuoi, restait
 * incorrigible depuis l'interface. Le serveur recalcule `nomNormalise` et
 * revérifie l'unicité — un nom reste un affichage, jamais une clé.
 */
export const updateITPSchema = baseITPSchema
  .partial()
  .omit({ id: true })
  .extend({
    nom: z.string().min(1, 'Le nom de l\'ITP est requis').max(100).optional(),
  })

/**
 * Miroir applicatif du trigger PostgreSQL `enforce_itp_dates` (migration
 * `20260729100000_itp_fenetres_provenance`). La base refuse ces deux cas par
 * une exception que l'API rendait en 500 muette : on les annonce avant
 * d'écrire, avec la même arithmétique (modulo 52) et sans durcir la règle.
 *
 * Ne vaut que pour un ITP rattaché à une espèce et sans provenance sourcée,
 * comme le trigger. Rend le message à afficher, ou `null` si tout est cohérent.
 */
export function messageIncoherenceSemainesItp(itp: {
  typeCultureSemis?: string | null
  semaineSemis?: number | null
  semainePlantation?: number | null
  semaineRecolte?: number | null
}): string | null {
  const { semaineSemis: semis, semainePlantation: plantation, semaineRecolte: recolte } = itp
  if (semis == null) return null

  if (
    itp.typeCultureSemis === 'pepiniere_puis_repiquage' &&
    plantation != null &&
    (plantation - semis + 52) % 52 < 1
  ) {
    return `La plantation (S${plantation}) doit suivre le semis (S${semis}) d'au moins une semaine : cette espèce passe par la pépinière.`
  }

  if (recolte != null && (recolte - semis + 52) % 52 < 4) {
    return `La récolte (S${recolte}) est trop proche du semis (S${semis}) : il faut au moins 4 semaines entre les deux.`
  }

  return null
}

/**
 * Repli : message du trigger `enforce_itp_dates` retrouvé dans une erreur de
 * base (cas où le contrôle ci-dessus n'a pas pu lire l'espèce). Rend un
 * message propre, sans l'identifiant technique ni l'enrobage du client SQL.
 */
export function messageRefusTriggerDatesItp(erreur: unknown): string | null {
  const texte = erreur instanceof Error ? erreur.message : typeof erreur === 'string' ? erreur : ''
  if (/trop proche du semis/.test(texte)) {
    return 'La récolte est trop proche du semis : il faut au moins 4 semaines entre les deux.'
  }
  if (/doit suivre le semis/.test(texte)) {
    return "La plantation doit suivre le semis d'au moins une semaine : cette espèce passe par la pépinière."
  }
  return null
}

// Types inférés
export type ITPInput = z.infer<typeof baseITPSchema>
export type CreateITPInput = z.infer<typeof createITPSchema>
export type UpdateITPInput = z.infer<typeof updateITPSchema>
