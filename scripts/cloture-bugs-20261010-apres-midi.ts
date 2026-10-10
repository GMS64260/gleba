/**
 * Classement des 5 signalements QA v7 OPEN les plus récents du 2026-10-10
 * (12:54 à 13:00 UTC, plus l'intervention orpheline de 10:39), corrigés dans
 * le dépôt et revus (revue adversariale, retouches b7a2e88), AVANT déploiement (décision du 2026-10-10 : un ticket QA
 * peut passer RESOLVED après correctif commité et revu ; la ligne du journal
 * dit « en attente de déploiement », le ticket ne vaut preuve qu'après bascule
 * et effet constaté).
 *
 * cmv29egw6 (rappel de soin, non reproduit) reste OPEN : il n'est pas ici.
 *
 * Reproduit le clic de l'administrateur : statut, note, `resolvedAt`, journal
 * `bug_status_logs` signé par le compte admin. Aucun mail : les cinq tickets
 * sont portés par le compte admin (agents QA).
 *
 * Usage (depuis l'hôte, DATABASE_URL chargé depuis .env) :
 *   npx tsx --env-file=.env scripts/cloture-bugs-20261010-apres-midi.ts           # simulation
 *   npx tsx --env-file=.env scripts/cloture-bugs-20261010-apres-midi.ts --ecrire  # classe
 */

import { PrismaClient, type BugStatus } from "@prisma/client"

const prisma = new PrismaClient()
const ADMIN_ID = "admin_gleba_2026"
const LOT = "Lot du 2026-10-10 après-midi corrigé dans le dépôt"

const TICKETS: Array<{ id: string; statut: BugStatus; commits: string; note: string }> = [
  {
    // Intervention orpheline après suppression de planche
    id: "cmv29i9ad002kpm50h68bqt69",
    statut: "RESOLVED",
    commits: "f3c3a9b, b7a2e88",
    note: "Une planche ne se supprime plus tant que des cultures ou des interventions s'y rattachent : la suppression est refusée avec un message qui dit ce qui la retient, les années où retrouver ces interventions dans la liste, et quoi faire (les supprimer ou les rattacher à une autre planche). Même règle pour la conversion d'une planche en objet du plan et pour l'assistant. Les fertilisations importées, qui partent avec la planche, sont annoncées avant de confirmer. Une intervention dont la planche a déjà été supprimée, comme celle du test, affiche « Planche supprimée » au lieu de l'identifiant brut.",
  },
  {
    // Productions — changement d'arbre d'une récolte ignoré
    id: "cmv2ebsdk0007riklpplu6fw2",
    statut: "RESOLVED",
    commits: "1d45ab9, b7a2e88",
    note: "La modification d'une récolte de fruits enregistre désormais l'arbre choisi : le serveur ignorait ce champ. L'arbre est revérifié dans votre compte ; si l'espèce change, un numéro de lot automatique est recalculé, un lot saisi à la main n'est jamais modifié. Le champ Arbre est devenu une liste déroulante native, qui suit tous les modes de saisie.",
  },
  {
    // Animaux & Lots — sous-onglet Lots perdu au rechargement
    id: "cmv2ec55b0009riklvvwblcmy",
    statut: "RESOLVED",
    commits: "1becefc, b7a2e88",
    note: "Le sous-onglet Lots d'Élevage > Animaux & Lots s'inscrit maintenant dans l'adresse (/elevage?tab=animaux&sub=lots) et survit au rechargement. Même correction pour les sous-onglets d'Alimentation, le lien ?tab=lots, la cible de traite et le retrait des paramètres de lien direct (modification d'un animal, d'un lot ou d'un abattage, nouveau soin), qui ne rouvrent plus un formulaire au rechargement.",
  },
  {
    // Météo / irrigation — culture en récolte affichée comme semée
    id: "cmv2eg99z000friklnf6634gp",
    statut: "RESOLVED",
    commits: "abcd82a",
    note: "Le conseil d'irrigation de la page Météo affiche le même état que la liste des cultures : une culture dont la récolte est faite apparaît « En récolte ». L'état y était recalculé sans tenir compte de la récolte. « Recalculer maintenant » applique la correction sans attendre l'expiration du cache.",
  },
  {
    // Productions — date de récolte saisie non conservée
    id: "cmv2ejjvp000jrikl2man4cl9",
    statut: "RESOLVED",
    commits: "1d45ab9",
    note: "La date affichée dans le formulaire de récolte de fruits est celle enregistrée, à la création comme à la modification : le champ est relu au moment d'enregistrer et resynchronisé quand on le quitte. Le formulaire gardait la date du jour quand la saisie n'atteignait pas l'état de l'écran. Une date incomplète est refusée avec un message. Même traitement pour la date de péremption.",
  },
]

async function main() {
  const ecrire = process.argv.includes("--ecrire")
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
