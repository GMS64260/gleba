/**
 * Reset des données du compte démo (`demo@gleba.fr`).
 *
 * Supprime en cascade contrôlée toutes les données métier du compte démo,
 * SANS supprimer l'utilisateur lui-même. À utiliser AVANT `seed-demo.ts`
 * pour repartir d'un état propre.
 *
 * Usage :
 *   npx tsx prisma/reset-demo.ts
 *
 * Voir `docs/demo-scenario.md` pour le scénario qui doit être reconstruit.
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const DEMO_EMAIL = "demo@gleba.fr"

async function main() {
  const user = await prisma.user.findUnique({ where: { email: DEMO_EMAIL } })
  if (!user) {
    console.log(`ℹ Aucun compte démo trouvé pour ${DEMO_EMAIL} — rien à supprimer.`)
    return
  }
  const userId = user.id
  console.log(`▶ Reset des données pour userId=${userId} (${DEMO_EMAIL})`)

  // Ordre : feuilles → racines (enfants supprimés avant parents).
  // Chaque étape est enveloppée pour signaler les éventuels modèles absents.
  const steps: Array<[string, () => Promise<unknown>]> = [
    // ── Boutique en ligne ──────────────────────────────────────────────
    [
      "LigneCommandeBoutique",
      () =>
        prisma.ligneCommandeBoutique.deleteMany({
          where: { commande: { userId } },
        }),
    ],
    ["CommandeBoutique", () => prisma.commandeBoutique.deleteMany({ where: { userId } })],
    ["ProduitBoutique", () => prisma.produitBoutique.deleteMany({ where: { userId } })],
    ["Boutique", () => prisma.boutique.deleteMany({ where: { userId } })],

    // ── Comptabilité ───────────────────────────────────────────────────
    ["LigneFacture", () => prisma.ligneFacture.deleteMany({ where: { facture: { userId } } })],
    ["Facture", () => prisma.facture.deleteMany({ where: { userId } })],
    ["VenteManuelle", () => prisma.venteManuelle.deleteMany({ where: { userId } })],
    ["DepenseManuelle", () => prisma.depenseManuelle.deleteMany({ where: { userId } })],
    ["Client", () => prisma.client.deleteMany({ where: { userId } })],

    // ── Élevage ────────────────────────────────────────────────────────
    ["NaissanceAnimale", () => prisma.naissanceAnimale.deleteMany({ where: { userId } })],
    ["SoinAnimal", () => prisma.soinAnimal.deleteMany({ where: { userId } })],
    ["ConsommationAliment", () => prisma.consommationAliment.deleteMany({ where: { userId } })],
    ["Abattage", () => prisma.abattage.deleteMany({ where: { userId } })],
    ["VenteProduit", () => prisma.venteProduit.deleteMany({ where: { userId } })],
    ["ProductionOeuf", () => prisma.productionOeuf.deleteMany({ where: { userId } })],
    ["Animal", () => prisma.animal.deleteMany({ where: { userId } })],
    ["LotAnimaux", () => prisma.lotAnimaux.deleteMany({ where: { userId } })],

    // ── Verger ─────────────────────────────────────────────────────────
    [
      "ObservationCampagne",
      () => prisma.observationCampagne.deleteMany({ where: { userId } }),
    ],
    ["EtapeCampagne", () => prisma.etapeCampagne.deleteMany({ where: { userId } })],
    [
      "CampagnePlantation",
      () => prisma.campagnePlantation.deleteMany({ where: { userId } }),
    ],
    ["ObservationSante", () => prisma.observationSante.deleteMany({ where: { userId } })],
    [
      "PollinisationArbre",
      () =>
        prisma.pollinisationArbre.deleteMany({
          where: {
            OR: [
              { arbrePollinise: { userId } },
              { arbrePollinisateur: { userId } },
            ],
          },
        }),
    ],
    ["OperationArbre", () => prisma.operationArbre.deleteMany({ where: { userId } })],
    ["ProductionBois", () => prisma.productionBois.deleteMany({ where: { userId } })],
    ["RecolteArbre", () => prisma.recolteArbre.deleteMany({ where: { userId } })],
    ["ZoneVerger", () => prisma.zoneVerger.deleteMany({ where: { userId } })],
    ["Arbre", () => prisma.arbre.deleteMany({ where: { userId } })],

    // ── Maraîchage ─────────────────────────────────────────────────────
    ["Fertilisation", () => prisma.fertilisation.deleteMany({ where: { userId } })],
    ["Consommation", () => prisma.consommation.deleteMany({ where: { userId } })],
    [
      "IrrigationPlanifiee",
      () => prisma.irrigationPlanifiee.deleteMany({ where: { userId } }),
    ],
    ["Recolte", () => prisma.recolte.deleteMany({ where: { userId } })],
    ["Culture", () => prisma.culture.deleteMany({ where: { userId } })],
    ["AnalyseSol", () => prisma.analyseSol.deleteMany({ where: { userId } })],
    ["ObjetJardin", () => prisma.objetJardin.deleteMany({ where: { userId } })],
    ["Note", () => prisma.note.deleteMany({ where: { userId } })],
    ["Planche", () => prisma.planche.deleteMany({ where: { userId } })],
    ["ParcelleGeo", () => prisma.parcelleGeo.deleteMany({ where: { userId } })],

    // ── Stocks utilisateur ─────────────────────────────────────────────
    ["UserStockVariete", () => prisma.userStockVariete.deleteMany({ where: { userId } })],
    [
      "UserStockFertilisant",
      () => prisma.userStockFertilisant.deleteMany({ where: { userId } }),
    ],
    ["UserStockAliment", () => prisma.userStockAliment.deleteMany({ where: { userId } })],
    ["UserStockEspece", () => prisma.userStockEspece.deleteMany({ where: { userId } })],

    // ── Traçabilité & divers ───────────────────────────────────────────
    ["Intervention", () => prisma.intervention.deleteMany({ where: { userId } })],
    [
      "ChatMessage",
      () =>
        prisma.chatMessage.deleteMany({
          where: { conversation: { userId } },
        }),
    ],
    ["Conversation", () => prisma.conversation.deleteMany({ where: { userId } })],
    ["StationMeteo", () => prisma.stationMeteo.deleteMany({ where: { userId } })],
    ["UserPreference", () => prisma.userPreference.deleteMany({ where: { userId } })],

    // ── Auth & sessions (on garde l'utilisateur lui-même) ───────────────
    ["Session", () => prisma.session.deleteMany({ where: { userId } })],
    ["LoginLog", () => prisma.loginLog.deleteMany({ where: { userId } })],
  ]

  for (const [name, fn] of steps) {
    try {
      const res = (await fn()) as { count?: number }
      const count = res?.count ?? 0
      if (count > 0) console.log(`  ✓ ${name}: ${count} ligne(s) supprimée(s)`)
    } catch (err) {
      console.error(`  ✗ ${name}: ${(err as Error).message}`)
    }
  }

  console.log("✅ Reset terminé. Lancez `npx tsx prisma/seed-demo.ts` pour repeupler.")
}

main()
  .catch((e) => {
    console.error("Erreur fatale :", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
