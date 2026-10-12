/**
 * Classement des trois signalements QA déposés le 2026-10-12 entre 08:13 et
 * 08:17 UTC (compte admin, campagne QA : aucun mail), même mécanique que
 * `cloture-bugs-20261011b.ts` (PATCH /api/admin/bugs/[id] reproduit : statut,
 * `resolved_at`, `bug_status_logs`).
 *
 * Correctifs revus par un relecteur indépendant (REVISE, dix retouches) puis
 * contre-revus, déployés dans `gleba-app:aa9f8de` (bascule 09:19:25 UTC, après une première à 09:08:37 sur gleba-app:f41dd2f)
 * et prouvés sur gleba.fr, compte démo, par `scripts/qa/sonde-lot-20261012.cjs`
 * (toute écriture d'API interceptée). Une seule ligne de journal par ticket :
 * corrigé ET déployé.
 *
 * Usage (depuis l'hôte, DATABASE_URL chargé depuis .env) :
 *   npx tsx --env-file=.env scripts/cloture-bugs-20261012.ts           # simulation
 *   npx tsx --env-file=.env scripts/cloture-bugs-20261012.ts --ecrire  # classe
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const ADMIN_ID = "admin_gleba_2026"
const BASCULE =
  "Corrigé (commits COMMITS), déployé en production (gleba-app:aa9f8de, bascule 09:19 UTC le 2026-10-12), non poussé sur GitHub. Effet constaté sur gleba.fr, compte démo"

type Ticket = { id: string; commits: string; note: string; effet: string }

const TICKETS: Ticket[] = [
  {
    // Cultures — ITP sous abri appliqué sans type de planche
    id: "cmv4z6yhg000ewzplh0diaj66",
    commits: "93038a2, aa9f8de",
    note: "Le formulaire proposait d'office le premier itinéraire du catalogue quelle que soit la planche : pour Radis, « sous abri forcé ». La proposition tient maintenant compte du type de la planche : planche de plein champ, serre ou tunnel → premier itinéraire conduit de la même façon ; planche sans type → aucun itinéraire proposé d'office (sauf si le premier n'impose aucune conduite), les dates calculées sont retirées et un avis sous le champ explique quoi faire, avec un lien « Planche à compléter : type ». Un itinéraire choisi à la main n'est jamais modifié ; s'il contredit le type de la planche, l'avis le dit (création et fiche de culture) et le serveur renvoie un avertissement non bloquant. Une planche sans type n'est jamais supposée en plein champ, comme pour l'arrosage.",
    effet: "Nouvelle culture Radis : sans planche → « sous abri forcé · impl. S2 » (premier par confiance, comme avant) ; Planche 15 (sans type) → champ ITP vide, dates vidées, avis « Aucun itinéraire proposé d’office… » avec le lien « Planche à compléter : type » vers la fiche ; A1 (Serre) → « sous abri forcé » ; B1 (Plein champ) → « plein champ · impl. S14 » ; choix manuel « sous abri » sur B1 → ITP conservé, avis « est conduit sous abri ; la planche « B1 » est en plein champ » ; retour sur Planche 15 → ITP conservé, avis « n’a pas de type … sans qu’on puisse le vérifier ».",
  },
  {
    // Interventions — Filtre d'année perdu après rechargement
    id: "cmv4z983m000hwzplzw1cemfx",
    commits: "c939a5b",
    note: "L'année choisie ne vivait que dans l'état de la page. Elle est maintenant dans l'adresse (?annee=2025), lue au chargement et écrite à chaque changement : un rechargement ou un lien partagé gardent l'année, et la liste est chargée directement pour cette année. Les paramètres d'ouverture d'une fiche (nouvelle, prefill) sont retirés sans toucher à l'année.",
    effet: "Choix de 2025 → URL ?annee=2025, une seule lecture pour 2025 ; F5 → sélecteur sur 2025, lecture de 2025 seulement ; ?annee=2025&nouvelle=1 → fiche ouverte, URL nettoyée en ?annee=2025.",
  },
  {
    // Aujourd'hui — Calendrier lunaire introuvable dans le nouvel accueil
    id: "cmv4zb9yy000jwzpl5bye3ec8",
    commits: "f41dd2f, b01f20a",
    note: "Le calendrier lunaire vivait dans l'en-tête historique, que le rail du nouvel accueil remplace sur grand écran. Il est maintenant dans le rail (entrée « Calendrier lunaire », sur toutes les pages), dans l'en-tête de la page Aujourd'hui sur téléphone, dans la tuile Raccourcis et dans la palette (⌘ K), qui l'ouvrent directement.",
    effet: "À 1301 px, rail : entrée « 🌒 Calendrier lunaire » → popover (phase, illumination, type de jour, calendrier du mois) ; palette : entrée « Calendrier lunaire » présente, ouvre le même popover. À 375 px : bouton d’en-tête visible (rail masqué), popover de 320 px ; débordement horizontal corrigé (b01f20a) et vérifié.",
  },
]

async function main() {
  const ecrire = process.argv.includes("--ecrire")
  const admin = await prisma.user.findUnique({ where: { id: ADMIN_ID }, select: { role: true } })
  if (admin?.role !== "ADMIN") throw new Error(`Compte admin ${ADMIN_ID} introuvable`)
  if (TICKETS.some((t) => /^(COMMIT_|EFFET_)/.test(t.commits) || /^EFFET_/.test(t.effet))) {
    throw new Error("Script non renseigné : commits et effets à compléter")
  }

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
  for (const t of aTraiter) console.log(`  ${t.id} ${parId.get(t.id)!.status} → RESOLVED (commits ${t.commits})`)
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
        data: { status: "RESOLVED", adminNote: t.note, resolvedAt: maintenant },
      }),
      prisma.bugStatusLog.create({
        data: {
          bugReportId: t.id,
          fromStatus: e.status,
          toStatus: "RESOLVED",
          changedById: ADMIN_ID,
          note: `${BASCULE.replace("COMMITS", t.commits)} : ${t.effet} ${t.note}`,
        },
      }),
    ])
    console.log(`RESOLVED ${t.id}`)
  }
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
