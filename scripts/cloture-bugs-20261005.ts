/**
 * Clôture du signalement OPEN du 2026-10-05 : ticket automatique de
 * l'assistant (démo, 03/10, « dupliquer / supprimer un arbre depuis le plan »).
 * Cause : connexion Codex des agents Paperclip expirée depuis le 02/10 08:30
 * (« refresh token already used »), reconnectée le 05/10 à 19:52 ; prouvé par
 * une question réelle à 19:57 (réponse en 9 s). La duplication d'arbre
 * demandée est livrée par ae89c0e.
 *
 * Usage : npx tsx --env-file=.env scripts/cloture-bugs-20261005.ts [--ecrire]
 */

import { PrismaClient, type BugStatus } from "@prisma/client"

const prisma = new PrismaClient()
const ADMIN_ID = "admin_gleba_2026"
const IMAGE = process.env.GLEBA_IMAGE_TAG ?? "gleba-app:ae89c0e"

const TICKETS: Array<{ id: string; statut: BugStatus; note: string }> = [
  {
    id: "cmus796om001rk6bhdhhrxrp4",
    statut: "RESOLVED",
    note: "L'assistant ne répondait plus : la connexion de ses agents avait expiré le 02/10. Rétablie le 05/10 et vérifiée. Dupliquer un arbre est désormais possible depuis le plan (panneau de l'arbre, bouton « Dupliquer ») et depuis l'onglet Arbres ; supprimer : bouton « Supprimer » du même panneau.",
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
