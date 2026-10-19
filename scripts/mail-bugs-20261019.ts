/**
 * Petit mot à l'auteur du blocage d'assistant du 2026-10-18 (variété perso
 * introuvable), classé RESOLVED par `cloture-bugs-20261019.ts` sans mail :
 * envoi sur accord explicite de Guillaume (2026-10-19), ton simple, sans
 * jargon. N'affiche ni l'adresse ni le nom ; trace l'envoi dans
 * `bug_status_logs` et refuse de renvoyer s'il est déjà tracé.
 *
 *   npx tsx --env-file=.env scripts/mail-bugs-20261019.ts            # simulation
 *   npx tsx --env-file=.env scripts/mail-bugs-20261019.ts --envoyer
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const ADMIN_ID = "admin_gleba_2026"
const TICKET = "cmve8syvr0073e9gp964mf4f4"
const TRACE = "Mail envoyé à l'utilisateur"

const echapper = (texte: string) =>
  texte.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#039;" })[c]!)

function courriel(nom: string | null) {
  const bonjour = nom?.trim() ? `Bonjour ${echapper(nom.trim())},` : "Bonjour,"
  const paragraphes = [
    bonjour,
    "Hier soir, vous avez demandé à l'assistant de Gleba de créer une culture de salade Carmen, et il vous a répondu que cette variété n'existait pas. Elle était pourtant bien enregistrée dans vos variétés : c'est l'assistant qui ne savait pas la retrouver.",
    "C'est corrigé depuis ce matin. L'assistant reconnaît maintenant les variétés que vous avez ajoutées vous-même, et il suffit de lui donner leur nom.",
    "Merci pour ce signalement, il nous a permis de régler le problème pour tout le monde. Si quelque chose d'autre vous gêne, n'hésitez pas à nous le dire.",
    "Bonne journée,<br>L'équipe Gleba",
  ]
  return {
    subject: "Gleba : l'assistant retrouve maintenant vos variétés",
    html: `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1e293b;line-height:1.5">${paragraphes.map((p) => `<p>${p}</p>`).join("")}</body></html>`,
  }
}

async function main() {
  const envoyer = process.argv.includes("--envoyer")
  const t = await prisma.bugReport.findUnique({
    where: { id: TICKET },
    select: {
      status: true,
      user: { select: { email: true, name: true, role: true, active: true } },
      statusLogs: { select: { note: true } },
    },
  })
  if (!t) throw new Error(`Ticket ${TICKET} introuvable`)
  if (t.status !== "RESOLVED") throw new Error(`Ticket en ${t.status}, attendu RESOLVED`)
  if (t.user.role === "ADMIN" || !t.user.active) throw new Error("Destinataire inattendu (admin ou compte inactif)")
  if (t.statusLogs.some((l) => l.note?.startsWith(TRACE))) {
    console.log("Mail déjà envoyé (tracé dans bug_status_logs) : rien à faire")
    return
  }

  const c = courriel(t.user.name)
  console.log(`Objet : ${c.subject}`)
  console.log(c.html.replace(/<br>/g, "\n").replace(/<\/p>/g, "\n\n").replace(/<[^>]+>/g, "").replace(/&#039;/g, "'").trim())
  if (!envoyer) {
    console.log("--- simulation : rien envoyé (ajouter --envoyer) ---")
    return
  }

  const { sendMail } = await import("../src/lib/mail")
  await sendMail({ to: t.user.email, subject: c.subject, html: c.html })
  await prisma.bugStatusLog.create({
    data: {
      bugReportId: TICKET,
      fromStatus: "RESOLVED",
      toStatus: "RESOLVED",
      changedById: ADMIN_ID,
      note: `${TRACE} le ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC (accord de Guillaume) : « ${c.subject} ».`,
    },
  })
  console.log("Mail envoyé et tracé")
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
