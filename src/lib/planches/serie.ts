import { z } from 'zod'
import { surfacePlanche } from './surface'

/**
 * Création de planches en série.
 *
 * Constat de production du 2026-08-06 : un maraîcher a demandé « créer encore
 * 14 planches de 17m x 0,80 en zone 1 », l'assistant a confirmé « je peux créer
 * ces 14 planches, de Z1p4 à Z1p17 », l'utilisateur a validé, et UNE seule
 * planche a été créée — `create_planche` ne sait en créer qu'une, et ni l'API
 * ni l'écran Planches ne proposaient de série. Il a fini par saisir ses 33
 * planches à la main, en laissant 29 sans îlot.
 *
 * Source de vérité unique du nommage et de la création, partagée par la route
 * `POST /api/planches/serie` et l'outil d'assistant `create_planches_serie`.
 */

/** Plafond volontaire : au-delà, c'est un import, pas une saisie guidée. */
export const SERIE_MAX = 100

/** `nom` est borné à 50 caractères par `plancheSchema`. */
const NOM_MAX = 50

export const planchesSerieSchema = z.object({
  // Borné au nom complet : le contrôle final porte sur `prefixe + numéro`.
  prefixe: z.string().min(1, 'Le préfixe des noms est requis').max(NOM_MAX),
  debut: z.number().int().min(0).max(9_999).optional().default(1),
  nombre: z.number().int().min(1).max(SERIE_MAX),
  /** Largeur du numéro, zéros à gauche (2 ⇒ Z1p01). */
  padding: z.number().int().min(1).max(4).optional().default(1),
  largeur: z.number().min(0).max(10).nullable().optional(),
  longueur: z.number().min(0).max(100).nullable().optional(),
  ilot: z.string().max(50).nullable().optional(),
  type: z.string().max(50).nullable().optional(),
  irrigation: z.string().max(50).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
})

export type PlanchesSerieInput = z.infer<typeof planchesSerieSchema>

/** Noms générés par la série, dans l'ordre. */
export function nomsDeSerie(input: {
  prefixe: string
  debut?: number
  nombre: number
  padding?: number
}): string[] {
  const debut = input.debut ?? 1
  const padding = input.padding ?? 1
  return Array.from({ length: input.nombre }, (_, index) =>
    `${input.prefixe}${String(debut + index).padStart(padding, '0')}`,
  )
}

export type PlanchesSerieResultat = {
  crees: string[]
  /** Noms déjà pris : ignorés, jamais écrasés. */
  ignores: string[]
}

/** Colonnes réellement écrites par une série (compatible `PlancheCreateManyInput`). */
type PlancheSerieData = {
  nom: string
  userId: string
  largeur: number | null
  longueur: number | null
  surface: number | null
  ilot: string | null
  type: string | null
  irrigation: string | null
  notes: string | null
}

type DbSerie = {
  planche: {
    findMany(args: {
      where: { userId: string; nom: { in: string[] } }
      select: { nom: true }
    }): Promise<{ nom: string }[]>
    createMany(args: { data: PlancheSerieData[] }): Promise<{ count: number }>
  }
}

/**
 * Crée la série et renvoie ce qui a réellement été créé. Les noms déjà
 * utilisés sont ignorés et remontés : une série partiellement existante se
 * complète (cas d'un premier essai interrompu) sans jamais écraser une
 * planche portant déjà des cultures.
 */
export async function creerPlanchesSerie(
  db: DbSerie,
  userId: string,
  input: PlanchesSerieInput,
): Promise<PlanchesSerieResultat> {
  const noms = nomsDeSerie(input)
  const tropLong = noms.find((nom) => nom.length > NOM_MAX)
  if (tropLong) {
    throw new Error(`Nom de planche trop long (${NOM_MAX} caractères maximum) : « ${tropLong} »`)
  }

  const existantes = await db.planche.findMany({
    where: { userId, nom: { in: noms } },
    select: { nom: true },
  })
  const dejaPris = new Set(existantes.map((planche) => planche.nom))
  const aCreer = noms.filter((nom) => !dejaPris.has(nom))

  const largeur = input.largeur ?? null
  const longueur = input.longueur ?? null
  if (aCreer.length > 0) {
    await db.planche.createMany({
      data: aCreer.map((nom) => ({
        nom,
        userId,
        largeur,
        longueur,
        surface: surfacePlanche(largeur, longueur),
        ilot: input.ilot ?? null,
        type: input.type ?? null,
        irrigation: input.irrigation ?? null,
        notes: input.notes ?? null,
      })),
    })
  }

  return { crees: aCreer, ignores: noms.filter((nom) => dejaPris.has(nom)) }
}

/** Phrase de bilan commune à l'API et à l'assistant. */
export function messageSerie(resultat: PlanchesSerieResultat): string {
  const parties: string[] = []
  if (resultat.crees.length > 0) {
    const premiere = resultat.crees[0]
    const derniere = resultat.crees[resultat.crees.length - 1]
    parties.push(
      resultat.crees.length === 1
        ? `1 planche créée (${premiere})`
        : `${resultat.crees.length} planches créées (${premiere} à ${derniere})`,
    )
  }
  if (resultat.ignores.length > 0) {
    parties.push(
      `${resultat.ignores.length} nom${resultat.ignores.length > 1 ? 's' : ''} déjà utilisé${resultat.ignores.length > 1 ? 's' : ''} et donc ignoré${resultat.ignores.length > 1 ? 's' : ''} (${resultat.ignores.slice(0, 5).join(', ')}${resultat.ignores.length > 5 ? '…' : ''})`,
    )
  }
  return parties.join(', ') || 'Aucune planche créée'
}
