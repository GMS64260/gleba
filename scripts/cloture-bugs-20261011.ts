/**
 * Classement des sept signalements QA restés OPEN au 2026-10-11 (vagues du
 * 2026-10-10), même mécanique que `cloture-bugs-20261010-soir.ts` (PATCH
 * /api/admin/bugs/[id] reproduit : statut, `resolved_at`, `bug_status_logs`).
 * Tickets du compte admin (campagne QA) : aucun mail.
 *
 * - Cinq correctifs du lot du 2026-10-11, commités et revus, en attente de
 *   déploiement.
 * - cmv2sr80i : défaut causé par le sélecteur d'arbre (cmv2r0t6a), corrigé par
 *   b2e2d94, déjà en production ; suppression prouvée sur gleba.fr le
 *   2026-10-11 (scripts/qa/sonde-suppression-arbre.cjs).
 * - cmv29egw6 : non reproduit, cause hors code (outil de pilotage) :
 *   HORS_PERIMETRE, sans `resolved_at`, comme le fait l'écran admin.
 *
 * Usage (depuis l'hôte, DATABASE_URL chargé depuis .env) :
 *   npx tsx --env-file=.env scripts/cloture-bugs-20261011.ts           # simulation
 *   npx tsx --env-file=.env scripts/cloture-bugs-20261011.ts --ecrire  # classe
 */

import { PrismaClient, type BugStatus } from "@prisma/client"

const prisma = new PrismaClient()
const ADMIN_ID = "admin_gleba_2026"
const LOT = "Lot du 2026-10-11 corrigé dans le dépôt"

type Ticket = {
  id: string
  statut: BugStatus
  commits: string
  /** Journal : le correctif est-il déjà en service ? */
  etat: "a-deployer" | "en-production" | "hors-code"
  note: string
}

