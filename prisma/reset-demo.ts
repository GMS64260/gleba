/**
 * Reset EXHAUSTIF des données du compte démo (`demo@gleba.fr`).
 *
 * Supprime, en cascade contrôlée (feuilles → racines), TOUTES les données
 * métier du compte démo — SANS supprimer l'utilisateur. Couvre les modules
 * récents (caprin laitier : collectes/fromages/saillies/campagnes ; fonds de
 * plan ; factures ; exploitation) ainsi que le référentiel PERSO créé par les
 * testeurs sur le compte démo (espèces/variétés/ITP polluées).
 *
 * À lancer AVANT `prisma/seed-demo.ts`. Usage : `npx tsx prisma/reset-demo.ts`
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const DEMO_EMAIL = process.env.DEMO_EMAIL_OVERRIDE || "demo@gleba.fr"

async function main() {
  const user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } })
  if (!user) {
    console.log(`ℹ Aucun compte démo ${DEMO_EMAIL} — rien à supprimer.`)
    return
  }
  const userId = user.id
  console.log(`▶ Reset exhaustif pour userId=${userId} (${DEMO_EMAIL})`)

  const dm = (p: Promise<{ count: number }>) => p
  const steps: Array<[string, () => Promise<{ count: number }>]> = [
    // ── Boutique ────────────────────────────────────────────────────────
    ["LigneCommandeBoutique", () => dm(prisma.ligneCommandeBoutique.deleteMany({ where: { commande: { userId } } }))],
    ["CommandeBoutique", () => dm(prisma.commandeBoutique.deleteMany({ where: { userId } }))],
    ["ProduitBoutique", () => dm(prisma.produitBoutique.deleteMany({ where: { userId } }))],
    ["Boutique", () => dm(prisma.boutique.deleteMany({ where: { userId } }))],

    // ── Comptabilité ────────────────────────────────────────────────────
    ["LigneFacture", () => dm(prisma.ligneFacture.deleteMany({ where: { facture: { userId } } }))],
    ["Facture", () => dm(prisma.facture.deleteMany({ where: { userId } }))],
    ["VenteManuelle", () => dm(prisma.venteManuelle.deleteMany({ where: { userId } }))],
    ["DepenseManuelle", () => dm(prisma.depenseManuelle.deleteMany({ where: { userId } }))],
    ["Client", () => dm(prisma.client.deleteMany({ where: { userId } }))],

    // ── Élevage : lait & fromagerie ─────────────────────────────────────
    ["CollecteLait", () => dm(prisma.collecteLait.deleteMany({ where: { userId } }))],
    ["SequenceLotFromage", () => dm(prisma.sequenceLotFromage.deleteMany({ where: { userId } }))],
    ["LotFromage", () => dm(prisma.lotFromage.deleteMany({ where: { userId } }))],
    // ── Élevage : reproduction ──────────────────────────────────────────
    ["NaissanceAnimale", () => dm(prisma.naissanceAnimale.deleteMany({ where: { userId } }))],
    ["Saillie", () => dm(prisma.saillie.deleteMany({ where: { userId } }))],
    ["CampagneReproduction", () => dm(prisma.campagneReproduction.deleteMany({ where: { userId } }))],
    // ── Élevage : suivi ─────────────────────────────────────────────────
    ["SoinAnimal", () => dm(prisma.soinAnimal.deleteMany({ where: { userId } }))],
    ["ConsommationAliment", () => dm(prisma.consommationAliment.deleteMany({ where: { userId } }))],
    ["Abattage", () => dm(prisma.abattage.deleteMany({ where: { userId } }))],
    ["VenteProduit", () => dm(prisma.venteProduit.deleteMany({ where: { userId } }))],
    ["ProductionOeuf", () => dm(prisma.productionOeuf.deleteMany({ where: { userId } }))],
    ["MouvementCheptel", () => dm(prisma.mouvementCheptel.deleteMany({ where: { userId } }))],
    ["Animal", () => dm(prisma.animal.deleteMany({ where: { userId } }))],
    ["LotAnimaux", () => dm(prisma.lotAnimaux.deleteMany({ where: { userId } }))],

    // ── Verger ──────────────────────────────────────────────────────────
    ["ObservationCampagne", () => dm(prisma.observationCampagne.deleteMany({ where: { userId } }))],
    ["EtapeCampagne", () => dm(prisma.etapeCampagne.deleteMany({ where: { userId } }))],
    ["CampagnePlantation", () => dm(prisma.campagnePlantation.deleteMany({ where: { userId } }))],
    ["PollinisationArbre", () => dm(prisma.pollinisationArbre.deleteMany({ where: { OR: [{ arbrePollinise: { userId } }, { arbrePollinisateur: { userId } }] } }))],
    ["ObservationSante", () => dm(prisma.observationSante.deleteMany({ where: { userId } }))],
    ["OperationArbre", () => dm(prisma.operationArbre.deleteMany({ where: { userId } }))],
    ["ProductionBois", () => dm(prisma.productionBois.deleteMany({ where: { userId } }))],
    ["RecolteArbre", () => dm(prisma.recolteArbre.deleteMany({ where: { userId } }))],
    ["ZoneVerger", () => dm(prisma.zoneVerger.deleteMany({ where: { userId } }))],
    ["Arbre", () => dm(prisma.arbre.deleteMany({ where: { userId } }))],

    // ── Maraîchage ──────────────────────────────────────────────────────
    ["Fertilisation", () => dm(prisma.fertilisation.deleteMany({ where: { userId } }))],
    ["Consommation", () => dm(prisma.consommation.deleteMany({ where: { userId } }))],
    ["IrrigationPlanifiee", () => dm(prisma.irrigationPlanifiee.deleteMany({ where: { userId } }))],
    ["Recolte", () => dm(prisma.recolte.deleteMany({ where: { userId } }))],
    ["Culture", () => dm(prisma.culture.deleteMany({ where: { userId } }))],
    ["AnalyseSol", () => dm(prisma.analyseSol.deleteMany({ where: { userId } }))],
    ["ObjetJardin", () => dm(prisma.objetJardin.deleteMany({ where: { userId } }))],
    ["Note", () => dm(prisma.note.deleteMany({ where: { userId } }))],
    ["Planche", () => dm(prisma.planche.deleteMany({ where: { userId } }))],
    ["FondPlan", () => dm(prisma.fondPlan.deleteMany({ where: { userId } }))],
    ["ParcelleGeo", () => dm(prisma.parcelleGeo.deleteMany({ where: { userId } }))],

    // ── Stocks utilisateur ──────────────────────────────────────────────
    ["UserStockVariete", () => dm(prisma.userStockVariete.deleteMany({ where: { userId } }))],
    ["UserStockFertilisant", () => dm(prisma.userStockFertilisant.deleteMany({ where: { userId } }))],
    ["UserStockAliment", () => dm(prisma.userStockAliment.deleteMany({ where: { userId } }))],
    ["UserStockEspece", () => dm(prisma.userStockEspece.deleteMany({ where: { userId } }))],

    // ── Traçabilité, IA, météo, préférences, exploitation ───────────────
    ["Intervention", () => dm(prisma.intervention.deleteMany({ where: { userId } }))],
    ["ChatMessage", () => dm(prisma.chatMessage.deleteMany({ where: { conversation: { userId } } }))],
    ["Conversation", () => dm(prisma.conversation.deleteMany({ where: { userId } }))],
    ["StationMeteo", () => dm(prisma.stationMeteo.deleteMany({ where: { userId } }))],
    ["UserPreference", () => dm(prisma.userPreference.deleteMany({ where: { userId } }))],
    ["Exploitation", () => dm(prisma.exploitation.deleteMany({ where: { userId } }))],

    // ── Référentiel PERSO créé par les testeurs sur le compte démo ──────
    // (enfants d'abord : variétés/ITP référencent l'espèce)
    ["Variete (perso)", () => dm(prisma.variete.deleteMany({ where: { userId } }))],
    ["ITP (perso)", () => dm(prisma.iTP.deleteMany({ where: { userId } }))],
    ["Espece (perso)", () => dm(prisma.espece.deleteMany({ where: { userId } }))],
    ["RaceAnimale (perso)", () => dm(prisma.raceAnimale.deleteMany({ where: { userId } }))],
    ["EspeceAnimale (perso)", () => dm(prisma.especeAnimale.deleteMany({ where: { userId } }))],

    // ── Auth & sessions (on garde l'utilisateur) ────────────────────────
    ["Session", () => dm(prisma.session.deleteMany({ where: { userId } }))],
    ["LoginLog", () => dm(prisma.loginLog.deleteMany({ where: { userId } }))],
  ]

  for (const [name, fn] of steps) {
    try {
      const res = await fn()
      if (res?.count > 0) console.log(`  ✓ ${name}: ${res.count} ligne(s) supprimée(s)`)
    } catch (err) {
      console.error(`  ✗ ${name}: ${(err as Error).message.split("\n")[0]}`)
    }
  }

  console.log("✅ Reset terminé. Lancez `npx tsx prisma/seed-demo.ts`.")
}

main()
  .catch((e) => { console.error("Erreur fatale :", e); process.exit(1) })
  .finally(() => prisma.$disconnect())
