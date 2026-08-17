#!/usr/bin/env npx tsx
/**
 * Test réel du rappel des irrigations planifiées depuis le HOST.
 *
 * Usage : npx tsx --env-file=.env scripts/test-notif-irrigation.ts <email> [--keep]
 * TEST_DATABASE_URL = override explicite depuis l'hôte ; sinon le script adapte
 * la DATABASE_URL du conteneur (db:5432 → localhost:5433).
 */

const argumentEmail = process.argv[2]
if (!argumentEmail || argumentEmail === "--keep") {
  console.error("Erreur : l'adresse email cible est obligatoire.")
  console.error("Usage : npx tsx --env-file=.env scripts/test-notif-irrigation.ts <email> [--keep]")
  process.exit(1)
}
const emailCible = argumentEmail
const dbUrl =
  process.env.TEST_DATABASE_URL || (process.env.DATABASE_URL ?? "").replace("@db:5432", "@localhost:5433")
const garderDonnees = process.argv.includes("--keep")

process.env.DATABASE_URL = dbUrl

async function main() {
  const { PrismaClient } = await import("@prisma/client")
  const { detecterAlertesUrgentes } = await import("../src/lib/notifications/queries")
  const { envoyerAlertesUrgentes } = await import("../src/lib/notifications/sender")
  const prisma = new PrismaClient()

  let cultureId: number | null = null
  let irrigationId: number | null = null

  try {
    const user = await prisma.user.findFirst({
      where: { email: emailCible },
      select: { id: true, email: true, name: true },
    })
    if (!user) throw new Error(`Utilisateur introuvable : ${emailCible}`)

    const espece = await prisma.espece.findFirst({
      orderBy: { id: "asc" },
      select: { id: true, nom: true },
    })
    if (!espece) throw new Error("Aucune espèce existante en base")

    const maintenant = new Date()
    const datePlantation = new Date(
      maintenant.getFullYear(),
      maintenant.getMonth(),
      maintenant.getDate() - 30,
      9,
      0,
      0,
      0
    )
    const datePrevue = new Date(
      maintenant.getFullYear(),
      maintenant.getMonth(),
      maintenant.getDate() - 1,
      9,
      0,
      0,
      0
    )

    const culture = await prisma.culture.create({
      data: {
        userId: user.id,
        especeId: espece.id,
        annee: maintenant.getFullYear(),
        datePlantation,
        aIrriguer: true,
      },
      select: { id: true },
    })
    cultureId = culture.id

    const irrigation = await prisma.irrigationPlanifiee.create({
      data: {
        userId: user.id,
        cultureId: culture.id,
        datePrevue,
        fait: false,
      },
      select: { id: true },
    })
    irrigationId = irrigation.id

    console.log(`Culture de test créée : #${culture.id} (${espece.nom ?? espece.id})`)
    console.log(`Irrigation de test créée : #${irrigation.id} (prévue le ${datePrevue.toLocaleString("fr-FR")})`)

    const alertesDetectees = await detecterAlertesUrgentes(user.id)
    console.log(`\nAlertes détectées pour l'utilisateur cible (${alertesDetectees.length}) :`)
    for (const alerte of alertesDetectees) {
      console.log(`- [${alerte.type}] ${alerte.titre} — ${alerte.message}`)
    }

    const erreursEnvoi: string[] = []
    const consoleErrorOriginale = console.error
    console.error = (...args: unknown[]) => {
      const message = args.map(String).join(" ")
      if (message.includes("Envoi alerte urgente échoué")) erreursEnvoi.push(message)
      consoleErrorOriginale(...args)
    }

    let envoisOk = 0
    try {
      // Pipeline réel : les erreurs SMTP sont isolées par utilisateur dans sender.ts.
      envoisOk = await envoyerAlertesUrgentes()
    } finally {
      console.error = consoleErrorOriginale
    }

    const echecCible = erreursEnvoi.some((message) => message.includes(`échoué pour ${emailCible}:`))
    console.log(`\nBilan des envois : ${envoisOk} OK, ${erreursEnvoi.length} échec(s) SMTP.`)
    if (envoisOk > 0 && !echecCible && alertesDetectees.length > 0) {
      console.log(`TEST_OK: email envoyé à ${emailCible}`)
    } else {
      console.error(`TEST_FAILED: aucun envoi confirmé pour ${emailCible}`)
      process.exitCode = 1
    }
  } finally {
    if (garderDonnees) {
      console.log("\n--keep : culture et irrigation de test conservées.")
    } else {
      if (irrigationId !== null) {
        await prisma.irrigationPlanifiee.delete({ where: { id: irrigationId } })
      }
      if (cultureId !== null) {
        await prisma.culture.delete({ where: { id: cultureId } })
      }
      console.log("\nDonnées de test nettoyées.")
    }
    await prisma.$disconnect()
  }
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
