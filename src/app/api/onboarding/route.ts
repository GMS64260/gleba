/**
 * API État onboarding (PROMPT 22 §1).
 *
 * GET   → { completed: boolean }
 * POST  → marque onboarding_completed=true (idempotent)
 *
 * Stocké dans UserPreference (key: 'onboarding_completed', value: 'true'|'false').
 *
 * Piège corrigé le 2026-08-26 (compte réel inscrit le 2026-08-17). Seule la
 * porte de sortie du wizard écrivait ce drapeau : qui quittait le parcours par
 * la navigation ne marquait RIEN, et `OnboardingRedirect` le renvoyait sur
 * `/onboarding` à CHAQUE chargement complet. Un compte a ainsi travaillé une
 * après-midi (parcelles, planches, fond de plan) puis n'a plus rien saisi en
 * deux visites, repoussé sur le wizard à chaque ouverture.
 *
 * La règle est désormais : une saisie réelle vaut sortie d'onboarding. Le GET
 * scelle donc le drapeau dès que le compte porte de la donnée d'exploitation.
 * Ordre des questions, qui compte :
 *   1. drapeau déjà posé → terminé, aucune requête de plus ;
 *   2. wizard COMMENCÉ et non fini (`onboardingEtape` persisté à chaque
 *      « Suivant ») → on le laisse reprendre la main, c'est un choix explicite ;
 *   3. sinon, données présentes → l'utilisateur travaille hors wizard, on scelle.
 * Un compte neuf ne remplit aucune des trois : il voit le parcours, une fois.
 */

import { NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import { refusSiLectureSeule } from '@/lib/exploitation/garde-session'
import prisma from '@/lib/prisma'

const KEY = 'onboarding_completed'
/** Étape courante du wizard (id texte depuis la refonte, index numérique avant). */
const CLES_ETAPE = ['onboardingEtape', 'onboardingStep'] as const

/**
 * Le compte porte-t-il de la donnée d'exploitation ? Un seul enregistrement
 * suffit : la question est « a-t-il déjà saisi quelque chose », pas « combien ».
 * Les huit tables couvrent les trois modules, et chacune est indexée sur
 * `user_id`. Ces requêtes ne s'exécutent que tant que le drapeau est absent.
 */
async function aDejaSaisiDesDonnees(userId: string): Promise<boolean> {
  const premier = { where: { userId }, select: { id: true } } as const
  const trouves = await Promise.all([
    prisma.planche.findFirst(premier),
    prisma.parcelleGeo.findFirst(premier),
    prisma.culture.findFirst(premier),
    prisma.recolte.findFirst(premier),
    prisma.arbre.findFirst(premier),
    prisma.animal.findFirst(premier),
    prisma.objetJardin.findFirst(premier),
    prisma.note.findFirst(premier),
  ])
  return trouves.some(Boolean)
}

export async function GET() {
  const { session, error } = await requireAuthApi()
  if (error) return error

  const userId = session.user.id
  const prefs = await prisma.userPreference.findMany({
    where: { userId, key: { in: [KEY, ...CLES_ETAPE] } },
    select: { key: true, value: true },
  })

  if (prefs.find((p) => p.key === KEY)?.value === 'true') {
    return NextResponse.json({ completed: true })
  }

  // Wizard entamé : le reprendre là où il s'est arrêté reste le comportement
  // voulu. On ne scelle pas à sa place.
  if (prefs.some((p) => (CLES_ETAPE as readonly string[]).includes(p.key))) {
    return NextResponse.json({ completed: false })
  }

  if (!(await aDejaSaisiDesDonnees(userId))) {
    return NextResponse.json({ completed: false })
  }

  // Sceller, sinon la redirection revient au prochain chargement complet. Une
  // consultation admin et un membre en lecture seule n'écrivent rien : la
  // réponse reste juste, seule la persistance attend un acteur qui peut écrire.
  if (!session.user.impersonatedBy && session.user.peutEcrireExploitation) {
    await prisma.userPreference
      .upsert({
        where: { userId_key: { userId, key: KEY } },
        create: { userId, key: KEY, value: 'true' },
        update: { value: 'true' },
      })
      .catch((err) => {
        // Non bloquant : la réponse vaut, on retentera au prochain passage.
        console.error('GET /api/onboarding — scellement impossible:', err)
      })
  }

  return NextResponse.json({ completed: true })
}

export async function POST() {
  const { session, error } = await requireAuthApi()
  if (error) return error
  const refus = refusSiLectureSeule(session)
  if (refus) return refus

  await prisma.userPreference.upsert({
    where: { userId_key: { userId: session.user.id, key: KEY } },
    create: { userId: session.user.id, key: KEY, value: 'true' },
    update: { value: 'true' },
  })
  return NextResponse.json({ completed: true })
}
