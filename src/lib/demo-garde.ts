/**
 * Garde SERVEUR du compte de démonstration partagé.
 *
 * `src/lib/demo.ts` reste pur (importé par le middleware, compatible Edge) :
 * ce module-ci lit la base, il ne doit donc jamais être importé par `auth.ts`
 * ni par le middleware.
 *
 * Règle (2026-09-09 pour les préférences, étendue le 2026-10-19) : le compte de
 * démonstration est PARTAGÉ par tous les visiteurs, avec des identifiants
 * publics. Tout geste qui engage le compte entier (réglages, vider les données,
 * supprimer le compte, importer par-dessus, changer le mot de passe) est refusé
 * en 403 explicite, jamais en silence : un no-op laisserait croire le geste
 * accompli. Avant, n'importe quel visiteur pouvait vider la démo pour le suivant.
 *
 * L'identité se lit en base par l'id, comme `linkAccount` (auth.ts) protège ce
 * compte : la session ne porte pas l'adresse de façon fiable côté serveur.
 */

import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { estEmailDemo } from "@/lib/demo"

export { MESSAGES_REFUS_DEMO } from "@/lib/demo"

/** Vrai si l'utilisateur `userId` est le compte de démonstration partagé. */
export async function estCompteDemo(userId: string): Promise<boolean> {
  const compte = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  })
  return estEmailDemo(compte?.email)
}

/**
 * Refus en 403 si `userId` est le compte de démonstration, sinon `null`.
 * `code: "COMPTE_DEMO"` permet à un écran de reconnaître ce refus sans lire le
 * texte.
 */
export async function refusSiCompteDemo(
  userId: string,
  message: string,
  headers?: HeadersInit,
): Promise<NextResponse | null> {
  if (!(await estCompteDemo(userId))) return null
  return NextResponse.json(
    { error: message, code: "COMPTE_DEMO" },
    { status: 403, headers },
  )
}
