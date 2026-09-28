/**
 * Clôture des 22 signalements OPEN du 2026-09-28 (7 tickets d'assistant ou de
 * vigie, dont 5 d'un éleveur caprin réel ; 15 tickets de la campagne QA
 * navigateur « Julien V7 » sur le compte démo), APRÈS bascule de l'image qui
 * les corrige.
 *
 * Reproduit le clic « Résolu » de l'administrateur (statut + resolvedAt,
 * journal bug_status_logs signé par le compte admin), SANS mail, comme le
 * 2026-09-25. Deux demandes restent des évolutions (import Google Calendar,
 * transmission d'un profil compagnie) : EVOLUTION_PRODUIT.
 *
 * Usage (depuis l'hôte, DATABASE_URL chargé depuis .env) :
 *   npx tsx --env-file=.env scripts/cloture-bugs-20260928.ts            # simulation
 *   npx tsx --env-file=.env scripts/cloture-bugs-20260928.ts --ecrire   # écrit
 */

import { PrismaClient, type BugStatus } from "@prisma/client"

const prisma = new PrismaClient()
const ADMIN_ID = "admin_gleba_2026"
const IMAGE = process.env.GLEBA_IMAGE_TAG ?? "gleba-app:lot-20260928"

const TICKETS: Array<{ id: string; statut: BugStatus; note: string }> = [
  // --- Vigie et assistant (comptes réels) ---
  {
    id: "vigieb5dc3b1f08db066854c13333",
    statut: "EVOLUTION_PRODUIT",
    note: "Import d'un calendrier Google / iCal : intégration tierce, aucun outil ni endpoint. Demande produit, non planifiée.",
  },
  {
    id: "cmucebowb0049ujscc2vh7i9x",
    statut: "RESOLVED",
    note: "« tu es là ? » : réponse directe aux salutations depuis le 2026-09-25, plus d'appel à l'agent externe ni de ticket automatique.",
  },
  {
    id: "cmuhevtzo00a8v5i8mb4rhum4",
    statut: "RESOLVED",
    note: "L'alerte « Médicament à contrôler » vient du stock de la pharmacie (registre sanitaire). L'assistant la lit désormais (get_stock_medicaments) ; l'alerte du calendrier nomme le produit, la quantité et renvoie au registre.",
  },
  {
    id: "cmuhexqn600aav5i83nddq8cb",
    statut: "RESOLVED",
    note: "Le lot était lié à 4 soins : la suppression (409) était refusée sans message. L'écran l'explique et propose la mise au rebut (stock à zéro, ligne conservée), la date de péremption se corrige ; l'assistant sait mettre au rebut (rebut_stock_medicament).",
  },
  {
    id: "cmuhg6pqu00czv5i8mhcfcb1z",
    statut: "RESOLVED",
    note: "L'assistant répond désormais avec les faits de la politique de confidentialité (/confidentialite) : hébergement en France, sous-traitants, durées de conservation, export ZIP, suppression de compte.",
  },
  {
    id: "cmuk3e27600jcv5i8x0ichj2p",
    statut: "RESOLVED",
    note: "La liste des soins ne demandait que l'année civile courante (sans sélecteur) alors que le registre suit l'exercice : 43 soins 2021-2025 invisibles. Elle suit l'exercice du module, avec « Toutes les années » ; un soin d'un animal sorti ou d'un lot terminé reste modifiable.",
  },
  {
    id: "cmuk762p100rjv5i8pxlf1mp2",
    statut: "RESOLVED",
    note: "La fabrication existe (Production > Lait > Fabrications) mais proposait les collectes des 60 derniers jours à partir d'AUJOURD'HUI : pour un historique 2025, aucune collecte cochable et bouton « Créer le lot » muet. La fenêtre suit la date de fabrication ; l'assistant connaît l'écran.",
  },
  // --- Campagne QA « Julien V7 » du 2026-09-28 (compte démo) ---
  {
    id: "cmul08xhh00sgv5i8qf7wb3ch",
    statut: "RESOLVED",
    note: "Un rappel planifié (J+1, J+2) ne repousse plus la fin d'attente : carnet et calendrier donnent la même remise en vente. Le bloc Produits bloqués affiche la date œufs.",
  },
  {
    id: "cmul0iq5500snv5i8cyo2gly8",
    statut: "RESOLVED",
    note: "Sélecteur de planche remplacé par un <select> natif (SelectNatif) : plus de select caché ni de course Radix, la valeur suit tout mode de saisie.",
  },
  {
    id: "cmul0m92100spv5i8hhhk65rr",
    statut: "RESOLVED",
    note: "L'économie additionnait le compteur brut du lot ET chaque fiche nominative, y compris celles du lot (5 chèvres comptées 9). Même effectif reconstitué que la fiche du lot ; nominatives comptées une fois.",
  },
  {
    id: "cmul0nna400stv5i86qvrzy96",
    statut: "RESOLVED",
    note: "Le dashboard ne lisait que la fenêtre ±30 j : les soins planifiés non faits antérieurs (retard de 35 et 40 j) sont désormais ramenés (retards=1) et comptés dans « Aujourd'hui ».",
  },
  {
    id: "cmul0ppbi00svv5i8gy99o3jg",
    statut: "RESOLVED",
    note: "L'onglet Informations de la fiche planche a une carte Rotation : rotation affectée et « Année de départ du cycle de rotation », modifiables en ligne.",
  },
  {
    id: "cmul0s9xr00sxv5i8f5ii3hfz",
    statut: "RESOLVED",
    note: "Sélecteur d'espèce du lot remplacé par un <select> natif (SelectNatif).",
  },
  {
    id: "cmul0tjri00szv5i8j9n68ivy",
    statut: "RESOLVED",
    note: "Même correctif que FB-II3HFZ : <select> natif, catalogue et profils personnels.",
  },
  {
    id: "cmul0tkqu00t1v5i8sbbom1dg",
    statut: "RESOLVED",
    note: "Statut « Surface manquante » distinct de « Dose manquante » : la dose existe, la culture n'a pas de planche (surface 0). Bandeau dédié qui renvoie aux cultures, pas au référentiel.",
  },
  {
    id: "cmul0wrig00t5v5i8d7oii3j7",
    statut: "RESOLVED",
    note: "Sélecteur d'espèce de l'ITP (création et modification) remplacé par un <select> natif : le filet FormData seul n'avait pas suffi.",
  },
  {
    id: "cmul139vk00t7v5i8qrc4tb7f",
    statut: "RESOLVED",
    note: "Le formulaire envoyait le NOM de la planche et le registre résolvait par id : l'emplacement se perdait et la ligne passait « Non conforme ». Résolution id puis nom au registre et à la liste ; le formulaire envoie l'id ; « — (planche seule) » au lieu de « Manquant ».",
  },
  {
    id: "cmul18n8000tav5i8p941ong0",
    statut: "RESOLVED",
    note: "Sélecteur d'espèce d'une sortie de stock remplacé par un <select> natif.",
  },
  {
    id: "cmul19wps00tcv5i86dbijpmk",
    statut: "RESOLVED",
    note: "Les cartes Semences et Plants comptent les variétés à quantité positive, « sur N au référentiel ».",
  },
  {
    id: "cmul1e6xi00tev5i8xtkpm3kt",
    statut: "RESOLVED",
    note: "Le fond de carte n'était écrit que dans les 1,5 s suivant une interaction (heuristique de temps). Le choix est lu dans le contrôle Calques à chaque événement change, pour le fond comme pour les overlays.",
  },
  {
    id: "cmul1hioq00tgv5i89eiquw6t",
    statut: "RESOLVED",
    note: "Cause prouvée : le Data Cache de Next (stale-while-revalidate) servait les prévisions de la VEILLE comme un succès (clé sans date). Cache Next retiré (no-store, generic_cache seul) ; « Auj. » et les fenêtres de travail se décident par la date, plus par la position.",
  },
  {
    id: "cmul1nszj00tiv5i8a40zxzy8",
    statut: "RESOLVED",
    note: "aria-label et title sur les six filtres d'état de /maraichage/cultures, comme sur la liste de l'accueil.",
  },
]

