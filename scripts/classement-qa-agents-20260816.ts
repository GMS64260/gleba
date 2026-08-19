/**
 * Classement 2026-08-16 — campagne QA des agents navigateur (14 tickets + 1 note vigie).
 *
 * Chaque ticket a été vérifié contre le code et la base ; les correctifs sont
 * déployés (image du 2026-08-16 soir, rollback gleba-app:rollback-20260816-pre-qa-agents).
 * Ce script applique les statuts + notes admin + journal de statut, sans
 * passer par l'API admin (qui enverrait un email de résolution au compte démo).
 *
 * Usage : npx tsx --env-file=.env scripts/classement-qa-agents-20260816.ts [--apply]
 */

import prisma from "../src/lib/prisma"

const APPLY = process.argv.includes("--apply")

type Classement = { id: string; status: "RESOLVED" | "EVOLUTION_PRODUIT"; note: string }

const CLASSEMENTS: Classement[] = [
  {
    id: "cmsw8pzzw000o11cejy10nhvt",
    status: "RESOLVED",
    note: "Corrigé 2026-08-16 : le moteur de rotation n'avait aucune borne haute sur l'année — une culture 2027 (plan matérialisé par creer-cultures) bloquait la famille et figurait en « cultures récentes » dès 2026. Borne annee<=cible dans planche-advice.ts + filtre défensif dans calculateRotationAdvice (assistant IA couvert). Tests ajoutés (src/lib/rotation/index.test.ts). Prouvé en prod : la planche C1 ne bloque plus Fabaceae 2027.",
  },
  {
    id: "cmsw8t3wk000t11cefj25gb7s",
    status: "RESOLVED",
    note: "Corrigé 2026-08-16 : la validation HTML5 native (step=0.1) annulait la soumission de « 1,01 m³ » sans message perceptible (bulle hors écran dans le dialog scrollable) — aucune requête ne partait. Preuve : le test suivant à 0,3 m³ (multiple de 0,1) est passé à 20:25. Formulaires bois ET récolte verger : noValidate + step=any + revalidation explicite avec toast, virgule décimale acceptée.",
  },
  {
    id: "cmsw8wni8001111cey6hnt898",
    status: "RESOLVED",
    note: "Corrigé 2026-08-16 : les cultures SANS planche étaient écartées en silence du tableau et des compteurs de Planification (garde de typage culture.planche dans getCulturesPrevues). Incluses désormais avec badge « sans planche ». Prouvé en prod : total 26 = écran Cultures, Pourpier #968 et Radis #985 listées. Les « sans ITP » relevaient du bug du sélecteur ITP (cmsw8z9jt), corrigé aussi.",
  },
  {
    id: "cmsw8xwgi001411cenbq93h8e",
    status: "RESOLVED",
    note: "Corrigé 2026-08-16 : la création était refusée en 400 « Ce lot possède déjà un prix d'achat total… » (le lot Oies portait 50 €) derrière une case « prix inclus dans le lot » invisible, et le refus perdait la fiche. À la création, la ventilation est désormais forcée (jamais compté deux fois) ; la case se pré-coche ; le bouton Créer ne peut plus être muet (validation dans handleSubmit) ; formErrors zod restitués ; page /elevage/animaux (payload en chaînes → 400 systématique) réparée. Tests ajoutés.",
  },
  {
    id: "cmsw8z9jt001611cewafnhjkh",
    status: "RESOLVED",
    note: "Corrigé 2026-08-16 : le SelectBubbleInput Radix écrasait l'ITP auto-sélectionné (valeur posée dans le même commit React que la liste → retombe à \"\") : le champ affichait « Sélectionner un ITP » pendant que les dates de l'ITP fantôme S13 restaient appliquées et la culture partait sans itpId. Même garde que le deep-link planche (QA cmsjhc0cx) appliquée à l'ITP + purge du bandeau « fenêtre dépassée » quand l'ITP est vidé.",
  },
  {
    id: "cmsw91q0z001b11celqp0o3hh",
    status: "RESOLVED",
    note: "Corrigé 2026-08-16 : l'API renvoyait bien un 409 explicite (doublon nom+email) mais la seule restitution était un toast de 5 s hors de la modale — perçu « aucun message ». L'erreur s'affiche désormais aussi en bandeau role=alert DANS la modale, titre « Doublon détecté ». NB : un des essais avait été refusé 400 « SIRET invalide » (log 20:18:45) avec la même absence de restitution — couvert par le même bandeau.",
  },
  {
    id: "cmsw97cn5001k11ce958dzalw",
    status: "RESOLVED",
    note: "Corrigé 2026-08-16 : le chiffre du dashboard était le stock PHYSIQUE (5618 = 5525 DCR dépassée + 93 bloqués véto, même total que Production) mais libellé « disponibles ». Libellé désormais « en stock · X commercialisables » et seuil d'alerte (<24) porté sur les commercialisables (SSOT computeStockOeufsParLots, exposée par /api/elevage/stats — prouvé en prod : 5618 / 0). La valorisation compta des œufs périmés reste la décision EVOLUTION_PRODUIT du 2026-08-11.",
  },
  {
    id: "cmsw98kx1001m11cedvngx7ii",
    status: "RESOLVED",
    note: "Corrigé 2026-08-16 : la saisie d'une récolte réelle marquait recolteFaite sans recaler Culture.dateRecolte (SSOT dateExecutionARecaler du 12/08 non branchée sur POST /api/recoltes ni sur l'outil assistant) → « 20/09 · Fait » sur /interventions pour une récolte du 16/08. Recalage branché sur les deux chemins avec la date réelle de récolte comme référence (une date déjà passée n'est jamais réécrite). Reprise : 4 cultures recalées (dont #1049) — prouvé en prod : « 16/08/2026 · Récolte Radis sur Planche 15 · Fait ».",
  },
  {
    id: "cmsw995bu001o11cexdnwf6xp",
    status: "RESOLVED",
    note: "Corrigé 2026-08-16 (libellé) : deux indicateurs métier distincts et voulus — la carte compte la mortalité du cheptel immatriculé (fiches Animal, base des justificatifs d'équarrissage et du registre), la mortinatalité (nés−vivants) est mesurée sur l'onglet Reproduction (indicateur dédié, seuil 15 %). Les morts-nés ne créent jamais de fiche. La carte dit désormais « Mortalité cheptel » avec « hors pertes néonatales (voir Reproduction) » au lieu de laisser croire à un compteur unique.",
  },
  {
    id: "cmsw9ba0q001q11cefn2viz52",
    status: "RESOLVED",
    note: "Corrigé 2026-08-16 : toutes les mentions de l'arrêté du 16/06/2009 (abrogé) et du 12/09/2006 remplacées par l'arrêté du 4 mai 2017 modifié — formulaire, messages 400 de l'API observations, pied et métadonnées du PDF du registre, alerte météo agro. La règle « pas de pluie dans les 24h » (inexistante) remplacée par la règle réelle : précipitations ≤ 8 mm/h au moment du traitement. Champ « Pluie ±24h » requalifié (traçabilité). Constante unique src/lib/phyto/mentions-legales.ts pour empêcher la re-dérive. Vérifié dans le bundle déployé (0 occurrence 2009).",
  },
  {
    id: "cmsw9bv3s001s11cezknjj6dx",
    status: "RESOLVED",
    note: "Corrigé 2026-08-16 : le passage à « livrée » (PATCH statut, bouton Enregistrer) ne déclenchait ni écriture comptable ni fiche client — seul « Confirmer le paiement » le faisait. Nouvelle transition livrerCommandeBoutique : vente créée paye=false tant que le paiement n'est pas confirmé (le correctif « paiement respecté » du 14/08 reste honoré), fiche client (ensureClientForUser), stock décrémenté, annulation durcie. Reprise exécutée : CMD-2026-0015 matérialisée (vente 3,20 € non payée, fiche « Nathalie Test V7 » au répertoire) + 22 commandes du seed re-liées à leur vente existante.",
  },
  {
    id: "cmsw9co5n001u11ce09ixlt9r",
    status: "EVOLUTION_PRODUIT",
    note: "Qualifié 2026-08-16 : la légende du calendrier verger est purement décorative — la fonctionnalité « filtrer par type d'opération » n'a jamais été écrite (aucun état de filtre dans VergerCalendarView). Demande d'évolution légitime, réalisable en client-side pur (toggle sur la légende + filtre de eventsByDay), à prioriser produit.",
  },
  {
    id: "cmsw9dcrd001w11cel1hmd7jf",
    status: "EVOLUTION_PRODUIT",
    note: "Scindé 2026-08-16. (1) Écart Transactions−modules = 3,20 € : VRAI défaut, corrigé — commande boutique livrée sans écriture (cf. cmsw9bv3s) ; après reprise, cette part converge. (2) Écart résiduel 36,30 € = Σ des 3 avoirs de l'exercice (14,30+16,50+5,50) : SSOT nette d'avoirs vs ventilation en factures brutes — même convention déjà tranchée EVOLUTION_PRODUIT le 2026-08-10 (écart 14,30 €, avoir non affiché). Le bandeau des Rapports nomme désormais explicitement cet écart « avoirs de l'exercice » (ton neutre) au lieu d'« incohérence » (rouge).",
  },
  {
    id: "cmsw9e88e001y11ceohz4n9ob",
    status: "RESOLVED",
    note: "Corrigé 2026-08-16 : la dérivation automatique affirmait « À associer (auto) / groupes compatibles » même sans aucun groupe de floraison connu (groupeAdjacent tolérant par défaut) et cette présomption éteignait l'alerte. Dérivations désormais qualifiées vérifiée/présumée ; sans données l'écran affiche « À vérifier (groupe de floraison inconnu) — compatibilité non vérifiée » et la raison stockée le dit aussi. Prouvé en prod : Cerisiers Burlat/Napoléon et Poiriers Conférence/Williams = presumee, les arbres à groupes connus restent verifiee.",
  },
  {
    id: "vigieb1fa1a34217f8799ff60c2f1",
    status: "RESOLVED",
    note: "Note de vigie « aucun défaut confirmé » (fenêtre TIN-803) — informatif, aucune action requise. Clos le 2026-08-16.",
  },
  {
    id: "cmsw9fo4j002011ceova1wopd",
    status: "RESOLVED",
    note: "Corrigé 2026-08-16 : le bouton feedback flottant (fixed bottom-left) recouvrait « Enregistrer la vente » en bas du formulaire Transactions > Saisie à 375 px. pb-24 ajouté au conteneur de la page (même pattern que /maraichage/recoltes/saisie, QA cmsbu4f00). Déployé dans la même image.",
  },
]

