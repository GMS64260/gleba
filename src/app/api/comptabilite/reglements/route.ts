import { lireJsonBorne } from '@/lib/comptabilite/requete-bornee'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import {
  cibleReglementSchema,
  nouveauReglementSchema,
  annulerReglementSchema,
} from '@/lib/validations/reglements'
import {
  lireReglements,
  enregistrerReglement,
  annulerReglement,
} from '@/lib/comptabilite/reglements'
import { ErreurReglement } from '@/lib/comptabilite/monnaie'
function erreurReponse(e: unknown) {
  if (e instanceof ErreurReglement)
    return NextResponse.json({ error: e.message }, { status: e.status })
  // Ne jamais imprimer une charge bancaire, une clé ou un jeton de connexion.
  return NextResponse.json(
    { error: 'Le règlement n’a pas été enregistré. Actualisez puis réessayez.' },
    { status: 500 },
  )
}
export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const cible = cibleReglementSchema.safeParse(Object.fromEntries(request.nextUrl.searchParams))
  if (!cible.success) return NextResponse.json({ error: 'Pièce invalide' }, { status: 400 })
  try {
    return NextResponse.json(await lireReglements(session.user.id, cible.data))
  } catch (e) {
    return erreurReponse(e)
  }
}
export async function POST(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  if (session.user.peutEcrireExploitation === false || session.user.impersonatedBy)
    return NextResponse.json({ error: 'Cette session est en lecture seule.' }, { status: 403 })
  let donnees: unknown
  try {
    donnees = await lireJsonBorne(request, 16384)
  } catch (e) {
    return erreurReponse(e)
  }
  const entree = nouveauReglementSchema.safeParse(donnees)
  if (!entree.success)
    return NextResponse.json(
      { error: 'Données invalides', details: entree.error.flatten() },
      { status: 400 },
    )
  try {
    return NextResponse.json(
      {
        data: await enregistrerReglement(
          session.user.id,
          session.user.acteurId ?? session.user.id,
          entree.data,
        ),
      },
      { status: 201 },
    )
  } catch (e) {
    return erreurReponse(e)
  }
}
export async function DELETE(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  if (session.user.peutEcrireExploitation === false || session.user.impersonatedBy)
    return NextResponse.json({ error: 'Cette session est en lecture seule.' }, { status: 403 })
  let donnees: unknown
  try {
    donnees = await lireJsonBorne(request, 16384)
  } catch (e) {
    return erreurReponse(e)
  }
  const entree = annulerReglementSchema.safeParse(donnees)
  if (!entree.success)
    return NextResponse.json({ error: 'Motif d’annulation requis.' }, { status: 400 })
  try {
    await annulerReglement(
      session.user.id,
      session.user.acteurId ?? session.user.id,
      entree.data.id,
      entree.data.motif,
    )
    return NextResponse.json({ success: true })
  } catch (e) {
    return erreurReponse(e)
  }
}
