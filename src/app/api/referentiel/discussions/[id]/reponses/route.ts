import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getActeurId } from "@/lib/exploitation/garde-session"
import { membreEncyclopedie, corpsInvalide } from "@/lib/encyclopedie/http"
import { reponseEncyclopedieSchema } from "@/lib/encyclopedie/validation"
import { discussionAccessibleMembre, reponseErreurEncyclopedie } from "@/lib/encyclopedie/service"
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await membreEncyclopedie(request, "reponse")
  if (error) return error
  const body = reponseEncyclopedieSchema.safeParse(await request.json().catch(() => null))
  if (!body.success) return corpsInvalide()
  try { const { id } = await params
    const reponse = await prisma.$transaction(async tx => {
      await discussionAccessibleMembre(id, tx)
      const creee = await tx.reponseEncyclopedie.create({ data: { ...body.data, discussionId: id, userId: getActeurId(session) },
        select: { id: true, contenu: true, signature: true, createdAt: true } })
      await tx.discussionEncyclopedie.update({ where: { id }, data: { derniereActiviteAt: new Date() } })
      return creee
    })
    return NextResponse.json({ reponse: { ...reponse, createdAt: reponse.createdAt.toISOString(), supprimable: true } }, { status: 201 })
  } catch (e) { return reponseErreurEncyclopedie(e) }
}
