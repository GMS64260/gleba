import { NextResponse } from 'next/server'
import { ZodError } from 'zod'
import { ErreurCommerciale } from './regles'

export function erreurCommerciale(error: unknown) {
  if (error instanceof ErreurCommerciale) return NextResponse.json({ error: error.message }, { status: error.status })
  if (error instanceof ZodError) return NextResponse.json({ error: error.issues[0]?.message || 'Données invalides', details: error.flatten() }, { status: 400 })
  if (error instanceof SyntaxError) return NextResponse.json({ error: 'Corps JSON invalide' }, { status: 400 })
  console.error('Documents commerciaux : erreur interne', error)
  return NextResponse.json({ error: 'Impossible de traiter ce document. Réessayez après actualisation.' }, { status: 500 })
}
