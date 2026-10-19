/**
 * Classement des signalements de la campagne QA v8 du 2026-10-19 (soir),
 * déposés sur le compte démo (préfixe « v8- ») et sur le compte admin
 * (agent v7). Aucun mail : agents QA automatisés.
 *
 * Trois familles :
 *  - `corrige` : défaut du code corrigé dans le dépôt par le lot du soir, revu,
 *    EN ATTENTE DE DÉPLOIEMENT (décision du 2026-10-10 : RESOLVED après
 *    correctif commité et revu ; la ligne de journal le dit) ;
 *  - `hors-code` : artefact d'automate (remplissage d'un champ date sans
 *    événement, retiré par l'agent QA lui-même) ou rectificatif : HORS_PERIMETRE,
 *    sans `resolved_at`, comme le fait l'écran admin ;
 *  - `evolution` : fonction absente, besoin reconnu non planifié : EVOLUTION_PRODUIT.
 *
 *   npx tsx --env-file=.env scripts/cloture-bugs-20261019c.ts           # simulation
 *   npx tsx --env-file=.env scripts/cloture-bugs-20261019c.ts --ecrire  # classe
 */
import { PrismaClient, type BugStatus } from "@prisma/client"

const prisma = new PrismaClient()
const ADMIN_ID = "admin_gleba_2026"
const COMMITS = process.env.COMMITS_LOT ?? "lot du 2026-10-19 soir"

type Etat = "corrige" | "hors-code" | "evolution"
type Ticket = { id: string; etat: Etat; note: string }

const NOTE_DATE_AUTOMATE =
  "Non reproduit, cause hors de l'application : l'agent QA l'a lui-même retiré dans un rectificatif. " +
  "Le remplissage automatisé du champ date changeait la valeur visible sans déclencher d'événement de saisie ; " +
  "le formulaire n'a donc jamais reçu la nouvelle date. Rejoué avec une saisie effective (clavier), la date est conservée après rechargement."

const NOTE_RECTIFICATIF =
  "Rectificatif déposé par l'agent QA pour retirer son propre signalement : pris en compte, le signalement visé est classé hors périmètre (artefact d'automate)."

const NOTE_ASSISTANT_BLOCKED =
  "L'agent de raisonnement de l'assistant a échoué deux fois de suite (état « blocked »), échec transitoire : la même question reposée une minute plus tard aboutit. " +
  "L'assistant relance désormais une fois, à froid, sur une nouvelle session avant de déclarer l'échec ; corrigé le 2026-10-19, en attente de déploiement."

