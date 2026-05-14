/**
 * Envoie l'invitation feedback à tous les utilisateurs USER actifs
 * qui n'ont pas encore répondu (exclut admins et le compte démo).
 *
 * Usage :
 *   npx tsx scripts/send-feedback-campaign.ts          # exécution réelle
 *   npx tsx scripts/send-feedback-campaign.ts --dry    # liste seulement
 */

import { PrismaClient } from "@prisma/client"
import { randomBytes } from "crypto"
import { sendMail, feedbackInviteEmail } from "../src/lib/mail"

const prisma = new PrismaClient()

const BASE_URL = process.env.FEEDBACK_BASE_URL || "https://gleba.fr"
const DELAY_MS = 2500 // entre chaque envoi, pour ne pas saturer le SMTP

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function getOrCreateToken(userId: string): Promise<string> {
  const existing = await prisma.feedbackToken.findFirst({
    where: { userId, usedAt: null },
    orderBy: { createdAt: "desc" },
  })
  if (existing) return existing.token

  const token = randomBytes(24).toString("base64url")
  await prisma.feedbackToken.create({ data: { userId, token } })
  return token
}

async function main() {
  const dryRun = process.argv.includes("--dry")

  // Cible : USER actifs, hors démo, sans réponse de feedback existante
  const targets = await prisma.user.findMany({
    where: {
      role: "USER",
      active: true,
      email: { not: "demo@gleba.fr" },
      feedbackResponses: { none: {} },
    },
    select: { id: true, email: true, name: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  })

  console.log(
    `\n🌱 Campagne feedback — ${targets.length} destinataire(s)${
      dryRun ? " [DRY RUN]" : ""
    }\n`
  )

  if (targets.length === 0) {
    console.log("Aucun destinataire — tout le monde a répondu ou aucun user éligible.")
    return
  }

  let success = 0
  let failure = 0
  const errors: { email: string; error: string }[] = []

  for (let i = 0; i < targets.length; i++) {
    const user = targets[i]
    const prefix = `[${(i + 1).toString().padStart(2, "0")}/${targets.length}]`

    if (dryRun) {
      console.log(`${prefix} (dry) ${user.email} — ${user.name || "—"}`)
      continue
    }

    try {
      const token = await getOrCreateToken(user.id)
      const url = `${BASE_URL}/feedback/${token}`
      const mail = feedbackInviteEmail({ name: user.name, url })

      await sendMail({
        to: user.email,
        subject: mail.subject,
        html: mail.html,
        replyTo: mail.replyTo,
      })

      console.log(`${prefix} ✅ ${user.email} — ${user.name || "—"}`)
      success++
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      console.error(`${prefix} ❌ ${user.email} — ${msg}`)
      failure++
      errors.push({ email: user.email, error: msg })
    }

    // Délai entre les envois (sauf après le dernier)
    if (i < targets.length - 1) await sleep(DELAY_MS)
  }

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
  console.log(`Récap : ${success} envoyé(s), ${failure} échec(s)`)
  if (errors.length > 0) {
    console.log(`\nÉchecs :`)
    for (const e of errors) console.log(`  · ${e.email} → ${e.error}`)
  }
}

main()
  .catch((err) => {
    console.error("❌ Erreur fatale :", err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
