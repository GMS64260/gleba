import type { Prisma } from "@prisma/client"
import { visibiliteReferentielPublic } from "@/lib/referentiel-public"
import { ESPECE_TYPES, libelleTypeEspece } from "@/lib/validations/espece"

export const TAILLE_PAGE_CATALOGUE = 24

export const TYPES_CATALOGUE = ESPECE_TYPES.map((value) => ({
  value,
  label: libelleTypeEspece(value),
}))

export interface RechercheCatalogue {
  q: string
  type: string
  page: number
  sansPhoto: boolean
}

export interface EspeceCatalogue {
  id: string
  nom: string
  nomLatin: string | null
  type: string
  description: string | null
  nbVarietes: number
  nbItineraires: number
}

export interface ContributionRecenteCatalogue {
  id: string
  espece: { id: string; nom: string }
  section: string
  signature: string
  createdAt: string
}

export interface PageCatalogue {
  especes: EspeceCatalogue[]
  total: number
  page: number
  pages: number
  contributionsRecentes: ContributionRecenteCatalogue[]
}

/** Les paramètres ne peuvent ni augmenter la taille d'une page, ni choisir un champ SQL. */
export function lireRechercheCatalogue(params: Pick<URLSearchParams, "get">): RechercheCatalogue {
  const rawPage = params.get("page") ?? "1"
  const page = /^\d{1,7}$/.test(rawPage) ? Number(rawPage) : 1
  const type = params.get("type") ?? ""
  return {
    q: (params.get("q") ?? "").trim().slice(0, 80),
    type: (ESPECE_TYPES as readonly string[]).includes(type) ? type : "",
    page: Math.max(1, Math.min(page, 1_000_000)),
    sansPhoto: params.get("sansPhoto") === "1",
  }
}

export function filtreCatalogue(recherche: RechercheCatalogue): Prisma.EspeceWhereInput {
  return {
    AND: [
      visibiliteReferentielPublic,
      ...(recherche.type ? [{ type: recherche.type }] : []),
      ...(recherche.sansPhoto ? [{ medias: { none: { statut: "VALIDE" as const } } }] : []),
      ...(recherche.q ? [{ OR: [
        { nom: { contains: recherche.q, mode: "insensitive" as const } },
        { nomLatin: { contains: recherche.q, mode: "insensitive" as const } },
        { id: { contains: recherche.q, mode: "insensitive" as const } },
      ] }] : []),
    ],
  }
}

export function bornesPageCatalogue(total: number, pageDemandee: number) {
  const pages = Math.max(1, Math.ceil(total / TAILLE_PAGE_CATALOGUE))
  const page = Math.min(Math.max(1, pageDemandee), pages)
  return { page, pages, skip: (page - 1) * TAILLE_PAGE_CATALOGUE }
}
