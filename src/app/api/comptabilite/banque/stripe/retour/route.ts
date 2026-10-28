import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import { retourBanqueStripe, terminerConnexionStripe } from '@/lib/comptabilite/banque/stripe-oauth'
export async function GET(request: NextRequest) {
  const { session, error } = await requireAuthApi()
  if (error) return error
  if (
    !session.user.estProprietaireExploitation ||
    !session.user.peutEcrireExploitation ||
    session.user.impersonatedBy
  )
    return NextResponse.json({ error: 'Connexion réservée au propriétaire.' }, { status: 403 })
  try {
    await terminerConnexionStripe(
      session.user.id,
      session.user.acteurId,
      request.nextUrl.searchParams.get('state') || '',
      request.nextUrl.searchParams.get('code') || '',
    )
    return NextResponse.redirect(retourBanqueStripe('connecte'))
  } catch {
    return NextResponse.redirect(retourBanqueStripe('echec'))
  }
}
