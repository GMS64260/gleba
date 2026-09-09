/**
 * Restaure le décor du compte de démonstration (2026-09-09).
 *
 * Constat de la relecture du 2026-09-09 : la démo est un compte PARTAGÉ et les
 * gestes des prospects s'y sédimentent. Deux dépôts à effacer :
 *
 *  1. Deux préférences ajoutées par des visiteurs, hors seed :
 *     - `briefingQuotidienAuto` (activée le 06/09 à 11:36:00) — depuis, un
 *       briefing généré à CHAQUE visite, pour des prospects qui n'ont rien
 *       demandé, à raison d'un appel de modèle par briefing ;
 *     - `notifPrefs` tout à `true` (06/09 11:36:08) — les 7 parcelles de la
 *       démo entrent dans le scan météo périodique, ce qui explique le saut des
 *       échecs Open-Meteo (43 le 06/09, puis 92 et 103).
 *     `modulesActifs` est par ailleurs remis dans l'ordre canonique du seed.
 *
 *  2. Les conversations de briefing auto-générées, qui forment désormais
 *     l'essentiel de l'historique d'assistant que voit un prospect.
 *
 * La référence est `ensurePrefs()` de `prisma/seed-demo.ts` : trois clés, pas
 * plus. Ce script ne touche QUE le compte démo et rien d'autre.
 *
 * Usage :
 *   npx tsx scripts/restaurer-decor-demo-20260909.ts            # blanc (rapport seul)
 *   npx tsx scripts/restaurer-decor-demo-20260909.ts --apply    # applique
 *   npx tsx scripts/restaurer-decor-demo-20260909.ts --apply --avec-briefings
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()

const DEMO_EMAIL = process.env.DEMO_EMAIL_OVERRIDE || "demo@gleba.fr"

/** Référence : `ensurePrefs()` de prisma/seed-demo.ts. */
const PREFS_SEED: Record<string, string> = {
  modulesActifs: JSON.stringify(["maraichage", "verger", "elevage", "comptabilite"]),
  modesElevage: JSON.stringify(["compagnie", "equin", "nac"]),
  onboarding_completed: "true",
}

async function main() {
  const apply = process.argv.includes("--apply")
  const avecBriefings = process.argv.includes("--avec-briefings")

  const demo = await prisma.user.findUnique({
    where: { email: DEMO_EMAIL },
    select: { id: true, email: true },
  })
  if (!demo) {
    console.error(`Compte démo introuvable (${DEMO_EMAIL}). Rien fait.`)
    process.exitCode = 1
    return
  }

  const prefs = await prisma.userPreference.findMany({
    where: { userId: demo.id },
    select: { key: true, value: true },
    orderBy: { key: "asc" },
  })

  const aSupprimer = prefs.filter((p) => !(p.key in PREFS_SEED)).map((p) => p.key)
  const aRecaler = Object.entries(PREFS_SEED).filter(([cle, attendu]) => {
    const courante = prefs.find((p) => p.key === cle)
    return courante !== undefined && courante.value !== attendu
  })
  const aCreer = Object.keys(PREFS_SEED).filter((cle) => !prefs.some((p) => p.key === cle))

  console.log(`Compte démo : ${demo.email} (${demo.id})`)
  console.log(`\nPréférences présentes (${prefs.length}) :`)
  for (const p of prefs) {
    const etat = p.key in PREFS_SEED
      ? p.value === PREFS_SEED[p.key]
        ? "conforme au seed"
        : "à recaler"
      : "HORS SEED → à supprimer"
    console.log(`  - ${p.key} = ${p.value.slice(0, 70)}   [${etat}]`)
  }
  if (aCreer.length) console.log(`\nManquantes, à créer : ${aCreer.join(", ")}`)

  const briefings = await prisma.conversation.findMany({
    where: { userId: demo.id, title: { startsWith: "Briefing" } },
    select: { id: true },
  })
  const totalConversations = await prisma.conversation.count({ where: { userId: demo.id } })
  console.log(
    `\nConversations du compte démo : ${totalConversations}, dont ${briefings.length} briefings auto-générés.`
  )

  if (!apply) {
    console.log("\n[BLANC] Rien n'a été écrit. Relancer avec --apply pour appliquer.")
    if (briefings.length && !avecBriefings) {
      console.log("[BLANC] Ajouter --avec-briefings pour purger aussi les briefings.")
    }
    return
  }

  if (aSupprimer.length) {
    const r = await prisma.userPreference.deleteMany({
      where: { userId: demo.id, key: { in: aSupprimer } },
    })
    console.log(`\n${r.count} préférence(s) hors seed supprimée(s) : ${aSupprimer.join(", ")}`)
  }
  for (const [cle, valeur] of aRecaler) {
    await prisma.userPreference.update({
      where: { userId_key: { userId: demo.id, key: cle } },
      data: { value: valeur },
    })
    console.log(`${cle} recalée sur la valeur du seed.`)
  }
  for (const cle of aCreer) {
    await prisma.userPreference.create({
      data: { userId: demo.id, key: cle, value: PREFS_SEED[cle] },
    })
    console.log(`${cle} créée depuis le seed.`)
  }

  if (avecBriefings && briefings.length) {
    const ids = briefings.map((b) => b.id)
    const msgs = await prisma.chatMessage.deleteMany({ where: { conversationId: { in: ids } } })
    const convs = await prisma.conversation.deleteMany({ where: { id: { in: ids } } })
    console.log(`${convs.count} conversation(s) de briefing purgée(s) (${msgs.count} message(s)).`)
  }

  const apres = await prisma.userPreference.findMany({
    where: { userId: demo.id },
    select: { key: true, value: true },
    orderBy: { key: "asc" },
  })
  console.log("\nÉtat final :")
  for (const p of apres) console.log(`  - ${p.key} = ${p.value.slice(0, 70)}`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
