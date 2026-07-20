/**
 * Nettoyage du seed caprin démo (PROMPT 20-22) — annule seed-caprin-demo.ts.
 * Scopé au compte démo et aux chèvres Alpine. `npx tsx prisma/seed-caprin-demo-clean.ts`
 */
import { PrismaClient } from "@prisma/client"
const prisma = new PrismaClient()
const DEMO_EMAIL = process.env.DEMO_EMAIL_OVERRIDE || "demo@gleba.fr"

async function main() {
  const user = await prisma.user.findFirst({ where: { email: DEMO_EMAIL }, select: { id: true } })
  if (!user) return console.log("Compte démo introuvable.")
  const userId = user.id

  const chevres = await prisma.animal.findMany({ where: { userId, especeAnimaleId: "chevre_alpine" }, select: { id: true } })
  const ids = chevres.map((c) => c.id)
  const lot = await prisma.lotAnimaux.findFirst({ where: { userId, nom: "Chèvres laitières 2026" } })
  const lotsFromage = await prisma.lotFromage.findMany({ where: { userId, numeroLot: { startsWith: "L-2026-W" } }, select: { id: true } })
  const lfIds = lotsFromage.map((l) => l.id)

  const ventes = await prisma.venteProduit.deleteMany({
    where: { userId, OR: [{ lotFromageId: { in: lfIds } }, { type: "lait", description: "Lait cru de chèvre" }] },
  })
  const collectes = await prisma.collecteLait.deleteMany({ where: { userId, animalId: { in: ids } } })
  const fromages = await prisma.lotFromage.deleteMany({ where: { id: { in: lfIds } } })
  const naiss = await prisma.naissanceAnimale.deleteMany({ where: { userId, mereId: { in: ids } } })
  const saillies = await prisma.saillie.deleteMany({ where: { userId, femelleId: { in: ids } } })
  if (lot) {
    await prisma.consommationAliment.deleteMany({ where: { userId, lotId: lot.id } })
    await prisma.animal.updateMany({ where: { id: { in: ids } }, data: { lotId: null } })
    await prisma.lotAnimaux.delete({ where: { id: lot.id } })
  }
  await prisma.aliment.deleteMany({ where: { id: { in: ["foin_prairie_demo", "granules_chevre_demo"] } } }).catch(() => {})

  console.log(`Nettoyé : ${ventes.count} ventes, ${collectes.count} collectes, ${fromages.count} lots fromage, ${naiss.count} naissances, ${saillies.count} saillies, lot ${lot ? "supprimé" : "absent"}.`)
}
main().catch((e) => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
