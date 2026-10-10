/**
 * Classement du lot 2 des signalements QA v7 du 2026-10-10 (13:00 à 13:10
 * UTC), corrigés dans le dépôt et revus (revue adversariale, retouches
 * 9190fb5), AVANT déploiement — même règle et même mécanique que
 * `cloture-bugs-20261010-apres-midi.ts` (journal « en attente de
 * déploiement », aucun mail : tickets du compte admin).
 *
 * cmv29egw6 (rappel de soin, non reproduit) reste OPEN.
 *
 * Usage (depuis l'hôte, DATABASE_URL chargé depuis .env) :
 *   npx tsx --env-file=.env scripts/cloture-bugs-20261010-lot2.ts           # simulation
 *   npx tsx --env-file=.env scripts/cloture-bugs-20261010-lot2.ts --ecrire  # classe
 */

import { PrismaClient, type BugStatus } from "@prisma/client"

const prisma = new PrismaClient()
const ADMIN_ID = "admin_gleba_2026"
const LOT = "Lot 2 du 2026-10-10 corrigé dans le dépôt"

const TICKETS: Array<{ id: string; statut: BugStatus; commits: string; note: string }> = [
  {
    // Cartographie — centrage parcelle : fond entièrement vert
    id: "cmv2ek8t6000lriklcw9dvetb",
    statut: "RESOLVED",
    commits: "1ad9aff",
    note: "« Centrer sur la parcelle » ne recouvre plus la carte d'un aplat vert. Le centrage animait un vol de la France entière jusqu'au zoom 18 ; pendant ce vol, la carte agrandissait le dessin des contours sans le recalculer, et une petite parcelle, réduite à un point au départ, devenait un disque qui masquait tout jusqu'à la fin de l'animation (d'où le retour à la normale après un zoom arrière). Le centrage est désormais immédiat, contours, photo satellite et cadastre visibles aussitôt ; un vol interrompu par un glisser ne laisse plus les contours perdus.",
  },
  {
    // Fiche animal / ruche — observations des soins absentes de l'historique
    id: "cmv2emln0000priklvovn42rd",
    statut: "RESOLVED",
    commits: "6ee479d, 9190fb5",
    note: "L'historique de la fiche (ruche comprise) montre maintenant pour chaque soin sa dose, son motif et ses observations en entier : deux visites du même jour se distinguent par leurs notes. Un soin encore à faire indique sa date prévue.",
  },
  {
    // Consommations / Économie — répartition globale annoncée mais non appliquée
    id: "cmv2evlla0011riklx1t6one2",
    statut: "RESOLVED",
    commits: "cb916f3, 9190fb5",
    note: "La saisie rapide dit désormais ce que fait réellement le calcul : une consommation saisie en « Global » reste dans « Non affecté » de l'économie de l'élevage, sans répartition ; seule l'économie lait & fromage en retient une part au prorata des têtes laitières. Pour imputer un coût à un atelier, choisir un lot ou un animal. La méthode affichée sur la page Économie dit la même chose. La ventilation par effectif annoncée jusqu'ici n'avait jamais été calculée.",
  },
  {
    // Météo / irrigation — variété répétée deux fois dans le libellé
    id: "cmv2ex2vq0013riklk4q5trxm",
    statut: "RESOLVED",
    commits: "e892ee7, 9190fb5",
    note: "Les conseils d'irrigation nomment chaque culture une seule fois : « Radis » au lieu de « Radis · Radis — Non spécifiée · Radis — Non spécifiée », « Courge butternut-Waltham », « Aubergine · Violette longue ». La variété de repli « Non spécifiée » n'est plus affichée, et l'espèce n'est pas répétée quand le nom de la variété la contient déjà.",
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
