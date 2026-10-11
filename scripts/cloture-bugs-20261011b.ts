/**
 * Classement des huit signalements QA déposés le 2026-10-11 entre 07:40 et
 * 08:01 UTC (compte admin, campagne QA : aucun mail), même mécanique que
 * `cloture-bugs-20261011.ts` (PATCH /api/admin/bugs/[id] reproduit : statut,
 * `resolved_at`, `bug_status_logs`).
 *
 * Correctifs `0e07f60` (arrosage) et `b4af640` (élevage), revus par un
 * relecteur indépendant puis contre-revus, déployés dans `gleba-app:b4af640`
 * (bascule 12:06:49 UTC) et prouvés sur gleba.fr, compte démo, par
 * `scripts/qa/sonde-lot-20261011b.cjs` (un arrosage mesuré noté puis annulé,
 * intervention de sonde supprimée ; toute autre écriture interceptée). Une
 * seule ligne de journal par ticket : corrigé ET déployé.
 *
 * Usage (depuis l'hôte, DATABASE_URL chargé depuis .env) :
 *   npx tsx --env-file=.env scripts/cloture-bugs-20261011b.ts           # simulation
 *   npx tsx --env-file=.env scripts/cloture-bugs-20261011b.ts --ecrire  # classe
 */

import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const ADMIN_ID = "admin_gleba_2026"
const BASCULE =
  "Corrigé (commits COMMITS), déployé en production (gleba-app:b4af640, bascule 12:06 UTC le 2026-10-11), non poussé sur GitHub. Effet constaté sur gleba.fr, compte démo"

type Ticket = { id: string; commits: string; note: string; effet: string }

