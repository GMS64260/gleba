/**
 * Classement des signalements de la campagne QA v8 du 2026-10-25 (après-midi, après la bascule de 12:44 UTC),
 * déposés sur le compte démo. Aucun mail : agents QA automatisés.
 *
 * Deux familles :
 *  - `corrige` : défaut du code corrigé dans le dépôt par le lot du jour, revu
 *    par un relecteur indépendant, EN ATTENTE DE DÉPLOIEMENT (campagne QA en
 *    cours au moment du lot : pas de bascule) ;
 *  - `hors-code` : comportement voulu, ou faux positif retiré par son auteur :
 *    HORS_PERIMETRE, sans `resolved_at`, comme l'écran admin ;
 *  - `evolution` : besoin reconnu dont la réponse complète attend une décision
 *    produit (migration), l'écran ayant été rendu honnête en attendant :
 *    EVOLUTION_PRODUIT, sans `resolved_at`.
 *
 *   npx tsx --env-file=.env scripts/cloture-bugs-20261025b.ts           # simulation
 *   COMMITS_LOT="abc1234, def5678" npx tsx --env-file=.env scripts/cloture-bugs-20261025b.ts --ecrire
 */
import { PrismaClient, type BugStatus } from "@prisma/client"

const prisma = new PrismaClient()
const ADMIN_ID = "admin_gleba_2026"
const COMMITS = process.env.COMMITS_LOT ?? "lot du 2026-10-25"

type Etat = "corrige" | "hors-code" | "evolution"
type Ticket = { id: string; etat: Etat; note: string }

export const TICKETS: Ticket[] = [
  // --- Faux positif d'automate retiré par son auteur (rectificatif cmvnurezk)
  {
    id: "cmvnufqfh001bmox21dwkblrm", etat: "hors-code",
    note: "Faux positif d'automatisation, retiré par son auteur (rectificatif FB du 2026-10-25 14:17) : le remplissage automatique du champ date-heure affichait une valeur sans déclencher la mise à jour du formulaire ; avec une saisie native au clavier, « Dater » conserve bien 24/09/2026 08:00 après rechargement. Aucun défaut.",
  },
  {
    id: "cmvnurezk003emox2jxnk5ksx", etat: "hors-code",
    note: "Rectificatif déposé par l'agent QA pour écarter son propre signalement (FB-WKBLRM) : pas un défaut.",
  },
  // --- Traces et évolutions
  {
    id: "cmvnuwygx004hmox2hruu1bth", etat: "hors-code",
    note: "Cause hors du code : l'agent de la plateforme qui sert le mode Support est en pause manuelle depuis le 19/10 (décision d'exploitation) ; Gleba le dit à l'utilisateur et laisse une seule trace ouverte par cause. Sa reprise est une décision d'exploitation.",
  },
  {
    id: "cmvnuxygt004rmox2xz242gyr", etat: "evolution",
    note: "Besoin reconnu, non planifié : supprimer toutes les planches en un geste depuis l'assistant. L'assistant a eu raison de ne pas préparer une suppression partielle (la lecture des planches est plafonnée en taille et l'outil de suppression exige la liste exacte) ; une suppression en masse est un geste destructeur qui demande une confirmation explicite, à concevoir (cible « toutes », avec les cultures et interventions portées par chaque planche). La lecture compacte des noms de planches est notée à part.",
  },
  // --- Comptabilité
  {
    id: "cmvnvaal2005umox2ac7dyjfb", etat: "corrige",
    note: "Les deux écrans ne calculaient pas la valeur du stock de la même façon : Récoltes appliquait à chaque tige le prix au kilo du catalogue (30 €), d'où 630 €, et Stocks unifiés faisait une moyenne de vos ventes en mélangeant tiges et kilos ; ils suivent désormais la même règle (le prix saisi sur le lot, sinon celui de votre fiche espèce dans son unité, sinon votre prix de vente moyen à la tige sur 90 jours) et indiquent sous le montant d'où vient le prix et sur combien de ventes.",
  },
  {
    id: "cmvnuxvax004pmox29m1oukuk", etat: "corrige",
    note: "Le PDF arrondissait le prix unitaire hors taxe à deux chiffres (1,14 €) alors que la facture est calculée sur le prix exact ; il affiche maintenant 1,1374 € et rappelle le prix TTC saisi (« soit 1,20 € TTC »), qui est la référence exacte, sans changer aucun total.",
  },
  // --- Boutique (zone privée, sur disque) et courriels (dépôt)
  {
    id: "cmvnv4vww005kmox2fifm8998", etat: "corrige",
    note: "La liste et le détail des commandes, le catalogue du back-office, la page produit publique, la validation du panier, la page de suivi et les courriels de commande affichent désormais les montants au format français (« 5,00 € ») par le formateur partagé de l'application. Écrans de la boutique corrigés dans la zone privée, en attente de déploiement.",
  },
  // --- Assistant IA (zone privée, sur disque, embarquée par la prochaine bascule)
  {
    id: "cmvnur8eu003cmox21ahc0p7g", etat: "corrige",
    note: "L'assistant présentait comme « actives » toutes les cultures non terminées d'une planche, y compris celles seulement planifiées pour l'année suivante. Il dit désormais ce qui est sur la planche par la même règle que l'irrigation (en place, semée non plantée, planifiée pour 2027 avec ses dates, à vérifier avec la raison, nombre de terminées), et ne dit plus jamais « active » d'une culture dont la plantation est à venir. Correctif dans le code partagé des cultures et la zone privée de l'assistant, en attente de déploiement.",
  },
  // --- Traçabilité et référentiel
  {
    id: "cmvntzwng0005mox2i5gvcbj3", etat: "corrige",
    note: "Le registre que vous choisissez sur la page Traçabilité, ainsi que l'année, est maintenant gardé dans l'adresse de la page : après un rechargement, vous retrouvez le registre que vous consultiez.",
  },
  {
    id: "cmvnulry1001umox2yedrqv9y", etat: "corrige",
    note: "Les cultures créées depuis la rotation enregistraient leurs dates d'une façon que le registre de culture lisait comme la veille ; le registre affiche désormais la même date que la fiche de la culture, y compris pour les cultures déjà créées, et toutes les créations (rotation, assistant Semer) enregistrent le jour civil comme la saisie manuelle.",
  },
  {
    id: "cmvnu7ad8000pmox2ejmeaycq", etat: "corrige",
    note: "La fiche du Pommier affichait un code interne (« NON_TROUVE ») à la place d'une information manquante ; une information absente du référentiel s'affiche maintenant « À documenter », sur toutes les caractéristiques de la fiche et de la liste, et l'import du référentiel ne recopie plus ce code.",
  },
]

function statutDe(etat: Etat): BugStatus {
  if (etat === "corrige") return "RESOLVED"
  return etat === "evolution" ? "EVOLUTION_PRODUIT" : "HORS_PERIMETRE"
}

function noteJournal(t: Ticket): string {
  if (t.etat === "corrige") return `Lot du 2026-10-25 corrigé dans le dépôt (commits ${COMMITS}), revu par un relecteur indépendant, en attente de déploiement. ${t.note}`
  if (t.etat === "evolution") return `Évolution produit (2026-10-25), écran rendu cohérent par le lot du jour (commits ${COMMITS}), en attente de déploiement. ${t.note}`
  return `Hors périmètre (2026-10-25). ${t.note}`
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

