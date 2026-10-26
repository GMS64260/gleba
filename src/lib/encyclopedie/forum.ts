import type { Prisma, DiscussionEncyclopedie } from "@prisma/client"
import prisma from "@/lib/prisma"
import { visibiliteReferentielPublic, nomPublic } from "@/lib/referentiel-public"
import { CATEGORIES_FORUM, type SujetForumVue, type FilForumVue, type CategorieForum } from "./types"
import { ErreurEncyclopedie } from "./service"

const visibiliteForum: Prisma.DiscussionEncyclopedieWhereInput = {
  OR: [{ especeId: null }, { espece: visibiliteReferentielPublic }],
}
type SujetLu = DiscussionEncyclopedie & { espece: { id: string; nom: string | null } | null; _count: { reponses: number } }
function vueSujet(s: SujetLu, acteurId: string, admin: boolean): SujetForumVue {
  return { id: s.id, titre: s.titre, signature: s.signature,
    categorie: (CATEGORIES_FORUM as readonly string[]).includes(s.categorie) ? s.categorie as CategorieForum : "GENERAL",
    createdAt: s.createdAt.toISOString(), derniereActiviteAt: s.derniereActiviteAt.toISOString(), epingle: s.epingle,
    resolu: s.resolu, nbReponses: s._count.reponses, espece: s.espece ? { id: s.espece.id, nom: nomPublic(s.espece) } : null,
    supprimable: admin || s.userId === acteurId }
}
export async function listerForum(params: URLSearchParams, acteurId: string, admin: boolean) {
  const q = (params.get("q") ?? "").trim()
  const categorie = params.get("categorie")
  const tri = params.get("tri") ?? "recent"
  const pageDemandee = Number(params.get("page") ?? "1")
  if (q.length > 120 || !Number.isInteger(pageDemandee) || pageDemandee < 1 || pageDemandee > 100000 ||
    (categorie && !(CATEGORIES_FORUM as readonly string[]).includes(categorie)) || !["recent", "sans-reponse"].includes(tri)) {
    throw new ErreurEncyclopedie(400, "Filtres du forum invalides.")
  }
  const where: Prisma.DiscussionEncyclopedieWhereInput = {
    AND: [visibiliteForum],
    ...(categorie ? { categorie } : {}),
    ...(q ? { OR: [{ titre: { contains: q, mode: "insensitive" } }, { contenu: { contains: q, mode: "insensitive" } }] } : {}),
    ...(tri === "sans-reponse" ? { reponses: { none: {} } } : {}),
  }
  const total = await prisma.discussionEncyclopedie.count({ where })
  const pages = Math.max(1, Math.ceil(total / 20)), page = Math.min(pageDemandee, pages)
  const sujets = await prisma.discussionEncyclopedie.findMany({ where, take: 20, skip: (page - 1) * 20,
    orderBy: [{ epingle: "desc" }, { derniereActiviteAt: "desc" }, { id: "desc" }],
    include: { espece: { select: { id: true, nom: true } }, _count: { select: { reponses: true } } } })
  return { sujets: sujets.map(s => vueSujet(s, acteurId, admin)), total, page, pages }
}
export async function lireFilForum(id: string, acteurId: string, admin: boolean, pageDemandee?: number): Promise<FilForumVue> {
  if (pageDemandee !== undefined && (!Number.isInteger(pageDemandee) || pageDemandee < 1 || pageDemandee > 100000)) {
    throw new ErreurEncyclopedie(400, "Page de réponses invalide.")
  }
  const sujet = await prisma.discussionEncyclopedie.findFirst({ where: { id, AND: [visibiliteForum] },
    include: { espece: { select: { id: true, nom: true } }, _count: { select: { reponses: true } } } })
  if (!sujet) throw new ErreurEncyclopedie(404, "Discussion introuvable.")
  const pagesReponses = Math.max(1, Math.ceil(sujet._count.reponses / 30))
  // Sans page explicite, aller aux échanges les plus récents, notamment après
  // l'ajout d'une réponse. Le lecteur peut revenir aux pages précédentes.
  const pageReponses = Math.min(pageDemandee ?? pagesReponses, pagesReponses)
  const reponses = await prisma.reponseEncyclopedie.findMany({ where: { discussionId: id },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }], take: 30, skip: (pageReponses - 1) * 30 })
  return { ...vueSujet(sujet, acteurId, admin), contenu: sujet.contenu, pageReponses, pagesReponses,
    reponses: reponses.map(r => ({ id: r.id, contenu: r.contenu, signature: r.signature, createdAt: r.createdAt.toISOString(), supprimable: admin || r.userId === acteurId })) }
}