async function main() {
  const ecrire = process.argv.includes("--ecrire")
  const admin = await prisma.user.findUnique({ where: { id: ADMIN_ID }, select: { role: true } })
  if (admin?.role !== "ADMIN") throw new Error(`Compte admin ${ADMIN_ID} introuvable`)

  const existants = await prisma.bugReport.findMany({
    where: { id: { in: TICKETS.map((t) => t.id) } },
    select: { id: true, status: true },
  })
  const parId = new Map(existants.map((t) => [t.id, t]))
  const manquants = TICKETS.filter((t) => !parId.has(t.id))
  if (manquants.length > 0) throw new Error(`Tickets introuvables : ${manquants.map((t) => t.id).join(", ")}`)

  const aTraiter = TICKETS.filter((t) => ["OPEN", "IN_PROGRESS"].includes(parId.get(t.id)!.status))
  console.log(`${aTraiter.length} à classer, ${TICKETS.length - aTraiter.length} déjà classé(s)`)
  for (const t of aTraiter) console.log(`  ${t.id} ${parId.get(t.id)!.status} → ${t.statut}`)
  if (!ecrire) {
    console.log("--- simulation : rien écrit (ajouter --ecrire) ---")
    return
  }

  const maintenant = new Date()
  for (const t of aTraiter) {
    const avant = parId.get(t.id)!.status
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
          fromStatus: avant,
          toStatus: t.statut,
          changedById: ADMIN_ID,
          note: `Lot du 2026-09-28 déployé (${IMAGE}). ${t.note}`,
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
