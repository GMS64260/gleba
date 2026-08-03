/**
 * Reprise des opérations d'entretien verger générées avant la fenêtre saisonnière.
 *
 * Contexte (2026-08-03) : le générateur écrasait la fenêtre agronomique en une
 * date pivot au 15 du mois. Les lignes déjà en base n'ont donc ni `fenetre_debut`
 * ni `date_limite` : sans reprise, elles restent classées « échéance ferme
 * dépassée », c'est-à-dire en retard perpétuel — exactement le symptôme que la
 * fenêtre corrige. Ce script rejoue la règle du générateur
 * (`fenetreOperationCare`) sur l'historique.
 *
 * Deux effets, tous deux idempotents :
 *  1. renseigner la fenêtre des opérations générées identifiables ;
 *  2. réétaler les dates conseillées encore à venir qui portent la signature du
 *     générateur historique (le 15 du mois), pour que 41 tailles ne retombent
 *     pas le même jour. Une date déplacée à la main par l'utilisateur (jour ≠ 15)
 *     n'est jamais touchée.
 *
 * Usage :
 *   npx tsx scripts/backfill-fenetres-operations-arbres.ts [--apply] [--user <id>]
 *
 * Sans `--apply`, le script n'écrit rien et affiche ce qu'il ferait.
 */

import prisma from "../src/lib/prisma"
import {
  fenetreOperationCare,
  findTreeCareProfile,
  type TreeCareProfile,
} from "../src/lib/tree-care-calendar"

const JOUR_PIVOT_HISTORIQUE = 15

interface Stats {
  examinees: number
  fenetresRenseignees: number
  datesReetalees: number
  profilIntrouvable: number
  operationIntrouvable: number
}

/**
 * Retrouve l'opération du profil correspondant à une ligne existante.
 *
 * Le générateur stocke `"<label> — <description>"`, donc le libellé identifie
 * l'opération. Mais les profils sont régulièrement reformulés (corrections
 * agronomiques issues des retours testeurs), et les lignes générées avant une
 * reformulation ne s'apparient plus. On retombe alors sur le couple
 * (type, saison recommandée) porté par la ligne elle-même, et uniquement s'il
 * désigne une seule opération du profil : c'est une identification, pas une
 * supposition. Les cas ambigus restent sans fenêtre.
 */
function retrouverOperationProfil(
  profile: TreeCareProfile,
  description: string | null,
  type: string,
  saisonRecommandee: string | null
) {
  const attendu = (description ?? "").trim()
  const parLibelle =
    profile.operations.find((op) => `${op.label} — ${op.description}` === attendu) ??
    profile.operations.find((op) => attendu && attendu.startsWith(`${op.label} —`))
  if (parLibelle) return parLibelle

  if (!saisonRecommandee) return null
  const candidats = profile.operations.filter(
    (op) => op.type === type && op.saisonRecommandee === saisonRecommandee
  )
  return candidats.length === 1 ? candidats[0] : null
}

async function main() {
  const apply = process.argv.includes("--apply")
  const userIndex = process.argv.indexOf("--user")
  const userId = userIndex !== -1 ? process.argv[userIndex + 1] : undefined

  const stats: Stats = {
    examinees: 0,
    fenetresRenseignees: 0,
    datesReetalees: 0,
    profilIntrouvable: 0,
    operationIntrouvable: 0,
  }

  const operations = await prisma.operationArbre.findMany({
    where: {
      notes: "auto:calendrier",
      dateLimite: null,
      fait: false,
      abandonneeLe: null,
      datePrevue: { not: null },
      ...(userId ? { userId } : {}),
    },
    select: {
      id: true,
      arbreId: true,
      type: true,
      description: true,
      datePrevue: true,
      saisonRecommandee: true,
      arbre: { select: { espece: true, variete: true } },
    },
    orderBy: { id: "asc" },
  })

  console.log(
    `${operations.length} opération(s) générée(s) sans fenêtre${userId ? ` pour ${userId}` : ""}.`
  )

  const aujourdhui = new Date()
  aujourdhui.setHours(0, 0, 0, 0)

  for (const operation of operations) {
    stats.examinees++

    const espece = operation.arbre.espece
    const profile = espece ? findTreeCareProfile(espece) : null
    if (!profile) {
      stats.profilIntrouvable++
      continue
    }

    const opProfil = retrouverOperationProfil(
      profile,
      operation.description,
      operation.type,
      operation.saisonRecommandee
    )
    if (!opProfil) {
      stats.operationIntrouvable++
      continue
    }

    const datePrevue = operation.datePrevue!
    // L'année de rattachement est celle de la fenêtre, pas celle de la date
    // conseillée : sur une fenêtre à cheval (agrumes nov→mars) une date en
    // janvier appartient à la fenêtre ouverte en novembre de l'année précédente.
    const anneeFenetre =
      opProfil.moisDebut > opProfil.moisFin && datePrevue.getMonth() + 1 <= opProfil.moisFin
        ? datePrevue.getFullYear() - 1
        : datePrevue.getFullYear()

    const fenetre = fenetreOperationCare(
      opProfil,
      anneeFenetre,
      operation.arbre.variete
    )

    // Réétalement : seulement vers l'avenir, et seulement si la date porte la
    // signature du générateur historique. Une saisie manuelle reste intacte.
    const signatureGenerateur = datePrevue.getDate() === JOUR_PIVOT_HISTORIQUE
    const fenetreOuverte = fenetre.fin >= aujourdhui
    let nouvelleDatePrevue: Date | null = null
    if (signatureGenerateur && fenetreOuverte && datePrevue > aujourdhui) {
      const joursDansMois = new Date(
        fenetre.anneeAncrage,
        fenetre.moisAncrage,
        0
      ).getDate()
      const decalage = ((operation.arbreId % joursDansMois) + joursDansMois) % joursDansMois
      const candidate = new Date(
        fenetre.anneeAncrage,
        fenetre.moisAncrage - 1,
        1 + decalage
      )
      // Ne jamais ramener une opération dans le passé en « améliorant » sa date.
      if (candidate >= aujourdhui && candidate.getTime() !== datePrevue.getTime()) {
        nouvelleDatePrevue = candidate
      }
    }

    stats.fenetresRenseignees++
    if (nouvelleDatePrevue) stats.datesReetalees++

    if (apply) {
      await prisma.operationArbre.update({
        where: { id: operation.id },
        data: {
          fenetreDebut: fenetre.debut,
          dateLimite: fenetre.fin,
          ...(nouvelleDatePrevue
            ? { datePrevue: nouvelleDatePrevue, date: nouvelleDatePrevue }
            : {}),
        },
      })
    }
  }

  console.log("")
  console.log(`Examinées              : ${stats.examinees}`)
  console.log(`Fenêtres renseignées   : ${stats.fenetresRenseignees}`)
  console.log(`Dates réétalées        : ${stats.datesReetalees}`)
  console.log(`Profil espèce inconnu  : ${stats.profilIntrouvable}`)
  console.log(`Opération non retrouvée: ${stats.operationIntrouvable}`)
  console.log("")
  console.log(
    apply
      ? "✓ Écritures appliquées."
      : "Simulation seule — relancer avec --apply pour écrire."
  )
}

main()
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
