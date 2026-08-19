#!/usr/bin/env npx tsx
/**
 * Test réel du pipeline de notifications push depuis le HOST.
 *
 * Usage : npx tsx --env-file=.env scripts/test-notif-push.ts <email>
 * TEST_DATABASE_URL = override explicite depuis l'hôte ; sinon le script adapte
 * la DATABASE_URL du conteneur (db:5432 → localhost:5433).
 */

const emailCible = process.argv[2]
if (!emailCible) {
  console.error("Erreur : l'adresse email cible est obligatoire.")
  console.error("Usage : npx tsx --env-file=.env scripts/test-notif-push.ts <email>")
  process.exit(1)
}
const dbUrl =
  process.env.TEST_DATABASE_URL || (process.env.DATABASE_URL ?? "").replace("@db:5432", "@localhost:5433")
const endpointTest = "https://push.example.com/fake-test"

process.env.DATABASE_URL = dbUrl

async function main() {
  const { PrismaClient } = await import("@prisma/client")
  const { envoyerPushUtilisateur, pushConfigure } = await import("../src/lib/push")
  const prisma = new PrismaClient()

  try {
    if (!pushConfigure()) {
      throw new Error("VAPID_PUBLIC_KEY/VAPID_PRIVATE_KEY non configurées")
    }

    const user = await prisma.user.findFirst({
      where: { email: emailCible },
      select: { id: true, email: true },
    })
    if (!user) throw new Error(`Utilisateur introuvable : ${emailCible}`)

    await prisma.pushSubscription.deleteMany({ where: { endpoint: endpointTest } })
    await prisma.pushSubscription.create({
      data: {
        userId: user.id,
        endpoint: endpointTest,
        p256dh: "p256dh-fake-test",
        auth: "auth-fake-test",
        userAgent: "test-notif-push",
      },
    })
    console.log(`Subscription push de test créée pour ${user.email}`)

    const envois = await envoyerPushUtilisateur(user.id, {
      title: "Test Gleba",
      body: "Pipeline push opérationnel",
      url: "/parametres",
      tag: "test-notif-push",
    })
    const subscriptionRestante = await prisma.pushSubscription.findUnique({
      where: { endpoint: endpointTest },
      select: { id: true },
    })
    console.log(
      `Envoi push terminé sans crash : ${envois} résultat(s) OK, subscription ${
        subscriptionRestante ? "conservée (erreur réseau non définitive)" : "purgée (404/410)"
      }.`
    )
    console.log("TEST_OK: pipeline push opérationnel (envoi réel à valider dans un navigateur)")
  } finally {
    await prisma.pushSubscription.deleteMany({ where: { endpoint: endpointTest } })
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

export {}
