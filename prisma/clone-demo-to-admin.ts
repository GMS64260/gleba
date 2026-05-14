/**
 * Clone les données démo (scenario "Ferme du Bois Joli") sur le compte
 * admin@gleba.fr. Réutilise les fonctions exportées de seed-demo.ts.
 *
 * Étapes :
 *  1. Vide les données du compte target (admin@gleba.fr) — recopie de
 *     reset-demo.ts mais sur le bon userId.
 *  2. Réexécute le scenario démo en pointant sur l'userId target.
 *
 * Usage : npx tsx prisma/clone-demo-to-admin.ts
 */

import { PrismaClient } from "@prisma/client"

const TARGET_EMAIL = "admin@gleba.fr"

const prisma = new PrismaClient()

async function purgeUserData(userId: string) {
  console.log(`▶ Purge des données pour userId=${userId}`)
  // Recopie identique de reset-demo.ts (ordre feuilles → racines).
  const steps: Array<[string, () => Promise<unknown>]> = [
    ["LigneCommandeBoutique", () => prisma.ligneCommandeBoutique.deleteMany({ where: { commande: { userId } } })],
    ["CommandeBoutique", () => prisma.commandeBoutique.deleteMany({ where: { userId } })],
    ["ProduitBoutique", () => prisma.produitBoutique.deleteMany({ where: { userId } })],
    ["Boutique", () => prisma.boutique.deleteMany({ where: { userId } })],
    ["LigneFacture", () => prisma.ligneFacture.deleteMany({ where: { facture: { userId } } })],
    ["Facture", () => prisma.facture.deleteMany({ where: { userId } })],
    ["VenteManuelle", () => prisma.venteManuelle.deleteMany({ where: { userId } })],
    ["DepenseManuelle", () => prisma.depenseManuelle.deleteMany({ where: { userId } })],
    ["Client", () => prisma.client.deleteMany({ where: { userId } })],
    ["NaissanceAnimale", () => prisma.naissanceAnimale.deleteMany({ where: { userId } })],
    ["SoinAnimal", () => prisma.soinAnimal.deleteMany({ where: { userId } })],
    ["ConsommationAliment", () => prisma.consommationAliment.deleteMany({ where: { userId } })],
    ["Abattage", () => prisma.abattage.deleteMany({ where: { userId } })],
    ["VenteProduit", () => prisma.venteProduit.deleteMany({ where: { userId } })],
    ["ProductionOeuf", () => prisma.productionOeuf.deleteMany({ where: { userId } })],
    ["Animal", () => prisma.animal.deleteMany({ where: { userId } })],
    ["LotAnimaux", () => prisma.lotAnimaux.deleteMany({ where: { userId } })],
    ["ObservationCampagne", () => prisma.observationCampagne.deleteMany({ where: { userId } })],
    ["EtapeCampagne", () => prisma.etapeCampagne.deleteMany({ where: { userId } })],
    ["CampagnePlantation", () => prisma.campagnePlantation.deleteMany({ where: { userId } })],
    ["ObservationSante", () => prisma.observationSante.deleteMany({ where: { userId } })],
    ["PollinisationArbre", () => prisma.pollinisationArbre.deleteMany({
      where: {
        OR: [{ arbrePollinise: { userId } }, { arbrePollinisateur: { userId } }],
      },
    })],
    ["OperationArbre", () => prisma.operationArbre.deleteMany({ where: { userId } })],
    ["ProductionBois", () => prisma.productionBois.deleteMany({ where: { userId } })],
    ["RecolteArbre", () => prisma.recolteArbre.deleteMany({ where: { userId } })],
    ["ZoneVerger", () => prisma.zoneVerger.deleteMany({ where: { userId } })],
    ["Arbre", () => prisma.arbre.deleteMany({ where: { userId } })],
    ["Fertilisation", () => prisma.fertilisation.deleteMany({ where: { userId } })],
    ["Consommation", () => prisma.consommation.deleteMany({ where: { userId } })],
    ["IrrigationPlanifiee", () => prisma.irrigationPlanifiee.deleteMany({ where: { userId } })],
    ["Recolte", () => prisma.recolte.deleteMany({ where: { userId } })],
    ["Culture", () => prisma.culture.deleteMany({ where: { userId } })],
    ["AnalyseSol", () => prisma.analyseSol.deleteMany({ where: { userId } })],
    ["ObjetJardin", () => prisma.objetJardin.deleteMany({ where: { userId } })],
    ["Note", () => prisma.note.deleteMany({ where: { userId } })],
    ["Planche", () => prisma.planche.deleteMany({ where: { userId } })],
    ["ParcelleGeo", () => prisma.parcelleGeo.deleteMany({ where: { userId } })],
    ["UserStockVariete", () => prisma.userStockVariete.deleteMany({ where: { userId } })],
    ["UserStockFertilisant", () => prisma.userStockFertilisant.deleteMany({ where: { userId } })],
    ["UserStockAliment", () => prisma.userStockAliment.deleteMany({ where: { userId } })],
    ["UserStockEspece", () => prisma.userStockEspece.deleteMany({ where: { userId } })],
    ["Intervention", () => prisma.intervention.deleteMany({ where: { userId } })],
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
}

async function main() {
  const targetUser = await prisma.user.findUnique({ where: { email: TARGET_EMAIL } })
  if (!targetUser) {
    console.error(`✗ Compte cible ${TARGET_EMAIL} introuvable.`)
    process.exit(1)
  }
  console.log(`▶ Clone démo → ${TARGET_EMAIL} (id=${targetUser.id})`)

  // 1) Purge
  await purgeUserData(targetUser.id)

  // 2) Réexécute la logique de seed-demo en pointant sur l'admin.
  // On importe dynamiquement seed-demo et on appelle ses fonctions avec
  // l'admin userId. Le seed-demo.ts garde sa main() qui reste pour le démo
  // original ; on appelle directement ses helpers exportés ou on duplique
  // le main avec un user override.
  //
  // Comme seed-demo.ts n'exporte pas ses helpers, on duplique son main ici
  // en remplaçant l'appel ensureUser() par notre targetUser.

  // Avant : importer toutes les helpers seed-demo. Comme elles ne sont pas
  // exportées, on les ré-exporte (cf. patch séparé dans seed-demo.ts ou
  // on utilise child_process pour relancer seed-demo en surchargeant
  // DEMO_EMAIL via env). Approche env :
  //   DEMO_EMAIL_OVERRIDE=admin@gleba.fr npx tsx prisma/seed-demo.ts
  //
  // Pour l'instant on lance le seed via exec child_process.
  const { spawn } = await import("node:child_process")
  console.log(`▶ Lancement du seed-demo en pointant sur ${TARGET_EMAIL}…`)
  const child = spawn("npx", ["tsx", "prisma/seed-demo.ts"], {
    env: { ...process.env, DEMO_EMAIL_OVERRIDE: TARGET_EMAIL },
    stdio: "inherit",
  })
  await new Promise<void>((resolve, reject) => {
    child.on("exit", (code) => (code === 0 ? resolve() : reject(new Error(`seed-demo exited ${code}`))))
    child.on("error", reject)
  })
  console.log(`✅ Clone démo terminé sur ${TARGET_EMAIL}`)
}

main()
  .catch((e) => {
    console.error("Erreur fatale :", e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
