/**
 * Classement des cinq premiers signalements QA v7 de la vague du 2026-10-10
 * soir (18:48 à 18:50 UTC), corrigés dans le dépôt et revus (revue
 * adversariale indépendante, retouches comprises), AVANT déploiement — même
 * règle et même mécanique que `cloture-bugs-20261010-lot2.ts` (journal « en
 * attente de déploiement », aucun mail : tickets du compte admin).
 *
 * cmv29egw6 (rappel de soin, non reproduit) reste OPEN ; les tickets
 * irrigation de 18:59 sont traités par une autre session.
 *
 * Usage (depuis l'hôte, DATABASE_URL chargé depuis .env) :
 *   npx tsx --env-file=.env scripts/cloture-bugs-20261010-soir.ts           # simulation
 *   npx tsx --env-file=.env scripts/cloture-bugs-20261010-soir.ts --ecrire  # classe
 */

import { PrismaClient, type BugStatus } from "@prisma/client"

const prisma = new PrismaClient()
const ADMIN_ID = "admin_gleba_2026"
const LOT = "Lot du 2026-10-10 soir corrigé dans le dépôt"

const TICKETS: Array<{ id: string; statut: BugStatus; commits: string; note: string }> = [
  {
    // Cultures — dates manuelles ignorées, successions impossibles
    id: "cmv2qzhkf000nescp0v49c5l5",
    statut: "RESOLVED",
    commits: "4191e60",
    note: "Les dates saisies à la création d'une culture sont conservées. Les itinéraires techniques de l'espèce arrivent un instant après son choix, et des dates tapées entre-temps étaient remplacées par le calendrier de l'ITP (reproduit sur le compte démo : culture enregistrée aux 10/10, 21/11 et 16/01 au lieu des 25/10, 06/12 et 31/01). Une date, un nombre de rangs ou un espacement saisi n'est plus réécrit par le pré-remplissage, ni au changement d'ITP ou d'année ; le bandeau l'indique, et « Appliquer les dates de l'ITP » reprend le calendrier de l'itinéraire à la demande. Une date de récolte saisie ne suit plus le début de cycle tant qu'elle lui reste postérieure. Des semis espacés de 15 jours se saisissent donc tels quels.",
  },
  {
    // Récoltes — la date saisie est remplacée par la date du jour
    id: "cmv2r0qua000rescprwhewxxo",
    statut: "RESOLVED",
    commits: "24aa611",
    note: "La date de récolte enregistrée est celle affichée dans le champ. Quand le champ était rempli sans que l'application voie la saisie, le 17/10 restait affiché mais la date du jour partait (reproduit). La saisie rapide et la fiche d'une récolte relisent maintenant la date dans le champ au moment d'enregistrer, la recopient à la sortie du champ, et refusent une date incomplète ou vide avec un message.",
  },
  {
    // Opérations verger — l'arbre choisi est remplacé par le premier de la liste
    id: "cmv2r0t6a000tescpwz067y03",
    statut: "RESOLVED",
    commits: "b2e2d94",
    note: "L'opération reste rattachée à l'arbre choisi. Tant que rien n'y était choisi, le champ Arbre désignait en coulisse le premier arbre de la liste, et l'enregistrement l'envoyait (opération rattachée à « Cerisier Burlat 1 »). Le champ est maintenant une liste déroulante simple avec une option vide : sans choix, l'enregistrement demande de sélectionner un arbre au lieu d'en prendre un au hasard.",
  },
  {
    // Récoltes — récolte acceptée avant la plantation
    id: "cmv2r19al000vescpzpacrmfn",
    statut: "RESOLVED",
    commits: "24aa611",
    note: "Une récolte ne peut plus être datée avant la plantation de sa culture (ou avant son semis si elle n'a pas de plantation). L'enregistrement est refusé avec un message qui donne la date prévue et, si la plantation a eu lieu plus tôt que prévu, invite à corriger d'abord sa date sur la fiche de la culture ; la culture n'est plus marquée récoltée avant d'être plantée. La règle vaut à la saisie et en modification d'une récolte, depuis les tâches, l'accueil, les calendriers et l'assistant ; le message s'affiche sous le formulaire, et le calendrier du tableau de bord le montre au lieu de « Impossible d'enregistrer la récolte ».",
  },
  {
    // Santé & Phyto — le sélecteur d'arbre se réinitialise
    id: "cmv2r1kjv000xescp61yr131v",
    statut: "RESOLVED",
    commits: "b2e2d94",
    note: "Le choix de l'arbre tient dans Santé & Phyto : observation, ajout d'un traitement phyto (AMM, DAR, ZNT) et association de pollinisation (arbre et pollinisateur). Ces champs passent en liste déroulante simple, qui garde la valeur choisie quel que soit le mode de saisie ; même correction pour l'arbre d'une production de bois.",
  },
]

async function main() {
  const ecrire = process.argv.includes("--ecrire")
  const enAttente = TICKETS.filter((t) => t.commits.includes("__"))
  if (enAttente.length > 0) throw new Error(`Commits non renseignés : ${enAttente.map((t) => t.id).join(", ")}`)
  const admin = await prisma.user.findUnique({ where: { id: ADMIN_ID }, select: { role: true } })
  if (admin?.role !== "ADMIN") throw new Error(`Compte admin ${ADMIN_ID} introuvable`)

  const existants = await prisma.bugReport.findMany({
    where: { id: { in: TICKETS.map((t) => t.id) } },
    select: { id: true, status: true, userId: true },
  })
  const parId = new Map(existants.map((t) => [t.id, t]))
  const manquants = TICKETS.filter((t) => !parId.has(t.id))
  if (manquants.length > 0) throw new Error(`Tickets introuvables : ${manquants.map((t) => t.id).join(", ")}`)
  const horsAdmin = existants.filter((t) => t.userId !== ADMIN_ID)
  if (horsAdmin.length > 0) {
    // Un ticket d'utilisateur réel appellerait un mail de résolution, hors de ce script.
    throw new Error(`Tickets d'un autre compte que l'admin : ${horsAdmin.map((t) => t.id).join(", ")}`)
  }

  const aTraiter = TICKETS.filter((t) => ["OPEN", "IN_PROGRESS"].includes(parId.get(t.id)!.status))
  console.log(`${aTraiter.length} ticket(s) à classer, ${TICKETS.length - aTraiter.length} déjà classé(s)`)
  for (const t of aTraiter) console.log(`  ${t.id} ${parId.get(t.id)!.status} → ${t.statut} (commits ${t.commits})`)
  if (!ecrire) {
    console.log("--- simulation : rien écrit (ajouter --ecrire) ---")
    return
  }

  const maintenant = new Date()
  for (const t of aTraiter) {
    const e = parId.get(t.id)!
    await prisma.$transaction([
      prisma.bugReport.update({
        where: { id: t.id },
        data: { status: t.statut, adminNote: t.note, resolvedAt: maintenant },
      }),
      prisma.bugStatusLog.create({
        data: {
          bugReportId: t.id,
          fromStatus: e.status,
          toStatus: t.statut,
          changedById: ADMIN_ID,
          note: `${LOT} (commits ${t.commits}), en attente de déploiement. ${t.note}`,
        },
      }),
    ])
    console.log(`${t.statut} ${t.id}`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
