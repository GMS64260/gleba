import { headers } from "next/headers"
import { NextResponse } from "next/server"
import prisma from "@/lib/prisma"
import { estEmailDemo } from "@/lib/demo"
import { calculerAcces, accesComplet, finEssai, aCapacite, type AccesService, type Capacite } from "./politique"
import { ENTETE_CHEMIN, ENTETE_METHODE, operationPermise } from "./requetes"

/** Désactivé par défaut dans les instances auto-hébergées et tant que le lot n'est pas activé. */
export function abonnementsActifs() { return process.env.GLEBA_ABONNEMENTS_ACTIFS === "true" }
export async function chargerAccesService(userId: string): Promise<AccesService> {
  if (!abonnementsActifs()) return accesComplet("libre")
  const [user, abonnement] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true, email: true } }),
    prisma.abonnementGleba.findUnique({ where: { userId } }),
  ])
  if (!user) throw new Error("Exploitation inconnue")
  if (estEmailDemo(user.email)) return accesComplet("gratuit-vie")
  return calculerAcces(user.createdAt, abonnement)
}
export async function serviceAutorise(userId: string, capacite: Capacite): Promise<boolean> {
  return aCapacite(await chargerAccesService(userId), capacite)
}
export class AccesServiceRefuse extends Error {
  readonly code = "FORMULE_INSUFFISANTE"
  readonly status = 403
  constructor() { super("Cette fonction n’est pas comprise dans votre accès. Retrouvez vos droits dans Paramètres > Abonnement.") }
}
export async function exigerCapacite(userId: string, capacite: Capacite): Promise<void> {
  if (!await serviceAutorise(userId, capacite)) throw new AccesServiceRefuse()
}
export async function refusAbonnementApi(userId: string, request?: Request): Promise<NextResponse | null> {
  if (!abonnementsActifs()) return null
  let chemin: string | null = null
  let methode: string | null = null
  if (request) { chemin = new URL(request.url).pathname; methode = request.method }
  else {
    const h = await headers()
    chemin = h.get(ENTETE_CHEMIN)
    methode = h.get(ENTETE_METHODE)
  }
  // En mode commercial, l'absence de contexte HTTP n'est jamais une permission.
  if (!chemin || !methode) return NextResponse.json({ error: "Contexte de requête indisponible. Actualisez puis réessayez.", code: "CONTEXTE_ABONNEMENT" }, { status: 503 })
  const acces = await chargerAccesService(userId)
  if (operationPermise(acces, chemin, methode)) return null
  return NextResponse.json({ error: new AccesServiceRefuse().message, code: "FORMULE_INSUFFISANTE", abonnementUrl: "/parametres?section=abonnement" }, { status: 403 })
}
export async function demarrerEssai(userId: string) {
  if (!abonnementsActifs()) throw new Error("Le service d’abonnement n’est pas activé sur cette instance.")
  const acces = await chargerAccesService(userId)
  if (acces.etat === "gratuit-vie") return acces
  const maintenant = new Date()
  await prisma.abonnementGleba.createMany({ data: [{ userId, essaiDebut: maintenant, essaiFin: finEssai(maintenant) }], skipDuplicates: true })
  // compare-and-set : deux clics concurrents ne déplacent jamais la date initiale.
  await prisma.abonnementGleba.updateMany({ where: { userId, essaiDebut: null, gratuitAVie: false }, data: { essaiDebut: maintenant, essaiFin: finEssai(maintenant) } })
  return chargerAccesService(userId)
}