async function main() {
  const admin = await prisma.user.findFirst({
    where: { role: "ADMIN" },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true },
  })
  if (!admin) throw new Error("Aucun compte ADMIN")

  for (const c of CLASSEMENTS) {
    const existing = await prisma.bugReport.findUnique({
      where: { id: c.id },
      select: { id: true, status: true },
    })
    if (!existing) {
      console.log(`⚠ ${c.id} introuvable — ignoré`)
      continue
    }
    console.log(`${existing.status} → ${c.status}  ${c.id}`)
    if (!APPLY) continue

    await prisma.$transaction([
      prisma.bugReport.update({
        where: { id: c.id },
        data: {
          status: c.status,
          adminNote: c.note,
          resolvedAt: c.status === "RESOLVED" ? new Date() : null,
        },
      }),
      prisma.bugStatusLog.create({
        data: {
          bugReportId: c.id,
          fromStatus: existing.status,
          toStatus: c.status,
          changedById: admin.id,
          note: "Campagne QA agents navigateur du 2026-08-16 — vérification, correctifs déployés (rollback gleba-app:rollback-20260816-pre-qa-agents)",
        },
      }),
    ])
  }

  const counts = await prisma.bugReport.groupBy({ by: ["status"], _count: true })
  console.log("\nRegistre :", counts.map((c) => `${c.status}=${c._count}`).join("  "))
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
