/**
 * Classement des signalements de la campagne QA v8 du 2026-10-25 (matin),
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
 *   npx tsx --env-file=.env scripts/cloture-bugs-20261025.ts           # simulation
 *   COMMITS_LOT="abc1234, def5678" npx tsx --env-file=.env scripts/cloture-bugs-20261025.ts --ecrire
 */
import { PrismaClient, type BugStatus } from "@prisma/client"

const prisma = new PrismaClient()
const ADMIN_ID = "admin_gleba_2026"
const COMMITS = process.env.COMMITS_LOT ?? "lot du 2026-10-25"

type Etat = "corrige" | "hors-code" | "evolution"
type Ticket = { id: string; etat: Etat; note: string }

export const TICKETS: Ticket[] = [
  // --- Élevage
  {
    id: "cmvnp6s3z0054qqozx3x38sb7", etat: "corrige",
    note: "Modifier un soin ramenait à 02:00 l'heure réelle de la première injection, car la date du formulaire, qui ne contient que le jour, était lue comme une nouvelle date de soin à minuit. Désormais, tant que le jour n'est pas modifié, la date et l'heure du soin restent celles saisies avec « Dater » ; changer l'intervalle ou le nombre d'injections recalcule le reste du traitement à partir de cette heure.",
  },
  {
    id: "cmvnookz70046qqozflwab31j", etat: "corrige",
    note: "La liste des lots ne montrait que le début du nom d'un profil d'espèce personnalisé (« v8 ») ; elle affiche maintenant le nom complet du profil dans les listes des lots et des animaux et sur la fiche du lot, et le filtre Espèce présente chaque profil personnalisé séparément, même quand deux noms commencent par le même mot.",
  },
  // --- Verger
  {
    id: "cmvnp0dm9004uqqozlkmalxx5", etat: "corrige",
    note: "Le type de bois apparaissait sous son nom interne (« elagage ») dans la fenêtre de vente, dans l'écriture de vente et sur la facture ; il s'écrit désormais « Élagage », avec le volume à la française (0,2 m³), pour toutes les prochaines ventes. Les factures déjà émises gardent leur texte.",
  },
  {
    id: "cmvnorxov004bqqozel1aupud", etat: "corrige",
    note: "Le bouton « Voir les opérations » de la fiche d'un arbre ouvre maintenant la liste filtrée sur cet arbre, avec son nom rappelé et un bouton « Tous les arbres » pour revenir à l'ensemble du verger.",
  },
  {
    id: "cmvnopnsu0048qqoz8gd8po3n", etat: "hors-code",
    note: "C'est le fonctionnement prévu : à la création d'un arbre, Gleba prépare automatiquement son calendrier d'entretien à partir d'aujourd'hui, ou de la date de plantation si elle est à venir, comme l'annonçait le message. Le bouton de la liste sert à le recalculer, et les opérations proposées peuvent être supprimées depuis l'onglet Opérations. Le lot du jour rend cette règle visible : aide sous la date de plantation, bouton renommé « Recalculer le calendrier d'entretien », messages de la duplication et du plan qui annoncent le calendrier.",
  },
  // --- Transverse
  {
    id: "cmvnout4y004fqqozmi6o37wd", etat: "corrige",
    note: "Après la connexion, vous revenez maintenant exactement sur la page que vous aviez ouverte, avec le bon onglet et le bon sous-onglet (par exemple Élevage, Alimentation, Soins), au lieu de la page par défaut. La même correction borne l'adresse de retour au site.",
  },
  {
    id: "cmvnosa42004dqqozmbhnv4gk", etat: "corrige",
    note: "Le libellé « Semaine dernière » s'affiche désormais avec son accent dans les Tâches et dans le calendrier du potager, et une vérification automatique empêchera ce mot de revenir sans accent.",
  },
  {
    id: "cmvno0s5d002eqqozetunv3w2", etat: "corrige",
    note: "La carte lunaire de la page Météo calcule maintenant le nom de la phase, le sens et l'éclairage de la même façon : le 25 octobre 2026, veille de la pleine lune, elle indique bien une Lune croissante éclairée à 99 %. Les heures des nouvelles et pleines lunes, décalées de 10 à 20 minutes, sont aussi corrigées.",
  },
  {
    id: "cmvnpqtt6005jqqozxojg57jo", etat: "corrige",
    note: "Même défaut que le signalement de 11:10 sur la carte lunaire : le nom de la phase et le sens venaient de deux calculs différents. Un seul calcul désormais : le 25 octobre 2026, veille de la pleine lune, la carte indique une Lune croissante éclairée à 99 %, et le titre, la ligne de détail et la case du jour disent la même chose.",
  },
  // --- Accueil
  {
    id: "cmvnnwr700025qqozwnlfap11", etat: "corrige",
    note: "La page Aujourd'hui était préparée à l'avance avec la date du jour de la dernière mise à jour du site, puis corrigée par votre navigateur au chargement : ce décalage provoquait le message d'erreur. La date est désormais affichée uniquement par votre navigateur, l'erreur disparaît sans rien changer à l'usage de la page. Même correction sur la page Traçabilité et sur la saisie de récolte.",
  },
  // --- Maraîchage
  {
    id: "cmvnpkkhp005fqqoz5b0zcv1j", etat: "corrige",
    note: "L'assistant Semer calculait bien 159 plants mais ne les enregistrait pas ; la création les enregistre désormais, par le même calcul que la fiche et l'écran Plants (16 m à 30 cm font 53 plants par rang, soit 159 sur 3 rangs), et ce calcul est le même partout (formulaires, création en lot, assistant). La culture créée pendant le test reste sans quantité jusqu'à sa prochaine modification.",
  },
  {
    id: "cmvnppfaa005hqqoz0i99crm5", etat: "corrige",
    note: "Complément du signalement FB-0ZCV1J (quantité de plants), traité avec lui : l'incohérence entre la fiche et l'écran Plants venait de la quantité jamais enregistrée par l'assistant Semer.",
  },
  {
    id: "cmvnpe6ip005cqqozhfpgxd5x", etat: "evolution",
    note: "Un inventaire ne modifie pas les lots de récolte : l'écran Récoltes affiche désormais le même stock que Gestion des stocks (7,5 kg) et nomme l'ajustement d'inventaire de −0,5 kg par rapport aux lots, les sorties et les lots en boutique. La répercussion directe d'un comptage sur les lots vendables reste une décision produit.",
  },
  // --- Faux positif retiré par son auteur (rectificatif cmvnnxe4w)
  {
    id: "cmvnnujx3001xqqoz6v8kbhzl", etat: "hors-code",
    note: "Faux positif d'automatisation, retiré par son auteur (rectificatif FB du 2026-10-25 11:09) : le clic automatisé ne sélectionnait pas l'option hors de la partie visible de la liste ; par un clic réel, « Radis · printemps · impl. S11 » reste sélectionné et préremplit le calendrier et les quantités. Aucun défaut.",
  },
  {
    id: "cmvnnxe4w0027qqozkk5q8qgl", etat: "hors-code",
    note: "Rectificatif déposé par l'agent QA pour écarter son propre signalement (FB-8KBHZL) : pas un défaut.",
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