export const TICKETS: Ticket[] = [
  // --- Assistant IA : échecs « blocked » de l'agent de raisonnement (14:46 et 14:53 UTC)
  { id: "cmvfdacar000oitoeezeiztid", etat: "corrige", note: NOTE_ASSISTANT_BLOCKED },
  { id: "cmvfdjkja000sitoens1ruwwy", etat: "corrige", note: NOTE_ASSISTANT_BLOCKED },

  // --- Faux positifs d'automate sur un champ date, retirés par l'agent QA
  { id: "cmvfjuesl000witoepoj6ksxv", etat: "hors-code", note: NOTE_DATE_AUTOMATE }, // FB-J6KSXV, interventions
  { id: "cmvfk5get000zitoe4wp86ms5", etat: "hors-code", note: NOTE_RECTIFICATIF },  // rectificatif de FB-J6KSXV
  { id: "cmvfl65jq001citoeq16n9ard", etat: "hors-code", note: NOTE_DATE_AUTOMATE }, // FB-6N9ARD, cultures
  { id: "cmvflj6ye002eitoei1g4ten7", etat: "hors-code", note: NOTE_RECTIFICATIF },  // rectificatif de FB-6N9ARD
  { id: "cmvflllau002pitoe8iuhcg07", etat: "hors-code", note: NOTE_DATE_AUTOMATE }, // FB-UHCG07, lots
  { id: "cmvfln3f2002sitoeuk0odh97", etat: "hors-code", note: NOTE_RECTIFICATIF },  // rectificatif de FB-UHCG07

  // --- Défauts corrigés par le lot du soir (revu par un relecteur indépendant)
  {
    id: "cmvfkmu1b0012itoe2izmu3qe", etat: "corrige",
    note: "La recherche du registre des interventions ignorait la colonne « Culture / Planche » : un nom de culture ou de planche affiché ne retrouvait aucune ligne. Elle porte maintenant sur tout ce que la ligne affiche (type, culture, planche, description, intrant, produit, notes), sans tenir compte des majuscules, des accents ni des tirets, et chaque mot saisi peut figurer dans n'importe quel champ.",
  },
  {
    id: "cmvfl8smf001litoetqqowsry", etat: "corrige",
    note: "La saisie de récolte n'affichait que « Quantité (kg) », sans dire que l'unité se règle pour chaque espèce ni où la changer. Elle affiche maintenant l'unité de comptage de l'espèce sur votre ferme (kg, tiges, pièces ou bottes), avec un lien qui ouvre la carte « Chez moi » de la fiche de l'espèce, seul endroit où cette unité se décide pour les récoltes, le stock et les projections.",
  },
  {
    id: "cmvfln83f002uitoenu4em7dd", etat: "corrige",
    note: "Sur la page Irriguer, « Marquer comme arrosé » enregistrait aussitôt un arrosage complet sans demander la quantité. Le bouton ouvre maintenant le même dialogue « Noter l'arrosage » que les Tâches et le Calendrier, prérempli avec la dose conseillée, et le bilan hydrique compte les litres réellement versés ; « Tout arroser » demande confirmation avant de noter un arrosage complet.",
  },
  {
    id: "cmvfm1yvc0049itoekd8vl0sk", etat: "corrige",
    note: "Dupliquer une planche depuis le plan ne recopiait que ses dimensions : îlot, type, sol, rétention et rotation étaient perdus et les copies comptaient comme terrain incomplet. La copie est maintenant faite par le serveur à partir de la planche enregistrée et reprend toutes ses caractéristiques de terrain ; seuls changent le nom (numéroté), la position (à côté de la source) et ce qui est propre à une planche (notes, statut bio). Les copies déjà créées restent à compléter ou à supprimer.",
  },
  {
    id: "cmvfljv98002kitoe5d3iykme", etat: "corrige",
    note: "La matrice de pollinisation ne retrouvait une variété que par son identifiant technique ; une variété personnelle affectée par son nom était ignorée, avec ses semaines de floraison. Elle est maintenant retrouvée par son nom dans l'espèce de l'arbre, la colonne Floraison affiche la période saisie sur la variété, et deux floraisons qui se chevauchent donnent une compatibilité vérifiée.",
  },
  {
    id: "cmvflq0sf0032itoe6k42bfao", etat: "corrige",
    note: "Le type « Liane fruitière » n'existait pas pour un arbre et la création ne proposait le kiwi sous aucun type. Le type existe maintenant, avec un onglet « Lianes » ; le kiwi est proposé sous Liane fruitière (et toujours sous Fruitier et Petit fruit), et une liane compte comme fruitier pour la pollinisation, les récoltes, les étiquettes et les statistiques. Le kiwi déjà saisi peut être reclassé depuis sa fiche.",
  },
  {
    id: "cmvflyt1w0042itoehpgijwuv", etat: "corrige",
    note: "Le sélecteur d'année du verger était conservé mais seul le Calendrier en tenait compte ; l'onglet Opérations listait toutes les années et un coût global. La liste et le coût suivent maintenant l'année affichée, qui figure dans l'adresse : date de réalisation pour une opération faite, date prévue pour une opération à faire. Les onglets qui couvrent volontairement toutes les années l'indiquent dans l'en-tête.",
  },
  {
    id: "cmvflv6ku003nitoeo9v3erfy", etat: "corrige",
    note: "La Cave valorisait le stock restant en multipliant son poids par un prix saisi à la pièce, et une vente à la pièce sans pesée ne retirait aucun poids. Désormais les pièces restantes suivent le compte des sorties, le poids suit la pesée ou, à défaut, le poids moyen d'une pièce, et la valorisation applique le prix constaté dans son unité. Le lot du signalement s'affiche 2 pièces, 0,15 kg, valorisées 4 € à 2 €/pièce.",
  },
  {
    id: "cmvfm1aj30045itoet15sl5ho", etat: "corrige",
    note: "Le carnet sanitaire de la Traçabilité cherchait les types de soin en minuscules alors que l'Élevage les enregistre avec une majuscule : toutes les lignes s'affichaient « Autre » et le filtre Vermifuge ne trouvait rien. Colonne, résumé et filtre lisent maintenant la même table de types que l'Élevage, et les anciens codes en minuscules y sont rattachés.",
  },
  {
    id: "cmvfm1ow70047itoehodzhwt0", etat: "corrige",
    note: "Complément du signalement FB-5SL5HO, pris en compte : le filtre par type du carnet sanitaire reposait sur la même comparaison fautive et retrouve désormais les lignes.",
  },
  {
    id: "cmvfm9wi5004kitoejer6czwd", etat: "corrige",
    note: "La tuile « Soins à planifier » comptait les soins en retard parmi les soins « prévus dans les 30 prochains jours ». Elle lit maintenant les comptes de la liste « Soins à faire » et sépare les soins à venir des soins en retard.",
  },
  {
    id: "cmvflhyyu0029itoetnzg2dnv", etat: "corrige",
    note: "Le texte saisi dans « Notes / Conditions » était enregistré mais le PDF n'imprimait qu'un autre champ, que rien ne remplissait. Il figure maintenant dans un bloc « Conditions et notes » du pied de la facture, retours à la ligne compris, et il est porté en note libre dans le Factur-X.",
  },
  {
    id: "cmvfljaru002gitoe0n9np2mf", etat: "corrige",
    note: "Le formulaire de facture ne proposait aucune fiche client et n'envoyait jamais de rattachement : une facture adressée à un professionnel existant partait sans son SIRET ni sa TVA intracommunautaire. Le formulaire liste maintenant les fiches et affiche celle que désigne le nom saisi, avec son identité et son éventuelle exonération de TVA ; il la rattache explicitement ou facture sans fiche sur demande, et le serveur refuse un nom qui correspond à une fiche sans choix explicite. L'identité de l'acheteur est figée sur la facture, le PDF et le Factur-X. La facture déjà émise du signalement reste telle quelle (une facture émise ne se modifie pas : avoir puis nouvelle facture).",
  },
  {
    id: "cmvflk17e002mitoeqe27hfn6", etat: "corrige",
    note: "Doublon du signalement FB-0N9NP2MF (même constat, même minute), traité avec lui : le formulaire de facture propose maintenant les fiches client et l'identité de l'acheteur (SIRET, TVA) est figée sur la facture et imprimée sur le PDF.",
  },
  {
    id: "cmvflua2x003litoejod1ddxj", etat: "corrige",
    note: "Le Compte de résultat ventilait les revenus par module en relisant les tables métier, alors que la carte Revenus additionne ventes et factures : une facture saisie sans vente, un avoir ou une vente datée après le jour créaient un écart que l'alerte ne savait pas expliquer. Les modules sont maintenant calculés sur les mêmes lignes que la carte et leur somme lui est égale au centime ; les factures sans vente sont rangées en « Autre » et cela est indiqué sous le tableau.",
  },
  {
    id: "cmvflvsk4003pitoe6yutubct", etat: "corrige",
    note: "Le fond de carte n'était enregistré que lorsque le navigateur émettait un événement de clic ou de changement ; un bouton coché autrement restait affiché sans être enregistré, et le menu était en partie caché par la barre « Dessiner / Importer » quand la carte est étroite. Ce qui est coché est désormais appliqué à la carte et enregistré à chaque interaction et à la sortie de la page, et le menu passe sous la barre.",
  },
]

function statutDe(etat: Etat): BugStatus {
  return etat === "corrige" ? "RESOLVED" : etat === "hors-code" ? "HORS_PERIMETRE" : "EVOLUTION_PRODUIT"
}

function noteJournal(t: Ticket): string {
  if (t.etat === "corrige") return `Lot du 2026-10-19 (soir) corrigé dans le dépôt (${COMMITS}), revu, en attente de déploiement. ${t.note}`
  if (t.etat === "evolution") return `Évolution produit : besoin reconnu, non planifié (2026-10-19). ${t.note}`
  return `Hors périmètre (2026-10-19). ${t.note}`
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
