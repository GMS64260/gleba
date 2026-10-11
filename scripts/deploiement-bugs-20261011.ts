/**
 * Journal de déploiement des signalements classés par `cloture-bugs-20261011.ts` :
 * une ligne « Déployé en production » par ticket corrigé dans `bug_status_logs`
 * (RESOLVED → RESOLVED, signée par le compte admin), avec l'effet constaté sur
 * gleba.fr, compte démo, après la bascule sur `gleba-app:4e67119`
 * (2026-10-11, 07:22 UTC). Sondes : `scripts/qa/sonde-lot-20261011.cjs`,
 * `scripts/qa/sonde-rangs-suggestion.cjs` (écritures interceptées, rien d'écrit).
 * cmv2sr80i (déjà en production) et cmv29egw6 (hors périmètre) ne sont pas
 * concernés.
 *
 * Usage (depuis l'hôte) :
 *   npx tsx --env-file=.env scripts/deploiement-bugs-20261011.ts           # simulation
 *   npx tsx --env-file=.env scripts/deploiement-bugs-20261011.ts --ecrire  # journalise
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const ADMIN_ID = "admin_gleba_2026"
const IMAGE = "gleba-app:4e67119"
const BASCULE = `Déployé en production (${IMAGE}, bascule 07:22 UTC le 2026-10-11), non poussé sur GitHub. Effet constaté sur gleba.fr, compte démo`

const EFFETS: Array<{ id: string; effet: string }> = [
  {
    id: "cmv2r1oao000zescpud8u80x6",
    effet: "fenêtre de vente d'une récolte de 5 tiges : « Zinnia - 5 tiges », « Prix par tige (€) », « Quantité vendue (tiges) » ; 2,5 tiges refusées avant envoi (« Saisissez un nombre entier de tiges vendu(e)s. »). Ligne de stock injectée dans la lecture, vente interceptée : rien d'écrit.",
  },
  {
    id: "cmv2r1v630011escp2qegdggh",
    effet: "après le refus de largeur (3 rangs, 0,70 m pour 0,50 m), le bouton « Réduire à 2 rangs » ramène le champ à 2, efface le refus et invite à enregistrer ; l'envoi suivant part à 2 rangs (envois interceptés). Aperçu de l'assistant, même règle que l'enregistrement, sur la planche B1 : 3 rangs acceptés (0,70 m pour 0,90 m), 6 rangs refusés avec « Réduire à 3 rangs ».",
  },
  {
    id: "cmv2r21ns0013escptie4w6er",
    effet: "liste Type de « Nouvelle intervention » : Semis, Repiquage, Plantation, Désherbage, Binage, Éclaircissage, Paillage, Traitement phyto, Fertilisation, Récolte, Taille, Pincement, Ébourgeonnage, Palissage, Tuteurage, Arrosage, Autre.",
  },
  {
    id: "cmv2r2rl80016escpexpwk986",
    effet: "saison 2026 de la démo : 13 cultures de rotation non créées, jusque-là comptées comme satisfaites, sont listées par « Créer les cultures » avec les espèces en place (ex. C4 étape 1/3 Courge butternut, planche portant un concombre) ; le hub Planification ne dit plus « Plan prêt ».",
  },
  {
    id: "cmv2r57qk0018escp1os8fd51",
    effet: "à 375 px, Aujourd'hui > Plus liste « Interventions » et l'ouvre ; Tâches > « Noter une intervention hors liste » ouvre une fiche vierge ; « Noter une intervention » de la palette ouvre la fiche sur le registre déjà affiché.",
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
    (e) => !tickets.find((t) => t.id === e.id)!.statusLogs.some((l) => l.note?.startsWith(`Déployé en production (${IMAGE}`)),
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
