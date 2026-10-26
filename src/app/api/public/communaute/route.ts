import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { nomPublic, visibiliteEnfantPublic, visibiliteReferentielPublic } from "@/lib/referentiel-public"
import { checkRateLimit, getClientIP } from "@/lib/rate-limit"
import { valeurRenseignee } from "@/lib/referentiel-valeur"
import { bornesPageCatalogue, filtreCatalogue, lireRechercheCatalogue, TAILLE_PAGE_CATALOGUE, type PageCatalogue } from "@/lib/encyclopedie/catalogue"

export const dynamic = "force-dynamic"

/** Le portail et les fiches lisent les mêmes références, sans aucune donnée d'exploitation. */
export async function GET(request: Request) {
  const plafond = checkRateLimit(`catalogue-communaute:${getClientIP(request)}`, { windowMs: 60_000, max: 120 })
  if (plafond) return plafond
  try {
    const recherche = lireRechercheCatalogue(new URL(request.url).searchParams)
    const where = filtreCatalogue(recherche)
    const total = await prisma.espece.count({ where })
    const { page, pages, skip } = bornesPageCatalogue(total, recherche.page)
    const [especes, revisions] = await Promise.all([
      prisma.espece.findMany({
        where,
        select: {
          id: true, nom: true, nomLatin: true, type: true, description: true,
          _count: {
            select: {
              varietes: { where: visibiliteEnfantPublic() },
              itps: { where: { AND: [{ actif: true }, visibiliteEnfantPublic()] } },
            },
          },
        },
        orderBy: [{ nom: "asc" }, { id: "asc" }],
        skip,
        take: TAILLE_PAGE_CATALOGUE,
      }),
      prisma.revisionEncyclopedie.findMany({
        where: { espece: visibiliteReferentielPublic, cibleType: "SECTION", refId: "" },
        select: { id: true, section: true, signature: true, createdAt: true, espece: { select: { id: true, nom: true } } },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: 6,
      }),
    ])
    const data: PageCatalogue = {
      especes: especes.map((espece) => ({
        id: espece.id,
        nom: nomPublic(espece),
        nomLatin: valeurRenseignee(espece.nomLatin),
        type: espece.type,
        description: valeurRenseignee(espece.description),
        nbVarietes: espece._count.varietes,
        nbItineraires: espece._count.itps,
      })),
      total, page, pages,
      contributionsRecentes: revisions.map((revision) => ({
        id: revision.id,
        espece: { id: revision.espece.id, nom: nomPublic(revision.espece) },
        section: revision.section,
        signature: revision.signature,
        createdAt: revision.createdAt.toISOString(),
      })),
    }
    return NextResponse.json(data)
  } catch (error) {
    console.error("GET /api/public/communaute", error)
    return NextResponse.json({ error: "Le catalogue communautaire est momentanément indisponible." }, { status: 500 })
  }
}
