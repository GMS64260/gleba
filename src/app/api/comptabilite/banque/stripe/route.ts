import { NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import { preparerConnexionStripe } from '@/lib/comptabilite/banque/stripe-oauth'
import { ErreurReglement } from '@/lib/comptabilite/monnaie'
export async function POST() {
  const { session, error } = await requireAuthApi()
  if (error) return error
  if (
    !session.user.estProprietaireExploitation ||
    !session.user.peutEcrireExploitation ||
    session.user.impersonatedBy
  )
    return NextResponse.json({ error: 'Connexion réservée au propriétaire.' }, { status: 403 })
  try {
    return NextResponse.json(await preparerConnexionStripe(session.user.id, session.user.acteurId))
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof ErreurReglement ? e.message : 'Connexion indisponible.' },
      { status: e instanceof ErreurReglement ? e.status : 500 },
    )
  }
}
