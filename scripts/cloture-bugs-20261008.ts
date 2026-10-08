/**
 * Clôture des 5 signalements OPEN des 06 et 07/10/2026 et des 2 propositions
 * `/communaute` du 07/10, APRÈS bascule de l'image qui les traite (lot du
 * 2026-10-08 : périodes de floraison et de récolte des variétés, catégorie
 * « liane », bouton Communauté, entrée « Mes demandes » du menu du profil).
 *
 * Reproduit le clic de l'administrateur : statut, note, `resolvedAt`, journal
 * `bug_status_logs` signé par le compte admin ; statut et note des évolutions
 * (PATCH /api/evolutions/[id]). Le mail de résolution (`feedbackResolvedEmail`)
 * ne part qu'avec `--envoyer`, AVANT le classement (un ticket déjà RESOLVED
 * n'en reçoit plus), et seulement aux tickets d'un compte réel : ceux de la
 * vigie sont portés par le compte admin. Tout envoi exige l'accord de Tinky.
 *
 * Usage (depuis l'hôte, DATABASE_URL et SMTP chargés depuis .env) :
 *   npx tsx --env-file=.env scripts/cloture-bugs-20261008.ts              # simulation
 *   npx tsx --env-file=.env scripts/cloture-bugs-20261008.ts --ecrire     # classe, sans mail
 *   npx tsx --env-file=.env scripts/cloture-bugs-20261008.ts --ecrire --envoyer
 */

import { PrismaClient, type BugStatus, type EvolutionStatut } from "@prisma/client"

const prisma = new PrismaClient()
const ADMIN_ID = "admin_gleba_2026"
const IMAGE = process.env.GLEBA_IMAGE_TAG ?? "gleba-app:lot-20261008"

const NOTE_VARIETE =
  "Depuis la fiche de l'espèce > Variétés > Ajouter ou Modifier, une variété porte désormais sa période de récolte et, pour les espèces du verger, sa période de floraison, saisies en dates lisibles (semaine de début, semaine de fin : « de début juillet à mi-août »). La floraison sert à la pollinisation : deux variétés aux floraisons simultanées sont proposées comme pollinisatrices dans Verger > Pollinisation. Le calendrier d'entretien du verger se filtre maintenant par espèce."

const TICKETS: Array<{ id: string; statut: BugStatus; note: string }> = [
  {
    // FB-8HE1W2 — assistant, périodes d'une variété personnelle
    id: "cmuxpk6wz0005xmfyk78he1w2",
    statut: "RESOLVED",
    note: NOTE_VARIETE,
  },
  {
    // FB-5F8067 — vigie, même besoin qualifié depuis la fiche espèce
    id: "vigie667b4a24a36e6537be5f8067",
    statut: "RESOLVED",
    note: `Doublon du signalement FB-8HE1W2 (même utilisateur, même besoin). ${NOTE_VARIETE}`,
  },
  {
    // FB-8TXTMO — assistant, « Mes signalements » absent du menu du profil
    id: "cmuxpprcz0007xmfy768txtmo",
    statut: "RESOLVED",
    note: "Le suivi de vos signalements vit dans le panneau de feedback (bouton en bas à droite de chaque écran), onglet « Mes demandes ». Le menu du profil propose désormais « Mes demandes », qui ouvre directement cet onglet ; l'assistant ne renvoie plus vers une page « Mes signalements », qui n'existe pas.",
  },
  {
    // FB-173DE7 — vigie, communauté introuvable hors du menu du profil
    id: "vigie920d8c73a9f9e84f0f173de7",
    statut: "RESOLVED",
    note: "La communauté a son bouton « Communauté » (mégaphone) dans le bandeau du haut de tous les écrans, et l'entrée du menu du profil s'appelle « Communauté » au lieu de « Community Voice ». L'assistant connaît ces deux accès.",
  },
  {
    // FB-7MMZIJ — widget, devise dollar ou FCFA
    id: "cmuwwa76w0007rsop997mmzij",
    statut: "EVOLUTION_PRODUIT",
    note: "Gleba gère l'euro et le franc Pacifique (territoires français : identifiant légal, taxe et export comptable en dépendent). Une autre devise (dollar, franc CFA) demande d'adapter ce cadre fiscal, les factures et tous les montants affichés : besoin reconnu, enregistré comme évolution. Paramètres > Exploitation l'indique désormais et renvoie vers la page Communauté pour voter.",
  },
]

