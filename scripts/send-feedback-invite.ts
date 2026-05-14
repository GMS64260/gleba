/**
 * Envoie l'email d'invitation au feedback à un utilisateur.
 *
 * Usage :
 *   docker compose exec -T app npx tsx scripts/send-feedback-invite.ts <email>
 *
 * Génère (ou réutilise) le token, puis envoie le mail.
 */

import { PrismaClient } from "@prisma/client"
import { randomBytes } from "crypto"
import { sendMail, feedbackInviteEmail } from "../src/lib/mail"

const prisma = new PrismaClient()

const BASE_URL = process.env.FEEDBACK_BASE_URL || "https://gleba.fr"

async function main() {
  const email = process.argv[2]?.trim().toLowerCase()
  if (!email) {
    console.error("Usage : npx tsx scripts/send-feedback-invite.ts <email>")
    process.exit(1)
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true },
  })
  if (!user) {
    console.error(`Utilisateur introuvable : ${email}`)
    process.exit(1)
  }

  let tokenRecord = await prisma.feedbackToken.findFirst({
    where: { userId: user.id, usedAt: null },
    orderBy: { createdAt: "desc" },
  })
  if (!tokenRecord) {
    tokenRecord = await prisma.feedbackToken.create({
      data: { userId: user.id, token: randomBytes(24).toString("base64url") },
    })
  }

  const url = `${BASE_URL}/feedback/${tokenRecord.token}`
  const mail = feedbackInviteEmail({ name: user.name, url })

  console.log(`→ Envoi à ${user.email} (${user.name || "—"})`)
  console.log(`  Lien : ${url}`)

  await sendMail({
    to: user.email,
    subject: mail.subject,
    html: mail.html,
    replyTo: mail.replyTo,
  })

  console.log("✅ Email envoyé.")
}

main()
  .catch((err) => {
    console.error("❌ Erreur :", err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
