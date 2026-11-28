import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import { actionDocumentSchema, contenuDocumentSchema } from '@/lib/commercial/regles'
import { agirSurDocument, modifierDocument, supprimerBrouillon } from '@/lib/commercial/service'
import { erreurCommerciale } from '@/lib/commercial/http'
import { FicheModifieeAilleurs, lireVersionLue } from '@/lib/api/version-fiche'

interface Params { params: Promise<{ id: string }> }

export async function PUT(request: NextRequest, { params }: Params) {
  const { session, error } = await requireAuthApi(request)
  if (error) return error
  try {
    const { id } = await params
    const corps = await request.json()
    // Version de fiche : l'éditeur resté ouvert ne remplace pas un document modifié ailleurs.
    const lecture = lireVersionLue(corps)
    if (!lecture.ok) return NextResponse.json({ error: lecture.erreur }, { status: 400 })
    // Le schéma du contenu est strict : la version n'en fait pas partie.
    const { versionLue: _versionLue, ...contenu } = (corps ?? {}) as Record<string, unknown>
    void _versionLue
    const d = contenuDocumentSchema.parse(contenu)
    return NextResponse.json({ data: await modifierDocument(session.user.id, id, d, lecture.version) })
  } catch (error) { return error instanceof FicheModifieeAilleurs ? error.reponse() : erreurCommerciale(error) }
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { session, error } = await requireAuthApi(request)
  if (error) return error
  try {
    const { id } = await params
    const d = actionDocumentSchema.parse(await request.json())
    return NextResponse.json({ data: await agirSurDocument(session.user.id, id, d.action, d.dateLivraison) })
  } catch (error) { return erreurCommerciale(error) }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  const { session, error } = await requireAuthApi(request)
  if (error) return error
  try {
    await supprimerBrouillon(session.user.id, (await params).id)
    return NextResponse.json({ success: true })
  } catch (error) { return erreurCommerciale(error) }
}