const EVOLUTIONS: Array<{ id: string; statut: EvolutionStatut; adminNote: string }> = [
  {
    // « Paramétré une nouvelle variété »
    id: "cmuxpz5h2000dxmfy0nnnkekl",
    statut: "LIVREE",
    adminNote:
      "Livré le 2026-10-08 : périodes de floraison et de récolte d'une variété, saisies en dates lisibles depuis la fiche de l'espèce (Variétés > Ajouter ou Modifier) ; filtre par espèce du calendrier d'entretien du verger. L'affichage des floraisons de vos variétés sur ce calendrier reste à venir.",
  },
  {
    // « Catégorie liane »
    id: "cmuxpt4zb0009xmfyqoeyb05w",
    statut: "LIVREE",
    adminNote:
      "Livré le 2026-10-08 : catégorie « Liane fruitière » pour les espèces (kiwi et vigne du catalogue y sont passés), disponible à la création d'une espèce personnelle et dans les filtres du verger et du référentiel. L'emprise sur le plan reste l'envergure saisie sur chaque pied.",
  },
]

async function main() {
  const ecrire = process.argv.includes("--ecrire")
  const envoyer = process.argv.includes("--envoyer")
  const admin = await prisma.user.findUnique({ where: { id: ADMIN_ID }, select: { role: true } })
  if (admin?.role !== "ADMIN") throw new Error(`Compte admin ${ADMIN_ID} introuvable`)

  const existants = await prisma.bugReport.findMany({
    where: { id: { in: TICKETS.map((t) => t.id) } },
    select: {
      id: true,
      status: true,
      user: { select: { email: true, name: true, role: true } },
      _count: { select: { statusLogs: true } },
    },
  })
  const parId = new Map(existants.map((t) => [t.id, t]))
  const manquants = TICKETS.filter((t) => !parId.has(t.id))
  if (manquants.length > 0) throw new Error(`Tickets introuvables : ${manquants.map((t) => t.id).join(", ")}`)

  const evolutions = await prisma.evolution.findMany({
    where: { id: { in: EVOLUTIONS.map((e) => e.id) } },
    select: { id: true, statut: true, titre: true },
  })
  const evoParId = new Map(evolutions.map((e) => [e.id, e]))
  const evoManquantes = EVOLUTIONS.filter((e) => !evoParId.has(e.id))
  if (evoManquantes.length > 0) throw new Error(`Évolutions introuvables : ${evoManquantes.map((e) => e.id).join(", ")}`)

  const aTraiter = TICKETS.filter((t) => ["OPEN", "IN_PROGRESS"].includes(parId.get(t.id)!.status))
  console.log(`${aTraiter.length} ticket(s) à classer, ${TICKETS.length - aTraiter.length} déjà classé(s)`)
  for (const t of aTraiter) {
    const e = parId.get(t.id)!
    const mail =
      t.statut === "RESOLVED" && e.user.role !== "ADMIN" && e._count.statusLogs === 0
        ? envoyer ? "mail à envoyer" : "mail possible (--envoyer)"
        : "sans mail"
    console.log(`  ${t.id} ${e.status} → ${t.statut} [${mail}]`)
  }
  const evoATraiter = EVOLUTIONS.filter((e) => evoParId.get(e.id)!.statut !== e.statut)
  console.log(`${evoATraiter.length} évolution(s) à passer en LIVREE`)
  for (const e of evoATraiter) console.log(`  ${e.id} ${evoParId.get(e.id)!.statut} → ${e.statut} (${evoParId.get(e.id)!.titre})`)
  if (!ecrire) {
    console.log("--- simulation : rien écrit (ajouter --ecrire, puis --envoyer pour les mails) ---")
    return
  }

  const maintenant = new Date()
  for (const t of aTraiter) {
    const e = parId.get(t.id)!
    if (envoyer && t.statut === "RESOLVED" && e.user.role !== "ADMIN" && e._count.statusLogs === 0) {
      // Même chemin que PATCH /api/admin/bugs/[id] : le mail part avant le classement.
      const { feedbackResolvedEmail, sendMail } = await import("../src/lib/mail")
      const courriel = feedbackResolvedEmail(e.user.name)
      await sendMail({ to: e.user.email, subject: courriel.subject, html: courriel.html })
      console.log(`mail envoyé ${t.id}`)
    }
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
          fromStatus: e.status,
          toStatus: t.statut,
          changedById: ADMIN_ID,
          note: `Lot du 2026-10-08 déployé (${IMAGE}). ${t.note}`,
        },
      }),
    ])
    console.log(`${t.statut} ${t.id}`)
  }
  for (const e of evoATraiter) {
    await prisma.evolution.update({ where: { id: e.id }, data: { statut: e.statut, adminNote: e.adminNote } })
    console.log(`${e.statut} ${e.id}`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
