/**
 * Seed du référentiel de races/variétés des filières « compagnie / équin / NAC »
 * (Phase 0 des modes d'élevage). Races partagées (userId null), idempotent
 * (upsert sur [especeAnimaleId, nom]) : réexécutable sans doublon et sans
 * écraser les races personnelles d'un utilisateur.
 *
 * Le contenu vit dans `src/lib/elevage/catalogue-compagnie.ts` (testé).
 * Les races de rente (bétail, volaille, lapins) restent gérées par
 * `prisma/seed-races.ts`.
 *
 * Prérequis : `npx tsx prisma/seed-especes-compagnie.ts` (les espèces doivent
 * exister — les races d'une espèce absente sont ignorées avec un avertissement).
 *
 * Lancement (au déploiement, PAS automatiquement) :
 *   npx tsx prisma/seed-races-compagnie.ts
 */

import { PrismaClient } from "@prisma/client"
import { RACES_COMPAGNIE, totalRacesCatalogue } from "../src/lib/elevage/catalogue-compagnie"

const prisma = new PrismaClient()

async function main() {
  const especesConnues = new Set(
    (
      await prisma.especeAnimale.findMany({
        where: { id: { in: Object.keys(RACES_COMPAGNIE) } },
        select: { id: true },
      })
    ).map((e) => e.id)
  )

  let upsertees = 0
  const ignorees: string[] = []

  for (const [especeAnimaleId, races] of Object.entries(RACES_COMPAGNIE)) {
    if (!especesConnues.has(especeAnimaleId)) {
      ignorees.push(especeAnimaleId)
      continue
    }

    for (const race of races) {
      await prisma.raceAnimale.upsert({
        where: { especeAnimaleId_nom: { especeAnimaleId, nom: race.nom } },
        update: {}, // ne rien écraser : l'utilisateur/admin peut avoir enrichi la fiche
        create: {
          especeAnimaleId,
          nom: race.nom,
          origine: race.origine ?? null,
          aptitudes: race.aptitudes ?? [],
          description: race.description ?? null,
        },
      })
      upsertees++
    }
  }

  console.log(
    `✓ Races compagnie/équin/NAC : ${upsertees}/${totalRacesCatalogue()} associations race↔espèce upsertées ` +
      `sur ${especesConnues.size} espèces.`
  )
  if (ignorees.length) {
    console.warn(
      `⚠ Espèces absentes en base, races ignorées : ${ignorees.join(", ")}. ` +
        `Lancer d'abord : npx tsx prisma/seed-especes-compagnie.ts`
    )
  }
}

main()
  .catch((err) => {
    console.error("Seed races compagnie échoué:", err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
