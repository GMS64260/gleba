/**
 * Lecture serveur de la version d'accueil d'une PERSONNE (acteur) : la page
 * `/dashboard` redirige en 307 avant tout rendu, le middleware ne lisant pas
 * la base. Toute panne retombe sur v1, l'accueil historique.
 */

import prisma from "@/lib/prisma"
import { estEmailDemo } from "@/lib/demo"

import {
  CLE_PREFERENCE_ACCUEIL,
  ENV_ACCUEIL_DEMO,
  VERSION_ACCUEIL_DEFAUT,
  versionAccueilEffective,
  type VersionAccueil,
} from "./preference"

export async function lireVersionAccueil(acteurId: string): Promise<VersionAccueil> {
  try {
    const [compte, pref] = await Promise.all([
      prisma.user.findUnique({ where: { id: acteurId }, select: { email: true } }),
      prisma.userPreference.findUnique({
        where: { userId_key: { userId: acteurId, key: CLE_PREFERENCE_ACCUEIL } },
        select: { value: true },
      }),
    ])
    // `/api/user/preferences` stocke une chaîne telle quelle et le reste en
    // JSON : on tente les deux lectures, comme son GET.
    let preference: unknown = pref?.value
    if (pref) {
      try {
        preference = JSON.parse(pref.value)
      } catch {
        preference = pref.value
      }
    }
    return versionAccueilEffective({
      preference,
      estDemo: estEmailDemo(compte?.email),
      accueilDemoEnv: process.env[ENV_ACCUEIL_DEMO],
    })
  } catch (e) {
    console.error("[accueil] version d'accueil illisible, repli v1 :", e)
    return VERSION_ACCUEIL_DEFAUT
  }
}
