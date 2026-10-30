import { NextRequest, NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import { retourBanqueStripe, terminerConnexionStripe } from '@/lib/comptabilite/banque/stripe-oauth'
import { ErreurStripeActifAilleurs } from '@/lib/comptabilite/banque/stripe'
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
  } catch (e) {
    // Revue du 2026-10-30 : compte actif dans une autre exploitation, refus
    // dédié pour que l'écran en donne la raison au lieu d'un échec générique.
    return NextResponse.redirect(
      retourBanqueStripe(e instanceof ErreurStripeActifAilleurs ? 'deja-active' : 'echec'),
    )
  }
}
