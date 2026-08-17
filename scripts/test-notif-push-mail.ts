#!/usr/bin/env npx tsx

import type { AlerteUrgente } from "../src/lib/notifications/types"

/**
 * Test réel du pipeline de notifications push et email depuis le HOST.
 *
 * Usage : npx tsx --env-file=.env scripts/test-notif-push-mail.ts <email>
 * TEST_DATABASE_URL = override explicite depuis l'hôte ; sinon le script adapte
 * la DATABASE_URL du conteneur (db:5432 → localhost:5433).
 */

const emailCible = process.argv[2]
if (!emailCible) {
  console.error("Erreur : l'adresse email cible est obligatoire.")
  console.error("Usage : npx tsx --env-file=.env scripts/test-notif-push-mail.ts <email>")
  process.exit(1)
}
const dbUrl =
  process.env.TEST_DATABASE_URL || (process.env.DATABASE_URL ?? "").replace("@db:5432", "@localhost:5433")

process.env.DATABASE_URL = dbUrl

function formatError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

async function main() {
  const { PrismaClient } = await import("@prisma/client")
  const { envoyerPushUtilisateur, pushConfigure } = await import("../src/lib/push")
  const { sendMail } = await import("../src/lib/mail")
  const { alerteUrgenteEmail } = await import("../src/lib/notifications/templates")
  const prisma = new PrismaClient()

  let pushWorked = false
  let emailWorked = false
  let pushError: unknown
  let emailError: unknown

  try {
    const user = await prisma.user.findFirst({
      where: { email: emailCible },
      select: { id: true, email: true, name: true },
    })
    if (!user) throw new Error(`Utilisateur introuvable : ${emailCible}`)

    console.log(`Utilisateur cible : ${user.email}`)

    // Étape 1 — Envoi push réel à toutes les subscriptions de l'utilisateur cible.
    try {
      if (!pushConfigure()) {
        throw new Error("VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY non configurées")
      }

      const subscriptionsAvant = await prisma.pushSubscription.findMany({
        where: { userId: user.id },
        select: { id: true },
      })
      const envois = await envoyerPushUtilisateur(user.id, {
        title: "[Gleba] Test de notification push",
        body: "Si vous lisez ceci, les notifications push Gleba fonctionnent sur ce navigateur. (test du 17/08)",
        url: "http://localhost:3000/parametres",
        tag: "test-push-manuel",
      })
      const subscriptionsApres = await prisma.pushSubscription.findMany({
        where: { userId: user.id },
        select: { id: true },
      })
      const subscriptionsRestantes = new Set(subscriptionsApres.map((subscription) => subscription.id))

      for (const subscription of subscriptionsAvant) {
        const statut = subscriptionsRestantes.has(subscription.id) ? "ok" : "gone"
        console.log(
          `Push subscription ${subscription.id} : ${statut}${statut === "gone" ? " (purgée)" : ""}`
        )
      }
      console.log(`Push : ${envois} subscription(s) OK`)
      pushWorked = envois > 0
      if (!pushWorked) pushError = new Error("Aucune subscription push n'a fonctionné")
    } catch (error: unknown) {
      pushError = error
      console.error(`Push : échec — ${formatError(error)}`)
    }

    // Étape 2 — Envoi email réel via le pipeline SMTP de production.
    try {
      if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
        throw new Error("SMTP_HOST/SMTP_USER non configurés")
      }

      const alerte: AlerteUrgente = {
        type: "irrigation-rappel",
        titre: "test de notification",
        message:
          "Ceci est un email de test du pipeline de notifications Gleba (17/08). Si vous le recevez, le canal email fonctionne.",
        key: "test-mail-manuel:2026-08-17",
      }
      const email = alerteUrgenteEmail({ id: user.id, email: user.email, name: user.name }, alerte)

      await sendMail({ to: emailCible, subject: email.subject, html: email.html })
      emailWorked = true
      console.log(`Email : OK — envoyé à ${emailCible}`)
    } catch (error: unknown) {
      emailError = error
      console.error(`Email : échec — ${formatError(error)}`)
    }

    // Étape 3 — Bilan des deux canaux.
    if (pushWorked && emailWorked) {
      console.log("TEST_OK: push + email envoyés")
      return
    }

    const echecs = [
      !pushWorked ? `push: ${formatError(pushError ?? "échec inconnu")}` : null,
      !emailWorked ? `email: ${formatError(emailError ?? "échec inconnu")}` : null,
    ].filter((message): message is string => message !== null)
    console.error(`TEST_FAILED: ${echecs.join(" ; ")}`)
    process.exitCode = 1
  } finally {
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

export {}
