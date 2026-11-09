import prisma from "@/lib/prisma"
import { abonnementsActifs } from "./serveur"
import { traiterEvenement, synchroniserAbonnement, paiementsDisponibles } from "./stripe"
let enCours = false
/** File bornée, sans contenu personnel ni doublon de prélèvement. */
export async function reconcilierAbonnements() {
  if (enCours || !abonnementsActifs() || !paiementsDisponibles()) return
  enCours = true
  try {
    const evenements = await prisma.evenementAbonnement.findMany({ where: { traiteLe: null, tentatives: { lt: 20 } }, select: { id: true }, orderBy: { recuLe: "asc" }, take: 10 })
    for (const e of evenements) {
      try { await traiterEvenement(e.id) } catch { console.warn("[abonnement] Un événement de paiement attend une nouvelle tentative.") }
    }
    const contrats = await prisma.abonnementGleba.findMany({ where: { abonnementStripeId: { not: null }, gratuitAVie: false }, select: { abonnementStripeId: true }, orderBy: { updatedAt: "asc" }, take: 25 })
    for (const c of contrats) {
      try { await synchroniserAbonnement(c.abonnementStripeId!) } catch { console.warn("[abonnement] Une réconciliation reste en attente.") }
    }
  } finally { enCours = false }
}
