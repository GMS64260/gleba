/**
 * Classement du blocage d'assistant du 2026-10-18 (« variété Carmen
 * introuvable »), corrigé, déployé et prouvé le 2026-10-19 : OPEN → RESOLVED,
 * `resolved_at`, une ligne « Déployé en production » dans `bug_status_logs`.
 *
 * Ticket d'un utilisateur réel : ce script n'envoie AUCUN mail (la route
 * PATCH /api/admin/bugs/[id] en enverrait un au premier passage en RESOLVED ;
 * pas de mail à un utilisateur sans accord explicite de Guillaume). La ligne
 * RESOLVED écrite ici fait que la route n'en enverra plus ensuite : prévenir
 * l'utilisateur, si on le souhaite, se fait à la main.
 *
 *   npx tsx --env-file=.env scripts/cloture-bugs-20261019.ts           # simulation
 *   npx tsx --env-file=.env scripts/cloture-bugs-20261019.ts --ecrire  # classe
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const ADMIN_ID = "admin_gleba_2026"
const TICKET = "cmve8syvr0073e9gp964mf4f4"
const IMAGE = "gleba-app:50dd184, a4d75bdf1dc1, bascule du 2026-10-19 à 08:42:37 UTC"
const NOTE =
  "La variété existait bien, en variété perso du compte : `get_varietes` cherchait sur l'identifiant, qui est un cuid pour une variété perso, et non sur son nom ; la lecture n'était pas non plus bornée au compte. " +
  "`get_varietes` et `get_especes` appliquent désormais la visibilité du référentiel (catalogue Gleba, partagé, perso du compte) et cherchent sur le nom ; " +
  "`create_culture` et `create_cultures` résolvent une variété donnée par son nom dans l'espèce, celle du compte d'abord ; les lectures de cultures disent la variété par son nom. " +
  "Le compte avait créé la culture à la main entre-temps."
const PREUVE =
  "même code exécuté en lecture seule sur la base : `get_varietes` « Carmen » renvoie la variété perso (Laitue) à son auteur et rien au compte démo ; " +
  "tests src/lib/chat (140 verts, dont les cas « Carmen » donnée par son nom et variété d'un autre compte refusée)"

async function main() {
  const ecrire = process.argv.includes("--ecrire")
  const admin = await prisma.user.findUnique({ where: { id: ADMIN_ID }, select: { role: true } })
  if (admin?.role !== "ADMIN") throw new Error(`Compte admin ${ADMIN_ID} introuvable`)

  const t = await prisma.bugReport.findUnique({ where: { id: TICKET }, select: { id: true, status: true, type: true } })
  if (!t) throw new Error(`Ticket ${TICKET} introuvable`)
  if (t.status !== "OPEN") {
    console.log(`${TICKET} déjà en ${t.status} : rien à faire`)
    return
  }
  console.log(`${TICKET} ${t.type} OPEN → RESOLVED + « Déployé en production (${IMAGE}) »`)
  if (!ecrire) {
    console.log("--- simulation : rien écrit (ajouter --ecrire) ---")
    return
  }

  await prisma.$transaction([
    prisma.bugReport.update({
      where: { id: TICKET },
      data: { status: "RESOLVED", adminNote: NOTE, resolvedAt: new Date() },
    }),
    prisma.bugStatusLog.create({
      data: {
        bugReportId: TICKET,
        fromStatus: "OPEN",
        toStatus: "RESOLVED",
        changedById: ADMIN_ID,
        note: `Déployé en production (${IMAGE}). ${NOTE} Effet constaté : ${PREUVE}.`,
      },
    }),
  ])
  console.log(`RESOLVED ${TICKET} (aucun mail envoyé)`)
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
