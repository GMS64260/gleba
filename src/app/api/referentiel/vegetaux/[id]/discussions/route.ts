import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { getActeurId } from "@/lib/exploitation/garde-session"
import { membreEncyclopedie, corpsInvalide } from "@/lib/encyclopedie/http"
import { discussionEncyclopedieSchema } from "@/lib/encyclopedie/validation"
import { especePublique, reponseErreurEncyclopedie } from "@/lib/encyclopedie/service"
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { error, session } = await membreEncyclopedie(request, "discussion")
  if (error) return error
  const body = discussionEncyclopedieSchema.safeParse(await request.json().catch(() => null))
  if (!body.success) return corpsInvalide()
  try { const { id } = await params
    const discussion = await prisma.$transaction(async tx => {
      await especePublique(id, tx)
      return tx.discussionEncyclopedie.create({ data: { ...body.data, especeId: id, userId: getActeurId(session), categorie: "ENCYCLOPEDIE" },
        select: { id: true, titre: true, contenu: true, signature: true, createdAt: true } })
    })
    return NextResponse.json({ discussion: { ...discussion, createdAt: discussion.createdAt.toISOString(), reponses: [], supprimable: true } }, { status: 201 })
  } catch (e) { return reponseErreurEncyclopedie(e) }
}
