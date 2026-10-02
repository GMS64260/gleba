/**
 * Clôture des 6 signalements OPEN du 2026-10-02 (7 tickets d'assistant ou de
 * vigie, dont 5 d'un éleveur caprin réel ; 15 tickets de la campagne QA
 * navigateur « Julien V7 » sur le compte démo), APRÈS bascule de l'image qui
 * les corrige.
 *
 * Reproduit le clic « Résolu » de l'administrateur (statut + resolvedAt,
 * journal bug_status_logs signé par le compte admin), SANS mail, comme le
 * 2026-09-25. Deux demandes restent des évolutions (import Google Calendar,
 * transmission d'un profil compagnie) : EVOLUTION_PRODUIT.
 *
 * Usage (depuis l'hôte, DATABASE_URL chargé depuis .env) :
 *   npx tsx --env-file=.env scripts/cloture-bugs-20261002.ts            # simulation
 *   npx tsx --env-file=.env scripts/cloture-bugs-20261002.ts --ecrire   # écrit
 */

import { PrismaClient, type BugStatus } from "@prisma/client"

const prisma = new PrismaClient()
const ADMIN_ID = "admin_gleba_2026"
const IMAGE = process.env.GLEBA_IMAGE_TAG ?? "gleba-app:55af196"

const TICKETS: Array<{ id: string; statut: BugStatus; note: string }> = [
  {
    id: "cmularet80001z9d4md3kgyfg",
    statut: "RESOLVED",
    note: "Retest antérieur à la bascule de 14:00 du 28/09 (le changement de saison passe par l'API History). Vérifié en navigateur le 2026-10-02 : 2027 choisi, URL annee=2027 et sélecteur conservés au rechargement.",
  },
  {
    id: "cmulatx230003z9d4tmlntubu",
    statut: "RESOLVED",
    note: "Leaflet applique le fond sur l'événement click de la case ; l'enregistrement n'écoutait que change, si bien qu'un clic sans change affichait le satellite sans le mémoriser. Les deux sont écoutés ; prouvé en navigateur (souris, clavier, événement click seul).",
  },
  {
    id: "cmulnl0wk0017nwgt7kpij58z",
    statut: "RESOLVED",
    note: "Les délais d'attente d'un animal mort, vendu ou abattu ne figurent plus dans les alertes de remise en vente. Ceux de la chèvre signalée venaient de deux anciens soins validés en septembre 2026 avec la date du clic ; ils se corrigent avec le bouton « Dater ».",
  },
  {
    id: "cmun6gqmj00a2nwgt3e0zqf9u",
    statut: "RESOLVED",
    note: "Nouvelle fabrication : les champs Nombre de pièces et Poids total gardent la saisie telle quelle et ne sont convertis qu'à l'envoi. Le champ peut être vidé, taper 7 donne 7.",
  },
  {
    id: "vigie2cc8358562efb596da67ea1b",
    statut: "RESOLVED",
    note: "Modifier recalcule désormais le calendrier de toutes les injections, faites comprises, et un changement de date de départ ou d'intervalle recale leurs dates réelles. Chaque injection faite a un bouton « Dater » ; « Faite » sur une injection prévue il y a plus d'un jour demande la date réelle. Le délai d'attente suit.",
  },
  {
    id: "cmupz9djj00n0nwgt4mv2s6eu",
    statut: "RESOLVED",
    note: "L'assistant lit maintenant les injections d'un soin et sait recaler un protocole (update_soin : première le 10/07, une par jour) ou dater une injection (dater_injection). À l'écran : Modifier, date du 10/07 et intervalle 24 h, puis « Dater » si une injection diffère.",
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
          note: `Lot du 2026-10-02 déployé (${IMAGE}). ${t.note}`,
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
