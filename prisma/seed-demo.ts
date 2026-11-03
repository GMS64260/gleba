/**
 * Compte démo « Ferme du Bois Joli » — scénario v3 (docs/demo-scenario.md).
 *
 * Deux usages :
 * 1. Au démarrage du conteneur (`docker-entrypoint.sh`) : remet le nom, le mot
 *    de passe et l'activation du compte, puis s'arrête si la ferme existe
 *    déjà. Ce chemin n'importe RIEN d'autre que Prisma et bcrypt : un module
 *    métier absent de l'image ne doit jamais empêcher la remise du compte.
 * 2. Après `prisma/reset-demo.ts` : construit toute la ferme (prisma/demo/).
 *
 * Calendrier réel : chaque culture, mise-bas ou récolte est posée à sa vraie
 * date de saison ; seul son état dépend du jour du reseed. Le relancer suffit
 * à rafraîchir la démo, quel que soit le mois.
 *
 * Usage : `npx tsx prisma/seed-demo.ts`
 * Autre compte : DEMO_EMAIL_OVERRIDE=<adresse> (nom et mot de passe intacts).
 */

import { PrismaClient } from "@prisma/client"
import * as bcrypt from "bcryptjs"

const prisma = new PrismaClient()

const DEMO_EMAIL = process.env.DEMO_EMAIL_OVERRIDE || "demo@gleba.fr"
const DEMO_PASSWORD = process.env.DEMO_PASSWORD_OVERRIDE || "demo2026"
const DEMO_NAME = process.env.DEMO_NAME_OVERRIDE || "Ferme du Bois Joli"
const IS_CLONE = Boolean(process.env.DEMO_EMAIL_OVERRIDE)

async function ensureUser() {
  const hashed = await bcrypt.hash(DEMO_PASSWORD, 12)
  return prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: IS_CLONE ? { active: true } : { name: DEMO_NAME, password: hashed, active: true, emailVerified: true },
    create: { email: DEMO_EMAIL, password: hashed, name: DEMO_NAME, role: "USER", active: true, emailVerified: true },
  })
}

async function main() {
  const user = await ensureUser()
  console.log(`✓ Compte ${user.email} prêt`)

  const planches = await prisma.planche.count({ where: { userId: user.id } })
  if (planches > 0) {
    console.log(`ℹ La ferme existe déjà (${planches} planches). Pour la reconstruire : npx tsx prisma/reset-demo.ts puis ce script.`)
    return
  }

  const debut = Date.now()
  const { seedFerme } = await import("./demo/index")
  await seedFerme({ userId: user.id, clone: IS_CLONE })
  console.log(`✅ Ferme construite en ${Math.round((Date.now() - debut) / 1000)} s. Vérifier : npx tsx prisma/verify-demo.ts`)
}

main()
  .catch((err) => { console.error("❌ Erreur seed :", err); process.exit(1) })
  .finally(async () => {
    await prisma.$disconnect()
    const { prisma: prismaApp } = await import("../src/lib/prisma").catch(() => ({ prisma: null }))
    await prismaApp?.$disconnect()
  })
