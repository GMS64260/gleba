/**
 * Clôture des 3 signalements QA (« Julien V7 », compte démo) du 2026-09-28
 * après-midi, APRÈS bascule de l'image qui corrige les deux premiers.
 *
 * Usage (depuis l'hôte, DATABASE_URL chargé depuis .env) :
 *   npx tsx --env-file=.env scripts/cloture-bugs-20260928-apres-midi.ts            # simulation
 *   npx tsx --env-file=.env scripts/cloture-bugs-20260928-apres-midi.ts --ecrire   # écrit
 */

import { PrismaClient, type BugStatus } from "@prisma/client"

const prisma = new PrismaClient()
const ADMIN_ID = "admin_gleba_2026"
const IMAGE = process.env.GLEBA_IMAGE_TAG ?? "gleba-app:lot-20260928-pm"

const TICKETS: Array<{ id: string; statut: BugStatus; note: string }> = [
  {
    id: "cmul7vold000513qw4yplaky7",
    statut: "RESOLVED",
    note: "Le sélecteur de saison des neuf écrans de Planification est désormais un seul composant natif (SelecteurAnneePlanification) : plus de Select Radix recopié, le choix suit tout mode de saisie et met l'URL à jour.",
  },
  {
    id: "cmul80vst000713qw9w820zg0",
    statut: "RESOLVED",
    note: "Non reproductible sur le code déployé à 11:49 UTC : prouvé en navigateur réel (Chromium, compte démo, scripts/verif-navigateur-carte-fond.cjs) avec quatre façons de choisir Satellite IGN, le fond est persisté et survit au rechargement. Le recontrôle a probablement tourné sur l'ancien bundle encore chargé.",
  },
  {
    id: "cmul84zro000913qwqrkhxbkv",
    statut: "RESOLVED",
    note: "« En retard » signifiait « avant le lundi de la semaine affichée », donc tout le printemps d'une saison future. Une tâche n'est en retard que si sa date est passée aujourd'hui et antérieure à la semaine affichée : la saison 2027 n'a plus de retard en 2026.",
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
        data: { status: t.statut, adminNote: t.note, resolvedAt: t.statut === "RESOLVED" ? maintenant : null },
      }),
      prisma.bugStatusLog.create({
        data: {
          bugReportId: t.id,
          fromStatus: avant,
          toStatus: t.statut,
          changedById: ADMIN_ID,
          note: `Lot du 2026-09-28 après-midi déployé (${IMAGE}). ${t.note}`,
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
