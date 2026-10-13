/**
 * Classement des signalements QA déposés le 2026-10-12 entre 14:32 et 17:54 UTC
 * (compte admin, campagne QA : aucun mail), même mécanique que
 * `cloture-bugs-20261012.ts` (PATCH /api/admin/bugs/[id] reproduit : statut,
 * `resolved_at`, `bug_status_logs`).
 *
 * Correctifs commités et revus par un relecteur indépendant, PAS ENCORE
 * déployés (règle du 2026-10-10 : RESOLVED après correctif commité et revu ;
 * la ligne de journal commence par « Lot du … corrigé dans le dépôt …, en
 * attente de déploiement » et ne vaut preuve qu'après bascule et effet
 * constaté).
 *
 * Usage (depuis l'hôte, DATABASE_URL chargé depuis .env) :
 *   npx tsx --env-file=.env scripts/cloture-bugs-20261013.ts           # simulation
 *   npx tsx --env-file=.env scripts/cloture-bugs-20261013.ts --ecrire  # classe
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const ADMIN_ID = "admin_gleba_2026"
const ENTETE =
  "Lot du 2026-10-13 corrigé dans le dépôt (commits COMMITS), revu, en attente de déploiement"

type Ticket = { id: string; commits: string; note: string; verification: string }

const TICKETS: Ticket[] = [
  {
    // Plan / Cartographie — fond satellite perdu au rechargement
    id: "cmv5cpu7q00028kcnik2appyj",
    commits: "2da78d1",
    note: "Non reproduit à la main ni par les gestes d'automate usuels : sonde Playwright sur la prod (scripts/qa/sonde-carte-fond-20261013.cjs, 1640×1024, Cadastre IGN déjà coché comme dans le ticket), dix gestes (survol puis clic, clavier, check(), clic sur le texte, bouton Layers forcé puis clic, dispatchEvent, setChecked) : le fond Satellite IGN est écrit en localStorage et retrouvé après F5. Deux gestes d'automate le perdaient, et dans les deux cas Leaflet n'appliquait jamais le fond (tuiles OpenStreetMap avant même le rechargement) : un clic sur « Satellite IGN » tombé dans la même milliseconde que l'ouverture du contrôle par son bouton ou son survol (garde anti-tap de Leaflet 1.9.4, qui annule le clic ; un clic sur le libellé n'atteint même pas le bouton radio), et un « checked » posé par script suivi du seul événement input. Correctif : hors écran tactile (où la garde de Leaflet garde son sens), un clic de sélecteur ou de libellé annulé par cette garde est rejoué une fois la garde levée ; l'événement input est écouté comme change. À noter pour la campagne : le bouton « Layers » disparaît dès que la souris le survole (le contrôle s'ouvre au survol), un clic Playwright ordinaire sur ce bouton expire.",
    verification: "Preuve par la sonde après la bascule : gestes I, I2 et P attendus OK (avant correctif : PERDU), les neuf autres inchangés.",
  },
  {
    // Production / Œufs — poussins comptés comme pondeuses
    id: "cmv5jfsol000d8kcnr8aoiuc3",
    commits: "0e1926c",
    note: "L'effectif pondeur reprenait l'effectif reconstitué du lot, donc toute tête présente, poussins du jour compris. Une règle unique (src/lib/elevage/pondeuses.ts) retire maintenant de l'effectif pondeur les animaux nés dans le lot tant qu'ils n'ont pas l'âge d'entrée en ponte de l'espèce (durée d'élevage de l'espèce, 150 jours pour la poule pondeuse, 150 par défaut) ainsi que les fiches nominatives rattachées au lot de sexe mâle ou trop jeunes. Elle sert au compteur « N pondeuses » et au taux de ponte (observé et attendu) de Production > Œufs et du tableau de bord, à la collecte attendue du calendrier, et à l'aide à la saisie de ponte, qui annonce désormais « ~12 œufs/jour attendu pour 30 pondeuses (33 Poule pondeuse, dont 3 trop jeunes ou mâles) ». L'effectif du lot reste à 33. Limite assumée : passé l'âge de ponte, les mâles d'une éclosion anonyme comptent tant qu'ils ne sont pas sortis (abattage, vente, fiche), faute de savoir quelles têtes anonymes ont quitté le lot.",
    verification: "Tests unitaires de la règle (10 cas, dont le scénario du ticket : 30 + éclosion de 3 → 30 pondeuses) ; preuve par l'effet sur gleba.fr à faire après la bascule.",
  },
  {
    // Calendrier — semaine perdue au rechargement
    id: "cmv5jwqub000r8kcnwhbkba1h",
    commits: "6c7bdb9",
    note: "La semaine affichée ne vivait que dans l'état de l'onglet. Elle est maintenant dans l'adresse (?semaine=AAAA-MM-JJ, lundi de la semaine, absent pour la semaine courante), écrite à chaque flèche et lue au chargement : un rechargement, un lien partagé ou le retour arrière gardent la semaine, le paramètre tab est conservé, un paramètre invalide retombe sur la semaine courante.",
    verification: "Preuve par l'effet sur gleba.fr à faire après la bascule : semaine suivante → URL ?tab=calendrier&semaine=2026-10-19, F5 → jours 19–25 ; semaine précédente → semaine=2026-10-05, F5 → jours 5–11 ; « Cette semaine » → paramètre retiré.",
  },
  {
    // Économie — libellés non accentués
    id: "cmv5jxvcy000t8kcnuod82wj2",
    commits: "9a55ad9",
    note: "Le fil d'Ariane capitalise tel quel tout segment d'URL absent de sa table : « Economie » (ajoutés : Économie, Pâturage, Tournée, Lots et les autres segments accentués de l'application). L'atelier de la page Économie fabriquait son nom depuis la clé technique de la vente (« Ventes oeufs ») : les libellés des types de vente sont désormais partagés avec l'onglet Ventes (src/lib/elevage/types-vente.ts) → « Ventes œufs », « Ventes gelée royale »…",
    verification: "Preuve par l'effet sur gleba.fr à faire après la bascule : /elevage/economie → fil d'Ariane « Économie », atelier « Ventes œufs ».",
  },
]

async function main() {
  const ecrire = process.argv.includes("--ecrire")
  const admin = await prisma.user.findUnique({ where: { id: ADMIN_ID }, select: { role: true } })
  if (admin?.role !== "ADMIN") throw new Error(`Compte admin ${ADMIN_ID} introuvable`)

  if (TICKETS.some((t) => /^COMMIT_/.test(t.commits))) {
    throw new Error("Script non renseigné : commits à compléter")
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
          note: `${ENTETE.replace("COMMITS", t.commits)}. ${t.note} Vérification : ${t.verification}`,
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
