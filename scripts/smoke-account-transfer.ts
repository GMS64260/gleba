/**
 * Smoke test (LECTURE SEULE) du moteur de transfert de compte.
 *
 * - Valide la classification des modèles et l'ordre topologique d'import
 *   (aucune écriture en base).
 * - Exporte le compte démo synthétique et affiche les volumes par module
 *   (lecture seule). Cela exerce toutes les requêtes d'export sur l'ensemble
 *   des modèles d'un compte réellement peuplé.
 *
 * Usage : node --import tsx -r tsconfig-paths/register scripts/smoke-account-transfer.ts
 */

import prisma from "@/lib/prisma"
import { exportAccount, describeManifest, isValidExportPayload } from "@/lib/account-transfer"

async function main() {
  console.log("== Smoke test account-transfer (lecture seule) ==\n")

  // 1) Classification + ordre topologique (sans base)
  const { byClass, order, violations } = describeManifest()
  console.log(
    `Classification : ${byClass.referential.length} référentiels, ` +
      `${byClass.owned.length} owned, ${byClass.child.length} enfants, ` +
      `${byClass.excluded.length} exclus.`,
  )
  console.log(`Enfants migrés : ${byClass.child.join(", ") || "(aucun)"}`)
  console.log(`Ordre d'import : ${order.length} modèles dynamiques.`)
  if (violations.length) {
    console.log("⚠️  Violations d'ordre topologique :")
    for (const v of violations) console.log("   - " + v)
  } else {
    console.log("✓ Ordre topologique valide (aucun enfant avant son parent).")
  }

  // 2) Export du compte démo (lecture seule)
  const demo = await prisma.user.findFirst({ where: { email: "demo@gleba.fr" } })
  if (!demo) {
    console.log("\nCompte démo introuvable — export sauté.")
    return
  }
  const exported = await exportAccount(demo.id, "smoke")
  const nonEmpty = Object.entries(exported.stats)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
  console.log(`\nExport démo OK — ${nonEmpty.length} modèles non vides :`)
  for (const [model, n] of nonEmpty) console.log(`   ${model.padEnd(24)} ${n}`)

  const json = JSON.stringify(exported)
  console.log(`\nTaille JSON : ${(json.length / 1024).toFixed(1)} Ko`)
  console.log(`Payload valide (schéma attendu) : ${isValidExportPayload(JSON.parse(json))}`)

  // 3) Sanity : les modules majeurs présents dans le seed démo doivent être exportés
  const expect = ["Culture", "Recolte", "Arbre", "Animal", "Planche"]
  const present = expect.filter((m) => (exported.stats[m] ?? 0) > 0)
  console.log(`\nModules majeurs exportés : ${present.join(", ") || "(aucun)"}`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error("SMOKE TEST FAILED:", e)
    await prisma.$disconnect()
    process.exit(1)
  })
