/**
 * Classement des signalements de la campagne QA v8 du 2026-10-23 (matin),
 * déposés sur le compte démo, et du blocage assistant du 2026-10-21. Aucun
 * mail : agents QA automatisés et tickets créés par l'assistant.
 *
 * Deux familles :
 *  - `corrige` : défaut du code corrigé dans le dépôt (ou dans la zone privée
 *    de l'assistant) par le lot du jour, revu par un relecteur indépendant,
 *    déployé et vérifié sur gleba.fr le jour même ;
 *  - `hors-code` : cause hors de l'application (fournisseur du modèle saturé) :
 *    HORS_PERIMETRE, sans `resolved_at`, comme l'écran admin.
 *
 *   npx tsx --env-file=.env scripts/cloture-bugs-20261023.ts           # simulation
 *   npx tsx --env-file=.env scripts/cloture-bugs-20261023.ts --ecrire  # classe
 */
import { PrismaClient, type BugStatus } from "@prisma/client"

const prisma = new PrismaClient()
const ADMIN_ID = "admin_gleba_2026"
const COMMITS = process.env.COMMITS_LOT ?? "lot du 2026-10-23"

type Etat = "corrige" | "hors-code"
type Ticket = { id: string; etat: Etat; note: string }

export const TICKETS: Ticket[] = [
  {
    id: "cmvkp3kqc005izkm4eq5clftz", etat: "corrige",
    note: "L'inspecteur du plan ne lisait que le champ texte libre du porte-greffe, vide pour un arbre créé depuis le catalogue (seul le lien vers le référentiel est enregistré), alors que la fiche lisait le référentiel. Le plan et la fiche partagent maintenant le même champ : liste des porte-greffes compatibles avec l'espèce (Prunier Saint-Julien A, vigueur 3/5), texte libre à défaut ; le choix est conservé à la réouverture et au rechargement.",
  },
  {
    id: "cmvkoxe5o0051zkm4bvokwjmb", etat: "corrige",
    note: "Trois règles coexistaient : l'encart du formulaire lisait le calendrier de l'espèce (prunier : juillet-septembre), la création lisait la variété avec son propre calcul de semaines, et la modification ne contrôlait rien. Une seule règle désormais pour l'encart, la création et la modification : la période de récolte de la variété (Mirabelle de Nancy : mi-août, S33 → S34), à trois semaines près, et le calendrier de l'espèce seulement si la variété n'en a pas. Une récolte au 10/07 ou au 15/09 est signalée hors saison, l'enregistrement reste possible.",
  },
  {
    id: "cmvkpb0g9005uzkm4gy5v8404", etat: "corrige",
    note: "« Par défaut » est accentué dans les deux inspecteurs du plan. Le même balayage a corrigé une quarantaine de libellés d'écran et 47 messages d'erreur sans accents, et une règle de vérification du code refuse désormais ces mots écrits sans accent en minuscules.",
  },
  // --- Assistant IA (zone privée, sur disque, embarquée par la bascule)
  {
    id: "cmvkok5yb004bzkm4m0qgm9l3", etat: "corrige",
    note: "L'assistant additionnait l'effectif des lots, poussins nés dans le lot compris (35 + 35 + 30). Ses lectures d'élevage donnent maintenant l'effectif pondeur de chaque lot par le même calcul que le tableau de bord, et le total « pondeuses toutes espèces » du tableau de bord : sur la démo, 90 poules pondeuses (plus 10 poussins) et 102 pondeuses toutes espèces (poules, canes, oies, pintade), les deux chiffres étant donnés.",
  },
  {
    id: "cmvkormv2004nzkm48xo2v8ww", etat: "corrige",
    note: "Le mode Extra lisait les opérations d'arbres (une source sur trois) et non le registre phytosanitaire ; lu, le registre sortait de plus tronqué. Les traitements réalisés se lisent désormais dans le registre, par le même calcul que l'écran Traçabilité, avec une recherche par mots (« pommiers » retrouve les 8 lignes Pommier de 2026) ; les lignes les plus récentes passent en premier et une sélection partielle est annoncée comme telle.",
  },
  {
    id: "cmvkp05yy005azkm4dza7o5ce", etat: "corrige",
    note: "La recherche des cultures cherchait la phrase entière dans chaque champ séparément, et « Cœur » ne trouvait pas « Coeur ». Elle cherche maintenant mot à mot (espèce, variété, planche), sans tenir compte de la casse, des accents ni des ligatures, en ignorant les mots de contexte : « Cœur de Bœuf A1 », « coeur de boeuf », « tomate A1 » retrouvent la culture.",
  },
  {
    id: "cmvkp2zya005gzkm48vyb2j3h", etat: "hors-code",
    note: "Cause hors du code : l'agent de la plateforme qui sert le mode Support est suspendu depuis le 19/10 ; Paperclip refusait le réveil (409). Gleba le dit désormais à l'utilisateur (« le mode Support est momentanément indisponible ») au lieu d'ouvrir un ticket « réponse incohérente », et laisse une seule trace d'indisponibilité ouverte. La reprise de l'agent est une décision d'exploitation.",
  },
  {
    id: "cmvi2zmdd0003zkm4scn3d5we", etat: "hors-code",
    note: "Cause hors du code : le fournisseur d'IA a refusé toutes les tentatives (429, quota saturé par un autre agent de la plateforme le 21/10, boucle contenue le 23/10). Gleba lit maintenant la cause de l'échec : en cas de saturation, l'utilisateur est prévenu (« le mode Extra est saturé, réessayez dans quelques minutes »), sans relance inutile ni ticket « réponse incohérente ».",
  },
]

function statutDe(etat: Etat): BugStatus {
  return etat === "corrige" ? "RESOLVED" : "HORS_PERIMETRE"
}

function noteJournal(t: Ticket): string {
  if (t.etat === "corrige") return `Lot du 2026-10-23 corrigé (${COMMITS}), revu par un relecteur indépendant, déployé en production le 2026-10-23 (gleba-app:9b90b49-correctif-assistant-2, 13:31 UTC) et vérifié sur gleba.fr (compte démo). ${t.note}`
  return `Hors périmètre (2026-10-23). ${t.note}`
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
