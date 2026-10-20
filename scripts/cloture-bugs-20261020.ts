/**
 * Classement des signalements de la campagne QA v8 du 2026-10-20 (matin),
 * déposés sur le compte démo (préfixe « v8- »). Aucun mail : agents QA
 * automatisés.
 *
 * Deux familles :
 *  - `corrige` : défaut du code corrigé dans le dépôt par le lot du jour, revu
 *    par un relecteur indépendant, EN ATTENTE DE DÉPLOIEMENT (décision du
 *    2026-10-10 : RESOLVED après correctif commité et revu ; la ligne de
 *    journal le dit) ;
 *  - `hors-code` : artefact d'automate (remplissage d'un champ date ou clic sur
 *    une option sans événement, retiré par l'agent QA lui-même) ou
 *    rectificatif : HORS_PERIMETRE, sans `resolved_at`, comme l'écran admin.
 *
 *   npx tsx --env-file=.env scripts/cloture-bugs-20261020.ts           # simulation
 *   npx tsx --env-file=.env scripts/cloture-bugs-20261020.ts --ecrire  # classe
 */
import { PrismaClient, type BugStatus } from "@prisma/client"

const prisma = new PrismaClient()
const ADMIN_ID = "admin_gleba_2026"
const COMMITS = process.env.COMMITS_LOT ?? "lot du 2026-10-20"

type Etat = "corrige" | "hors-code"
type Ticket = { id: string; etat: Etat; note: string }

const NOTE_AUTOMATE =
  "Non reproduit, cause hors de l'application : l'agent QA l'a lui-même retiré dans un rectificatif. " +
  "La saisie automatisée (remplissage d'un champ date, clic scripté sur une option) changeait la valeur visible sans déclencher d'événement de saisie ; " +
  "le formulaire n'a donc jamais reçu la nouvelle valeur. Rejoué avec une saisie effective (clavier, clic direct), le choix est conservé après rechargement."

const NOTE_RECTIFICATIF =
  "Rectificatif déposé par l'agent QA pour retirer ses propres signalements : pris en compte, les signalements visés sont classés hors périmètre (artefact d'automate)."

