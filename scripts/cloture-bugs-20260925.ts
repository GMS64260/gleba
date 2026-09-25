/**
 * Clôture des 9 signalements de l'éleveur caprin (24-25/09/2026), ouverts
 * automatiquement par l'assistant lors de blocages, APRÈS bascule de l'image
 * qui les corrige.
 *
 * Reproduit le clic « Résolu » de l'administrateur (statut + resolvedAt,
 * journal bug_status_logs signé par le compte admin), SANS mail : décision de
 * l'administrateur du 2026-09-25. Deux demandes restent des évolutions
 * (soin visant plusieurs lots, transmission automatique à l'EDE) : elles sont
 * classées EVOLUTION_PRODUIT, pas résolues.
 *
 * Usage (depuis l'hôte, DATABASE_URL chargé depuis .env) :
 *   npx tsx --env-file=.env scripts/cloture-bugs-20260925.ts            # simulation
 *   npx tsx --env-file=.env scripts/cloture-bugs-20260925.ts --ecrire   # écrit
 */

import { PrismaClient, type BugStatus } from "@prisma/client"

const prisma = new PrismaClient()
const ADMIN_ID = "admin_gleba_2026"
const IMAGE = process.env.GLEBA_IMAGE_TAG ?? "gleba-app:0efb1c5"

const TICKETS: Array<{ id: string; statut: BugStatus; note: string }> = [
  {
    id: "cmuflxphu0055owm3zayd3r0i",
    statut: "EVOLUTION_PRODUIT",
    note: "Un soin vise un animal ou un lot. Contournement désormais simple : regrouper les adultes dans un lot en une fois (« Ajouter / retirer des animaux ») ou un soin par lot. Soin multi-lots = évolution.",
  },
  {
    id: "cmufmnlz6005jowm3j784w440",
    statut: "RESOLVED",
    note: "L'équarrissage existait (carte « Mortalités et équarrissage » du registre) mais manquait à la carte de l'assistant : ajoutée.",
  },
  {
    id: "cmufmqlk9005lowm3bdubw7a9",
    statut: "RESOLVED",
    note: "Cause : chèvre 410 remise « actif » en gardant sa date de sortie, donc lue comme une vente. La déclaration le dit désormais ; n° de destination saisissable partout ; assistant informé du champ EDE.",
  },
  {
    id: "cmufmrwwq005nowm3u1p07f9t",
    statut: "EVOLUTION_PRODUIT",
    note: "Gleba ne transmet rien à l'EDE ; l'assistant le dit désormais clairement. Transmission automatique = évolution.",
  },
  {
    id: "cmufmymth005sowm3h0eybxtm",
    statut: "RESOLVED",
    note: "« Déjà déclarée hors Gleba » (unitaire ou groupé par exercice), « Sans objet », sélecteur d'exercice ; les chevreaux nés sur place ne sont plus lus comme des entrées.",
  },
  {
    id: "cmufnxlma0068owm3z4bod759",
    statut: "RESOLVED",
    note: "Un lot dont tous les animaux sont sortis se supprime désormais (animaux détachés, fiches conservées).",
  },
  {
    id: "cmugj4u8t006oowm3aon57dfr",
    statut: "RESOLVED",
    note: "Le CSV était du JSON nommé .zip : vraie archive ZIP, un CSV par table, élevage compris.",
  },
  {
    id: "cmugs9udt007towm3iz14kdzt",
    statut: "RESOLVED",
    note: "Composition d'un lot en une fois à l'écran et par l'assistant (affecter_animaux_lot).",
  },
  {
    id: "cmugt7xtz008cowm3c7qgw766",
    statut: "RESOLVED",
    note: "Suppression d'un soin à l'écran (fenêtre Modifier) et par l'assistant (delete_soin).",
  },
]

async function main() {
  const ecrire = process.argv.includes("--ecrire")
  const admin = await prisma.user.findUnique({ where: { id: ADMIN_ID }, select: { role: true } })
  if (admin?.role !== "ADMIN") throw new Error(`Compte admin ${ADMIN_ID} introuvable`)

  const existants = await prisma.bugReport.findMany({
    where: { id: { in: TICKETS.map((t) => t.id) } },
    select: { id: true, status: true },
  })
  const parId = new Map(existants.map((t) => [t.id, t]))
  const manquants = TICKETS.filter((t) => !parId.has(t.id))
  if (manquants.length > 0) throw new Error(`Tickets introuvables : ${manquants.map((t) => t.id).join(", ")}`)

  const aTraiter = TICKETS.filter((t) => ["OPEN", "IN_PROGRESS"].includes(parId.get(t.id)!.status))
  console.log(`${aTraiter.length} à classer, ${TICKETS.length - aTraiter.length} déjà classé(s)`)
  for (const t of aTraiter) console.log(`  ${t.id} ${parId.get(t.id)!.status} → ${t.statut}`)
  if (!ecrire) {
    console.log("--- simulation : rien écrit (ajouter --ecrire) ---")
    return
  }

  const maintenant = new Date()
  for (const t of aTraiter) {
    const avant = parId.get(t.id)!.status
    await prisma.$transaction([
      prisma.bugReport.update({
        where: { id: t.id },
        data: {
          status: t.statut,
          adminNote: t.note,
          resolvedAt: t.statut === "RESOLVED" ? maintenant : null,
        },
      }),
      prisma.bugStatusLog.create({
        data: {
          bugReportId: t.id,
          fromStatus: avant,
          toStatus: t.statut,
          changedById: ADMIN_ID,
          note: `Lot du 2026-09-25 déployé (${IMAGE}). ${t.note}`,
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
