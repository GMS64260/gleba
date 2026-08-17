#!/usr/bin/env npx tsx
/**
 * Test réel des préférences de notifications depuis le HOST.
 *
 * Usage : npx tsx --env-file=.env scripts/test-notif-prefs.ts <email>
 * TEST_DATABASE_URL = override explicite depuis l'hôte ; sinon le script adapte
 * la DATABASE_URL du conteneur (db:5432 → localhost:5433).
 */

const emailCible = process.argv[2]
if (!emailCible) {
  console.error("Erreur : l'adresse email cible est obligatoire.")
  console.error("Usage : npx tsx --env-file=.env scripts/test-notif-prefs.ts <email>")
  process.exit(1)
}
const dbUrl =
  process.env.TEST_DATABASE_URL || (process.env.DATABASE_URL ?? "").replace("@db:5432", "@localhost:5433")
const prefsDesactivees = {
  meteo: false,
  resume: false,
  stocks: false,
  itpSemaine: false,
  recoltes: false,
  irrigations: false,
  autresUrgentes: false,
}
const prefsActivees = {
  meteo: true,
  resume: true,
  stocks: true,
  itpSemaine: true,
  recoltes: true,
  irrigations: true,
  autresUrgentes: true,
}

process.env.DATABASE_URL = dbUrl

async function main() {
  const { PrismaClient } = await import("@prisma/client")
  const { chargerPrefsNotif, detecterAlertesUrgentes, getDestinatairesNotifications } = await import(
    "../src/lib/notifications/queries"
  )
  const { envoyerAlertesUrgentes } = await import("../src/lib/notifications/sender")
  const { typeAlerteEstActivee } = await import("../src/lib/notifications/prefs")
  const prisma = new PrismaClient()
  let userIdCible: string | null = null

  try {
    const user = await prisma.user.findFirst({
      where: { email: emailCible },
      select: { id: true },
    })
    if (!user) throw new Error(`Utilisateur introuvable : ${emailCible}`)
    userIdCible = user.id

    // (a) Désactive temporairement tous les types de notifications.
    await prisma.userPreference.upsert({
      where: { userId_key: { userId: user.id, key: "notifPrefs" } },
      update: { value: JSON.stringify(prefsDesactivees) },
      create: {
        userId: user.id,
        key: "notifPrefs",
        value: JSON.stringify(prefsDesactivees),
      },
    })

    // (b) Vérifie la préférence en base, la présence du destinataire et le filtrage.
    const destinataires = await getDestinatairesNotifications()
    if (!destinataires.some((destinataire) => destinataire.id === user.id)) {
      throw new Error(`${emailCible} absent des destinataires de notifications`)
    }

    const prefs = await chargerPrefsNotif(user.id)
    if (Object.values(prefs).some((active) => active)) {
      throw new Error("Les préférences désactivées n'ont pas été chargées")
    }

    const alertes = await detecterAlertesUrgentes(user.id)
    const alertesAutorisees = alertes.filter((alerte) => typeAlerteEstActivee(alerte.type, prefs))
    if (alertesAutorisees.length > 0) {
      throw new Error(`${alertesAutorisees.length} alerte(s) urgente(s) restent autorisées`)
    }
    console.log(
      `Alertes urgentes pour l'utilisateur cible : ${alertes.length}, ${alertesAutorisees.length} autorisée(s) après filtrage`
    )

    // Le pipeline réel ne doit donc envoyer aucune alerte urgente à l'utilisateur cible.
    const envois = await envoyerAlertesUrgentes()
    console.log(`Pipeline urgent exécuté : ${envois} envoi(s) pour les autres destinataires éventuels.`)

    // (c) Réactive tous les types pour ne pas modifier durablement le compte de test.
    await prisma.userPreference.upsert({
      where: { userId_key: { userId: user.id, key: "notifPrefs" } },
      update: { value: JSON.stringify(prefsActivees) },
      create: {
        userId: user.id,
        key: "notifPrefs",
        value: JSON.stringify(prefsActivees),
      },
    })
    const prefsFinales = await chargerPrefsNotif(user.id)
    if (Object.values(prefsFinales).some((active) => !active)) {
      throw new Error("Les préférences n'ont pas été réactivées")
    }

    console.log("TEST_OK: préférences notifs filtrées correctement")
  } finally {
    if (userIdCible !== null) {
      await prisma.userPreference.upsert({
        where: { userId_key: { userId: userIdCible, key: "notifPrefs" } },
        update: { value: JSON.stringify(prefsActivees) },
        create: {
          userId: userIdCible,
          key: "notifPrefs",
          value: JSON.stringify(prefsActivees),
        },
      })
    }
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})

export {}
