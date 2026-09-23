/**
 * Clôture des 14 signalements du lot « 15 bugs déclarés » du 2026-09-19,
 * APRÈS bascule de l'image qui les corrige.
 *
 * Reproduit ce que fait PATCH /api/admin/bugs/[id] quand l'administrateur
 * clique « Résolu » : statut RESOLVED + resolvedAt, journal bug_status_logs
 * signé par le compte admin, et mail de résolution (feedbackResolvedEmail)
 * au compte déclarant — seulement si aucun log RESOLVED n'existe déjà
 * (shouldSendResolutionEmail). Deux écarts assumés par rapport au clic :
 *   - un seul mail par compte déclarant, même s'il porte plusieurs tickets
 *     (quatre mails identiques à la même personne en une minute seraient
 *     lus comme un défaut) ;
 *   - aucun mail pour les tickets portés par le compte ADMIN (entrées de la
 *     vigie Paperclip : le déclarant est la vigie, pas un utilisateur).
 *
 * Usage (depuis l'hôte, DATABASE_URL chargé depuis .env) :
 *   npx tsx scripts/cloture-bugs-20260919.ts             # simulation
 *   npx tsx scripts/cloture-bugs-20260919.ts --envoyer   # écrit et envoie
 */

import { PrismaClient } from "@prisma/client"
import { feedbackResolvedEmail, sendMail } from "../src/lib/mail"
import { shouldSendResolutionEmail } from "../src/lib/feedback-public"

const prisma = new PrismaClient()
const ADMIN_ID = "admin_gleba_2026"
const IMAGE = process.env.GLEBA_IMAGE_TAG ?? "gleba-app:20260919-bugs15"

const TICKETS = [
  "cmtyjtvk3001ns509dspdtg4q",
  "cmu4mp12y002m1wcbytujre49",
  "cmu6mw1dn003n1wcbqzgw7dzy",
  "vigie5388491193fadcb7e8e383c4",
  "vigie0abcc08c8662d23884ad2516",
  "vigie459b2072dc5bb29c48ebb74d",
  "vigie233671876a4be8fa207a69eb",
  "cmu6tpz930005y8vmmf0u47ji",
  "vigiebd964114c562a64c96f2bbd0",
  "cmu6w626e0021y8vmtb7fw1xi",
  "cmu6wifjt0025y8vmieroil53",
  "vigie3cad49684a85fd96829b7aa5",
  "cmu75dtu80003poajra2xkcxi",
  "vigiedfad0de0b0df1580120619ce",
]

async function main() {
  const envoyer = process.argv.includes("--envoyer")
  const admin = await prisma.user.findUnique({ where: { id: ADMIN_ID }, select: { id: true, role: true } })
  if (!admin || admin.role !== "ADMIN") throw new Error(`Compte admin ${ADMIN_ID} introuvable`)

  const tickets = await prisma.bugReport.findMany({
    where: { id: { in: TICKETS } },
    select: {
      id: true,
      status: true,
      user: { select: { id: true, email: true, name: true, role: true } },
      statusLogs: { where: { toStatus: "RESOLVED" }, select: { id: true }, take: 1 },
    },
    orderBy: { createdAt: "asc" },
  })
  const manquants = TICKETS.filter((id) => !tickets.some((t) => t.id === id))
  if (manquants.length > 0) throw new Error(`Tickets introuvables : ${manquants.join(", ")}`)

  const aCloturer = tickets.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS")
  const dejaFaits = tickets.filter((t) => !aCloturer.includes(t))
  console.log(`${aCloturer.length} ticket(s) à clôturer, ${dejaFaits.length} déjà classé(s) : ${dejaFaits.map((t) => `${t.id}=${t.status}`).join(", ") || "aucun"}`)

  // Un mail par compte déclarant non-admin, si aucun ticket du compte n'a déjà
  // été notifié (même règle que l'API, appliquée au premier ticket du compte).
  const destinataires = new Map<string, { email: string; name: string | null; tickets: string[] }>()
  for (const t of aCloturer) {
    if (t.user.role === "ADMIN") continue
    if (!shouldSendResolutionEmail(t.status, "RESOLVED", t.statusLogs.length > 0)) continue
    const entree = destinataires.get(t.user.id) ?? { email: t.user.email, name: t.user.name, tickets: [] }
    entree.tickets.push(t.id)
    destinataires.set(t.user.id, entree)
  }
  for (const [, d] of destinataires) {
    console.log(`mail → ${d.email} (${d.tickets.length} ticket(s) : ${d.tickets.join(", ")})`)
  }

  if (!envoyer) {
    console.log("\n--- simulation : rien écrit, rien envoyé (ajouter --envoyer) ---")
    return
  }

  const maintenant = new Date()
  for (const t of aCloturer) {
    await prisma.$transaction([
      prisma.bugReport.update({
        where: { id: t.id },
        data: { status: "RESOLVED", resolvedAt: maintenant },
      }),
      prisma.bugStatusLog.create({
        data: {
          bugReportId: t.id,
          fromStatus: t.status,
          toStatus: "RESOLVED",
          changedById: ADMIN_ID,
          note: `Lot du 2026-09-19 déployé (${IMAGE}).`,
        },
      }),
    ])
    console.log(`RESOLVED ${t.id} (depuis ${t.status})`)
  }

  for (const [, d] of destinataires) {
    const email = feedbackResolvedEmail(d.name)
    try {
      await sendMail({ to: d.email, subject: email.subject, html: email.html })
      console.log(`mail envoyé → ${d.email}`)
    } catch (err) {
      console.error(`mail NON envoyé → ${d.email} :`, err instanceof Error ? err.message : err)
    }
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