const TICKETS: Ticket[] = [
  {
    // Météo / Conseils irrigation — la pluie est comptée sous serre et tunnel
    id: "cmv3ja7nr000j9e425w2cbhru",
    commits: "0e07f60",
    note: "La planche C3 du signalement n'a pas de type (ni serre, ni tunnel, ni plein champ) : seul le nom de sa parcelle évoque un tunnel, et le conseil la comptait en plein champ, pluie comprise. Quand le type de planche manque, le conseil calcule maintenant les deux cas. Si seule la pluie évite l'arrosage, il ne tranche pas : « À surveiller », sans dose, avec les deux réponses. Si les deux cas demandent d'arroser, il ne crédite plus la pluie : dose la plus forte, pluie prévue non affichée, les deux chiffres dans le motif. La ligne porte un lien « Planche à compléter : type (plein champ, serre, tunnel) » vers la fiche de la planche. Sous abri, le motif ne dit plus « le bilan ne compte que la pluie ». Les écrans d'arrosage et de pluviométrie partagent une seule règle de type d'abri (quatre copies auparavant).",
    effet: "Demo-B, Planche 15 (type vide) : « Type de planche à renseigner : à arroser sous abri comme en plein champ. Sous serre ou tunnel, sans pluie : 21,2 mm au sol ; en plein champ, pluie comptée : 20,7 mm. Dose retenue : la plus forte. » ; QA-MARC-2809 (type vide, seule la pluie la dispense) : « À surveiller », sans dose, deux réponses ; lien « Planche à compléter : type (plein champ, serre, tunnel), sol » vers la fiche.",
  },
  {
    // Météo / Conseils irrigation — « Noter » annule l'urgence sans quantité
    id: "cmv3japsf000l9e427bhmgijt",
    commits: "0e07f60",
    note: "« Noter » ouvre un champ « Quantité versée sur la planche », prérempli avec le volume conseillé. Avec une quantité, l'arrosage est consigné comme une intervention « arrosage » (eau, en litres) et le conseil retranche l'eau réellement apportée au lieu de considérer la réserve du sol pleine ; il reste « à arroser » si la quantité ne suffit pas, et « Noter » reste disponible. « Quantité inconnue » garde l'ancien comportement (arrosage complet). Le toast propose « Annuler ». Quand la dose conseillée (plafonnée à la réserve facile) ne suffit pas à elle seule, le motif annonce le second apport.",
    effet: "Demo-A · Serre, A3 : champ prérempli à 477 L ; 20 L notés → conseil recalculé « dernier arrosage le 11/10 (1,9 mm au sol) », toujours « à arroser » (dose 49 L/m² au lieu de 49,7) ; « Annuler » supprime l'intervention, conseil revenu à l'identique.",
  },
  {
    // Conseils irrigation — dose précise malgré sol et rétention absents
    id: "cmv3jaru7000n9e42hfh08xbl",
    commits: "0e07f60",
    note: "Sans sol ni rétention sur la planche, le conseil utilisait en silence le sol de la parcelle. Le motif dit maintenant d'où vient le sol (« Sol de la planche non renseigné : réserve estimée d'après le sol de la parcelle (limono-argileux) », ou un sol moyen si la parcelle n'en a pas), le volume devient « environ … », et la ligne porte le lien « Planche à compléter : sol ».",
    effet: "Demo-B, B1 et B6 : motif « Sol de la planche non renseigné : réserve estimée d'après le sol de la parcelle (limono-argileux). Apport conseillé : environ 57 L/m², … » et lien « Planche à compléter : sol ».",
  },
  {
    // Conseils irrigation — arrosage futur réalisé : dates contradictoires
    id: "cmv3jatw8000p9e42y5opr69m",
    commits: "0e07f60",
    note: "L'arrosage du 12/10 coché « réalisé » le 11/10 était ignoré par le bilan mais repris par le pied de carte (« Dernier arrosage : 12/10/2026 ») et compté « Arrosée aujourd'hui » (jours négatifs ramenés à 0). Le dernier arrosage et « Arrosée aujourd'hui » se jugent désormais au jour de l'exploitation, en jours de calendrier, sur le conseil comme sur les tâches : un arrosage daté d'après aujourd'hui ne compte pas. Le formulaire d'intervention décoche « Réalisée » quand on choisit une date future, ramène la date à aujourd'hui quand on coche « Réalisée », et refuse une intervention réalisée datée après aujourd'hui ; le serveur la refuse au-delà de demain (marge pour l'Outre-mer), assistant compris.",
    effet: "Nouvelle intervention : date du 12/10 → « Réalisée » décochée ; cocher « Réalisée » → date ramenée au 11/10. Arrosage noté puis annulé : « Arrosée aujourd'hui » et dernier arrosage au 11/10, cohérents avec le motif.",
  },
  {
    // Conseils irrigation — accents et exposants manquants
    id: "cmv3javy4000r9e42mpj3s1o5",
    commits: "0e07f60",
    note: "Le conseil affiche « Goutte-à-goutte » (la fiche planche enregistre « Goutte-a-goutte ») et des nombres à la française : « 29,9 L/m² », « Bilan 7 j : -11,8 mm », « 1 710 L ». Même correction sur la page Irriguer.",
    effet: "Demo-A · Serre déplié : « Équipement : Goutte-à-goutte », « Bilan 7 j : -11,8 mm » ; plus aucun « L/m2 » ni décimale à point.",
  },
  {
    // Animaux — date de naissance perdue à la création
    id: "cmv3ik18600069e427zxkcbb4",
    commits: "b4af640",
    note: "L'animal du signalement est arrivé au serveur sans date de naissance. La date posée dans le champ sans que le formulaire en soit averti (remplissage automatique) était effacée au rendu suivant, par exemple en saisissant ensuite le prix. Les champs de date de naissance et d'arrivée relisent désormais leur valeur à la saisie et à la sortie du champ.",
    effet: "Nouvel animal : date posée comme le fait un automate, puis prix saisi → la date reste « 10/10/2026 » (enregistrement intercepté, rien d'écrit).",
  },
  {
    // Animaux — prix d'achat à 0 € perdu
    id: "cmv3ikt5l00089e421f9ugcgc",
    commits: "b4af640",
    note: "Le prix de 0 € était bien enregistré, mais « Modifier » l'affichait vide et l'enregistrement suivant l'aurait remplacé par une absence de prix. Le formulaire garde maintenant 0 €, distinct d'un prix inconnu.",
    effet: "Modifier un animal dont le prix d'achat vaut 0 € → champ « Prix achat » = 0 (liste servie à 0 € dans la lecture, rien d'écrit).",
  },
  {
    // Animaux — impossible d'ouvrir une fiche depuis la liste
    id: "cmv3ivtzp000h9e4231ffuqzk",
    commits: "b4af640",
    note: "La ligne d'un animal avait l'apparence d'un lien sans en être un, et le nom de la carte affichée sur petit écran n'était pas un lien. La ligne ouvre maintenant la fiche (sauf pendant une sélection de texte ; Ctrl ou ⌘ ouvre un onglet), comme le nom, et le nom de la carte est un lien vers la fiche.",
    effet: "Liste des animaux à 1056 px : clic sur une cellule de la ligne → /elevage/animaux/267.",
  },
]

async function main() {
  const ecrire = process.argv.includes("--ecrire")
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