const TICKETS: Ticket[] = [
  {
    // Ventes — une récolte en tiges repasse en kilogrammes
    id: "cmv2r1oao000zescpud8u80x6",
    statut: "RESOLVED",
    commits: "dd3af0a",
    etat: "a-deployer",
    note: "La vente d'une récolte parle de son unité. Pour « Zinnia 5 tiges », la fenêtre affiche « Zinnia - 5 tiges », « Prix par tige » et « Quantité vendue (tiges) » ; une quantité en tiges, pièces ou bottes est un nombre entier, et le plafond est donné dans la même unité. La facture créée avec la vente porte des tiges et non plus des kilos, comme l'écriture comptable automatique.",
  },
  {
    // Cultures — la correction proposée à 2 rangs reste refusée
    id: "cmv2r1v630011escp2qegdggh",
    statut: "RESOLVED",
    commits: "2e86fdb",
    etat: "a-deployer",
    note: "Rejoué sur le compte démo : après le refus de largeur, 2 rangs saisis partent bien à 2 rangs, et la règle de l'enregistrement les accepte sur cette planche (besoin 0,35 m pour 0,50 m disponibles). Deux défauts pouvaient donner l'impression inverse. Quand un nouvel enregistrement était bloqué par le formulaire (une date incohérente par exemple), le refus de l'essai précédent restait affiché, d'où « la même erreur revient » ; le message dit maintenant quel champ bloque, et le refus s'efface dès qu'un champ est modifié. Et l'assistant de création calculait la place de la planche avec ses propres règles (30 cm supposés pour l'espacement des cultures en place, toutes les cultures de la planche quelle que soit leur période), si bien que son aperçu et ses suggestions pouvaient contredire l'enregistrement ; il interroge désormais la même règle que l'enregistrement. La suggestion « Réduire à 2 rangs » est aussi un bouton qui l'applique au champ.",
  },
  {
    // Interventions — gestes floricoles absents des types
    id: "cmv2r21ns0013escptie4w6er",
    statut: "RESOLVED",
    commits: "b05ac40",
    etat: "a-deployer",
    note: "La liste des types d'intervention propose maintenant Repiquage, Pincement, Palissage, Ébourgeonnage et Éclaircissage, en plus du Tuteurage et de la Taille. La même liste sert au formulaire, aux filtres, au registre, à la traçabilité et au journal de l'accueil, avec des libellés accentués.",
  },
  {
    // Rotations — étape Oignon 2026 considérée créée par d'autres cultures
    id: "cmv2r2rl80016escpexpwk986",
    statut: "RESOLVED",
    commits: "45d1210, 0af992c, 2e86fdb",
    etat: "a-deployer",
    note: "Une étape de rotation que la planche ne suit pas n'est plus passée sous silence. Sur Marc-v7-QA2-1010, l'Oignon de l'étape 4/4 était écarté sans un mot parce que la planche porte déjà Radis et Zinnia en 2026. Les compteurs prévues, créées et à créer restent ceux des cultures du plan, et « Créer les cultures » liste à part, dans un encadré « cultures de la rotation non créées », ces étapes avec les espèces déjà en place, et permet de créer l'oignon quand même, si la largeur de la planche le permet (même règle que la création d'une culture) ; « Cultures prévues » et la Planification les signalent, et le plan n'est plus annoncé « prêt » tant qu'une de ces cultures manque.",
  },
  {
    // Navigation — interventions introuvables depuis le nouvel accueil
    id: "cmv2r57qk0018escp1os8fd51",
    statut: "RESOLVED",
    commits: "1bfe7e1",
    etat: "a-deployer",
    note: "Le registre des interventions est dans le menu Plus du téléphone et dans la barre latérale du nouvel accueil. « Noter une intervention » ouvre directement une fiche vierge, depuis la recherche (« Demander à Gleba… ») et depuis la page Tâches, où mène le bouton Noter.",
  },
  {
    // Opérations — une opération liée survit à la suppression de l'arbre
    id: "cmv2sr80i001oescpbpqxlpcx",
    statut: "RESOLVED",
    commits: "b2e2d94",
    etat: "en-production",
    note: "L'opération restée visible n'était pas liée à l'arbre supprimé : créée le 10/10 à 20:35 (heure de Paris), elle avait été rattachée à « Cerisier Burlat 1 » par le défaut du champ Arbre d'Opérations, qui envoyait le premier arbre de la liste (signalement cmv2r0t6a, corrigé et en production depuis le 10/10 à 22:52, heure de Paris). L'opération comptée par la confirmation était celle que la création de l'arbre ajoute à son calendrier d'entretien, bien supprimée avec lui. Vérifié sur gleba.fr le 11/10 : un arbre de test, une taille planifiée puis réalisée sur cet arbre, la suppression de l'arbre emporte ses deux opérations, aucune ne reste listée.",
  },
  {
    // Soins — rappel de lot perdu lors de la validation directe
    id: "cmv29egw6002cpm50k17w5mxp",
    statut: "HORS_PERIMETRE",
    commits: "4edeb64",
    etat: "hors-code",
    note: "Non reproduit, cause hors de l'application. Les deux soins du signalement sont arrivés au serveur sans date de rappel : la date n'était pas dans le champ au moment de l'enregistrement, alors que le formulaire relit le champ lui-même à l'envoi. Neuf modes de saisie rejoués à 375 px créent le rappel dès que la date est dans le champ, et le même parcours de la campagne (vermifuge sur le lot, rappel au 14/10) a créé son rappel à 14:59 (heure de Paris) le même jour. Dans Chromium sans interface, la frappe clavier dans un champ date ne remplit rien ou remplit une autre date : c'est la piste retenue. Depuis le 10/10, le message de confirmation nomme la date du rappel créé, ce qui rend un oubli visible tout de suite. À rouvrir si le défaut est revu avec la valeur du champ lue juste avant le clic.",
  },
]

function noteJournal(t: Ticket): string {
  if (t.etat === "en-production") {
    return `Correctif déjà en production (commit ${t.commits}, gleba-app:688d8c8), effet vérifié sur gleba.fr le 2026-10-11. ${t.note}`
  }
  if (t.etat === "hors-code") return `Classé hors périmètre le 2026-10-11. ${t.note}`
  return `${LOT} (commits ${t.commits}), en attente de déploiement. ${t.note}`
}

async function main() {
  const ecrire = process.argv.includes("--ecrire")
  const enAttente = TICKETS.filter((t) => t.commits.includes("__"))
  if (enAttente.length > 0) throw new Error(`Commits non renseignés : ${enAttente.map((t) => t.id).join(", ")}`)
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
        data: {
          status: t.statut,
          adminNote: t.note,
          // Même règle que l'écran admin : seul RESOLVED porte une date de résolution.
          resolvedAt: t.statut === "RESOLVED" ? maintenant : null,
        },
      }),
      prisma.bugStatusLog.create({
        data: {
          bugReportId: t.id,
          fromStatus: e.status,
          toStatus: t.statut,
          changedById: ADMIN_ID,
          note: noteJournal(t),
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
