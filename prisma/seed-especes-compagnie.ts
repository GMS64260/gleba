/**
 * Seed du catalogue Gleba officiel pour les filières « compagnie / équin / NAC »
 * (Phase 0 des modes d'élevage). Espèces partagées (userId null), idempotent
 * (upsert sur l'id).
 *
 * Le contenu vit dans `src/lib/elevage/catalogue-compagnie.ts` (testé) ; ce
 * fichier ne fait que l'écrire en base. Convention d'id : préfixe = espèce de
 * base (cf. src/lib/elevage/espece-base.ts), sans collision avec les préfixes
 * de rente.
 *
 * Le token `production` n'a pas de sens hors rente ; on stocke la valeur neutre
 * "compagnie" (l'UI la masque pour ces filières, cf. filiere-ui.ts). Ce qui
 * compte est `filiere`.
 *
 * Lancement (au déploiement, PAS automatiquement) :
 *   npx tsx prisma/seed-especes-compagnie.ts
 *   npx tsx prisma/seed-races-compagnie.ts   ← à enchaîner pour les races
 * cf. docs/elevage-modes-phase0-spec.md
 */

import { PrismaClient } from "@prisma/client"
import { ESPECES_COMPAGNIE } from "../src/lib/elevage/catalogue-compagnie"

const prisma = new PrismaClient()

async function main() {
  let crees = 0
  let existants = 0

  for (const e of ESPECES_COMPAGNIE) {
    const dejaLa = await prisma.especeAnimale.findUnique({ where: { id: e.id }, select: { id: true } })

    await prisma.especeAnimale.upsert({
      where: { id: e.id },
      // Rattrape la filière sans écraser d'éventuelles personnalisations
      // (nom, durées, couleur) faites par un admin depuis le référentiel.
      update: { filiere: e.filiere },
      create: {
        id: e.id,
        nom: e.nom,
        type: e.type,
        filiere: e.filiere,
        production: "compagnie", // token neutre hors rente (masqué par l'UI)
        categorieReglementaire: e.categorieReglementaire,
        productions: [],
        dureeGestation: e.dureeGestation ?? null,
        dureeCouvaison: e.dureeCouvaison ?? null,
        poidsAdulte: e.poidsAdulte ?? null,
        couleur: e.couleur ?? null,
        description: e.description ?? null,
      },
    })

    if (dejaLa) existants++
    else crees++
  }

  const parFiliere = ESPECES_COMPAGNIE.reduce<Record<string, number>>((acc, e) => {
    acc[e.filiere] = (acc[e.filiere] ?? 0) + 1
    return acc
  }, {})

  console.log(
    `✓ Espèces compagnie/équin/NAC : ${ESPECES_COMPAGNIE.length} upsert ` +
      `(${crees} créées, ${existants} déjà présentes) — ` +
      Object.entries(parFiliere)
        .map(([f, n]) => `${f}: ${n}`)
        .join(", ")
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
