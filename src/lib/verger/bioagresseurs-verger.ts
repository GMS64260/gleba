/**
 * Bioagresseurs du verger : une seule définition pour l'onglet et pour son
 * export CSV.
 *
 * L'onglet ne garde que les organismes dont une espèce cible est un arbre
 * fruitier, un petit fruit ou une liane (bug cmp8rdt33). L'export réécrivait
 * la requête sans ce filtre : le fichier contenait tout le catalogue, Doryphore
 * compris (équipe debug, D83).
 */
import type { Prisma } from '@prisma/client'
import { ESPECE_TYPES_VERGER } from '@/lib/validations/espece'

const CIBLE_VERGER = { espece: { type: { in: [...ESPECE_TYPES_VERGER] } } } satisfies Prisma.BioagresseurEspeceWhereInput

/** Organismes qui visent au moins une espèce du verger. */
export const WHERE_BIOAGRESSEUR_VERGER = { especes: { some: CIBLE_VERGER } } satisfies Prisma.BioagresseurWhereInput

/** Filtre des cibles à lister : celles du verger seulement. */
export const WHERE_CIBLES_VERGER = CIBLE_VERGER