export const TICKETS: Ticket[] = [
  // --- Faux positifs d'automate (dates et option ITP), retirés par l'agent QA
  { id: "cmvgd7iv400044jmqfn61xdby", etat: "hors-code", note: NOTE_AUTOMATE }, // FB-61XDBY, dates manuelles
  { id: "cmvgd8kg100094jmq1329ytz8", etat: "hors-code", note: NOTE_AUTOMATE }, // FB-29YTZ8, option ITP
  { id: "cmvgdb3c1000c4jmq8s7hckhn", etat: "hors-code", note: NOTE_RECTIFICATIF }, // rectificatif des deux

  // --- Défauts corrigés par le lot du jour (chaque lot revu par un relecteur indépendant)
  {
    id: "cmvgddn3l000i4jmqzhmdwgzk", etat: "corrige",
    note: "La liste des porte-greffes cherchait l'espèce sous le libellé exact saisi : « prunier » en minuscules ne proposait rien, « Prunier » en proposait quatre. Le formulaire d'ajout d'arbre et la route résolvent maintenant l'espèce comme le fait l'enregistrement (sans tenir compte de la casse ni des accents), pour les porte-greffes, les variétés et l'avertissement de zone.",
  },
  {
    id: "cmvgdo90z001g4jmqzz0uzdlw", etat: "corrige",
    note: "Comptabilité > Stocks lisait le compteur stocké du lot, que la mort d'une fiche nominative rattachée ne décrémente pas, alors qu'Élevage > Lots recalcule l'effectif (initial + naissances − sorties − fiches mortes). Stocks lit maintenant le même calcul, et une fiche rattachée à un lot actif n'est plus comptée une seconde fois en « Animaux individuels ». La carte, le pâturage, l'économie et les collectes de lait et l'assistant suivent le même effectif.",
  },
  {
    id: "cmvgdp9fn001i4jmqqje30x6e", etat: "corrige",
    note: "L'écran Planches refusait seul la suppression avec son propre message, sans appeler le serveur qui connaît les années des cultures et interventions rattachées. Le refus vient maintenant du serveur et nomme les années (et les cultures sans année), avec un bouton « Voir les cultures » qui ouvre la liste filtrée sur la planche et l'année ; l'onglet Terrain du tableau de bord suit le même parcours.",
  },
  {
    id: "cmvgdzsf7002f4jmqn8ehdk9c", etat: "corrige",
    note: "Une ligne générée (vente d'élevage, récolte, bois, abattage, paie du lait) n'offrait aucune action dans Transactions. Un bouton « Règlement et pièce » ouvre maintenant un formulaire limité au suivi comptable (mode de règlement, numéro de pièce, notes) ; date, montant et client restent ceux de la source, avec un lien vers elle. Le suivi saisi est conservé quand la source est modifiée et repris par l'export FEC (référence de pièce et mode de règlement), et une vente non réglée reste en créance client tant qu'elle n'est pas payée. Une vente facturée renvoie vers sa facture.",
  },
  {
    id: "cmvge3bqj002m4jmqjcf56bhw", etat: "corrige",
    note: "Le KPI de production et les totaux du tableau des coûts de production additionnaient les tiges aux kilos. Ils ne somment plus que les masses et présentent les autres unités à part, comme la carte Maraîchage : « 14 181,49 kg + 60 tiges ».",
  },
  {
    id: "cmvge3o5z002o4jmqktfks131", etat: "corrige",
    note: "La page Irriguer comptait toutes les cultures en urgence, alors que la tournée « À arroser aujourd'hui » des Tâches ne retient que les cultures cochées « à irriguer » (règle voulue : on propose sans imposer). Les deux écrans et l'assistant lisent maintenant la même tournée, et une culture urgente non cochée est nommée avec une invitation à la cocher ; une culture décochée volontairement est signalée sans alerte.",
  },
  {
    id: "cmvge803p002u4jmq9ecjvh3t", etat: "corrige",
    note: "Le résultat du contrôle d'équilibre du FEC affichait les montants bruts (« 47224.12 € »). Ils passent par le formateur commun (« 47 224,12 € »), comme les autres pages comptables, et le message d'un export déséquilibré aussi.",
  },
  {
    id: "cmvgebfkr00324jmqhpeqvbg1", etat: "corrige",
    note: "Le fond choisi était bien enregistré et restauré ; il se perdait au moment de rouvrir le menu Layers d'un clic après le rechargement : la bibliothèque de carte cache le bouton quand le menu est ouvert au survol, et le clic tombait sur la première ligne du menu, « OpenStreetMap », qui était alors cochée et enregistrée. Le bouton reste maintenant à sa place quand le menu est ouvert ; le sélecteur de point GPS, qui avait le même défaut, est corrigé aussi.",
  },
  {
    id: "cmvgee5s900374jmqhhzbueej", etat: "corrige",
    note: "Deux floraisons sans aucune semaine commune donnaient une compatibilité « Partielle ». Elles sont maintenant « incompatibles » : la suggestion le dit, l'enregistrement de l'association est refusé, et une association existante que les floraisons saisies démentent est signalée en rouge et ne compte plus comme pollinisateur. Un recouvrement complet donne « excellente », au moins à moitié « bonne », moins « partielle » ; sans période ou avec un groupe hors de l'échelle A–E, la compatibilité n'est que présumée.",
  },
  {
    id: "cmvgeecem00394jmqv940gr3i", etat: "corrige",
    note: "Le compteur de ventes d'une fiche client ne comptait que les ventes saisies à la main : une vente de récolte facturée, portée par la facture, laissait la fiche à « 0 vente ». Le compteur additionne maintenant les ventes et les factures (hors avoirs, brouillons et annulées) rattachées à la fiche, quelle que soit leur origine.",
  },
  {
    id: "cmvgef6ou003b4jmq5x9ltptu", etat: "corrige",
    note: "La sortie de stock affichait et enregistrait en kilos une espèce comptée en tiges, pièces ou bottes. Le choix de l'espèce et le champ de quantité portent maintenant l'unité du stock (celle de l'espèce sur votre ferme), le serveur refuse une sortie dans une autre unité ou une fraction de tige, et l'assistant suit la même règle.",
  },
  {
    id: "cmvgeif10003d4jmqz5uqvrci", etat: "corrige",
    note: "Le champ « Rendement carc. (%) » exigeait un ratio entre 0 et 1. Il accepte maintenant un pourcentage (65 pour 65 %), entre 1 et 100, et l'affiche ainsi ; le serveur garde un ratio et refuse une valeur hors de ces bornes en nommant le champ et l'unité.",
  },
  {
    id: "cmvgeltj1003h4jmqb3o9yz1g", etat: "corrige",
    note: "Le registre phytosanitaire général ne projetait pas la surface, la ZNT ni la météo d'un traitement saisi dans le Verger, et affichait le titulaire du compte comme applicateur. Il reprend maintenant ces données (0,01 ha = 100 m², ZNT 20 m respectée, météo composée, opérateur saisi), l'export aussi ; la surface d'un traitement peut être corrigée depuis le registre Verger, et la règle de conformité est la même à la saisie et au registre (surface, dose et DAR exigés pour un traitement chimique).",
  },
]

function statutDe(etat: Etat): BugStatus {
  return etat === "corrige" ? "RESOLVED" : "HORS_PERIMETRE"
}

function noteJournal(t: Ticket): string {
  if (t.etat === "corrige") return `Lot du 2026-10-20 corrigé dans le dépôt (${COMMITS}), revu, en attente de déploiement. ${t.note}`
  return `Hors périmètre (2026-10-20). ${t.note}`
}

async function main() {
  const ecrire = process.argv.includes("--ecrire")
  const admin = await prisma.user.findUnique({ where: { id: ADMIN_ID }, select: { role: true } })
  if (admin?.role !== "ADMIN") throw new Error(`Compte admin ${ADMIN_ID} introuvable`)
  const ids = new Set<string>()
  for (const t of TICKETS) {
    if (ids.has(t.id)) throw new Error(`Ticket ${t.id} en double dans la liste`)
    ids.add(t.id)
  }

  for (const t of TICKETS) {
    const actuel = await prisma.bugReport.findUnique({ where: { id: t.id }, select: { status: true } })
    if (!actuel) throw new Error(`Ticket ${t.id} introuvable`)
    if (actuel.status !== "OPEN") {
      console.log(`${t.id} déjà en ${actuel.status} : rien à faire`)
      continue
    }
    const statut = statutDe(t.etat)
    console.log(`${t.id} OPEN → ${statut}`)
    if (!ecrire) continue
    await prisma.$transaction([
      prisma.bugReport.update({
        where: { id: t.id },
        data: { status: statut, adminNote: t.note, resolvedAt: statut === "RESOLVED" ? new Date() : null },
      }),
      prisma.bugStatusLog.create({
        data: { bugReportId: t.id, fromStatus: "OPEN", toStatus: statut, changedById: ADMIN_ID, note: noteJournal(t) },
      }),
    ])
  }
  const restants = await prisma.bugReport.count({ where: { status: "OPEN" } })
  console.log(`OPEN restants : ${restants}`)
  if (!ecrire) console.log("--- simulation : rien écrit (ajouter --ecrire) ---")
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
