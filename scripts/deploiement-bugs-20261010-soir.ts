/**
 * Journal de déploiement des cinq signalements QA classés par
 * `cloture-bugs-20261010-soir.ts` : une ligne « Déployé en production » par
 * ticket dans `bug_status_logs` (RESOLVED → RESOLVED, signée par le compte
 * admin), avec l'effet constaté sur gleba.fr, compte démo, après la bascule
 * sur `gleba-app:688d8c8` (2026-10-10, 20:52 UTC). Sondes rejouées :
 * `scripts/qa/sonde-dates-culture-recolte.cjs`, `scripts/qa/sonde-verger-selecteurs.cjs`.
 *
 * Usage (depuis l'hôte) :
 *   npx tsx --env-file=.env scripts/deploiement-bugs-20261010-soir.ts           # simulation
 *   npx tsx --env-file=.env scripts/deploiement-bugs-20261010-soir.ts --ecrire  # journalise
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const ADMIN_ID = "admin_gleba_2026"
const BASCULE = "Déployé en production (gleba-app:688d8c8, bascule 20:52 UTC), non poussé sur GitHub. Effet constaté sur gleba.fr, compte démo"

const EFFETS: Array<{ id: string; effet: string }> = [
  {
    id: "cmv2qzhkf000nescp0v49c5l5",
    effet: "Zinnia, dates tapées avant l'arrivée des ITP : culture enregistrée aux 25/10, 06/12 et 31/01 (avant : 10/10, 21/11, 16/01) ; semis seul au 25/10 complété en plantation 06/12 et récolte 31/01 ; année passée à 2027 après saisie : dates décalées d'un an avec message.",
  },
  {
    id: "cmv2r0qua000rescprwhewxxo",
    effet: "date 17/10 posée sans événement React en dernier champ : récolte enregistrée au 17/10 (avant : 10/10).",
  },
  {
    id: "cmv2r0t6a000tescpwz067y03",
    effet: "Enregistrer sans arbre : aucun envoi ; deuxième arbre de la liste et type Greffe choisis : envoyés tels quels (envoi intercepté, rien d'écrit).",
  },
  {
    id: "cmv2r19al000vescpzpacrmfn",
    effet: "récolte du 10/10 sur une culture plantée le 21/11 (prévu) : refusée en 400, message « Une récolte ne peut pas précéder la plantation… » affiché sous le formulaire ; culture de sonde supprimée.",
  },
  {
    id: "cmv2r1kjv000xescp61yr131v",
    effet: "observation : arbre et type choisis gardés et envoyés ; traitement phyto : arbre gardé après une autre saisie ; pollinisation : arbre et pollinisateur gardés et envoyés (envois interceptés, rien d'écrit).",
  },
]

async function main() {
  const ecrire = process.argv.includes("--ecrire")
  const tickets = await prisma.bugReport.findMany({
    where: { id: { in: EFFETS.map((e) => e.id) } },
    select: { id: true, status: true, statusLogs: { select: { note: true } } },
  })
  if (tickets.length !== EFFETS.length) throw new Error("Ticket introuvable")
  const pasResolus = tickets.filter((t) => t.status !== "RESOLVED")
  if (pasResolus.length > 0) throw new Error(`Non RESOLVED : ${pasResolus.map((t) => t.id).join(", ")}`)
  const aJournaliser = EFFETS.filter(
    (e) => !tickets.find((t) => t.id === e.id)!.statusLogs.some((l) => l.note?.startsWith("Déployé en production (gleba-app:688d8c8")),
  )
  console.log(`${aJournaliser.length} ticket(s) à journaliser`)
  if (!ecrire) {
    console.log("--- simulation : rien écrit (ajouter --ecrire) ---")
    return
  }
  for (const e of aJournaliser) {
    await prisma.bugStatusLog.create({
      data: { bugReportId: e.id, fromStatus: "RESOLVED", toStatus: "RESOLVED", changedById: ADMIN_ID, note: `${BASCULE} : ${e.effet}` },
    })
    console.log(`journalisé ${e.id}`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
