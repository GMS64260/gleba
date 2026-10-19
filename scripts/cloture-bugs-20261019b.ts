/**
 * Classement des trois signalements ouverts au 2026-10-19 (après-midi) :
 *   - cmv9dy2ow (QA 15/10, œufs écartés annoncés « vendables dès » une date
 *     passée) et cmv9e1u2r (QA 15/10, actions de ligne des animaux sans nom
 *     accessible) : corrigés (`3db60db`, `261e96c`), déployés et prouvés sur
 *     gleba.fr par `scripts/qa/sonde-lot-20261019b.cjs` → RESOLVED, avec une
 *     ligne « Déployé en production » dans `bug_status_logs` ;
 *   - cmvecflbo (blocage d'assistant depuis la démo, taux de germination et de
 *     levée) : fonction absente, besoin reconnu non planifié (décision de
 *     Guillaume le 2026-10-19) → EVOLUTION_PRODUIT, sans `resolved_at`.
 *
 * Tickets de l'agent QA (compte admin) et de la démo : aucun mail.
 *
 *   npx tsx --env-file=.env scripts/cloture-bugs-20261019b.ts           # simulation
 *   npx tsx --env-file=.env scripts/cloture-bugs-20261019b.ts --ecrire  # classe
 */
import { PrismaClient, type BugStatus } from "@prisma/client"

const prisma = new PrismaClient()
const ADMIN_ID = "admin_gleba_2026"
const IMAGE = process.env.IMAGE_DEPLOYEE ?? ""

const TICKETS: { id: string; statut: BugStatus; note: string; log: (image: string) => string }[] = [
  {
    id: "cmv9dy2ow0016e9gppkophmnt",
    statut: "RESOLVED",
    note:
      "La règle était juste : une ponte faite pendant un délai d'attente œufs reste écartée pour toujours, la remise en vente ne vaut que pour les pontes suivantes. " +
      "C'est l'affichage qui se contredisait : « vendables dès le » la date de remise en vente, déjà passée. " +
      "Le tableau « Traçabilité du stock » dit désormais « Écartés (délai véto) » et « Pondus pendant le délai d'attente (fin le …) : jamais vendables », sans limite de vente sur ces lignes ; une tuile compte les écartés. L'assistant tient le même discours (commit 3db60db).",
    log: (image) =>
      `Déployé en production (${image}). Effet constaté sur gleba.fr, compte démo (ponte du 28/09 sous un délai fini le 01/10) : avant, « Délai véto · vendables dès le 02/10/2026 » ; après, « Écartés (délai véto) · Pondus pendant le délai d'attente (fin le 01/10/2026) : jamais vendables », limite de vente « - ».`,
  },
  {
    id: "cmv9e1u2r0019e9gp9d9a402q",
    statut: "RESOLVED",
    note:
      "Les boutons-icônes des lignes n'avaient que l'infobulle, qui ne nomme pas le bouton. " +
      "Chaque action de ligne des tables Animaux et Lots porte maintenant un nom qui dit le geste et la ligne (« Vendre J15-R01 », « Déclarer le décès de … », « Réformer le lot … »), lien de soin et « × » de suppression compris (commit 261e96c).",
    log: (image) =>
      `Déployé en production (${image}). Effet constaté sur gleba.fr, compte démo : avant, 83 actions de ligne d'animaux et 50 de lots sans nom ; après, aucune.`,
  },
  {
    id: "cmvecflbo007ne9gpoxfp94ld",
    statut: "EVOLUTION_PRODUIT",
    note:
      "Fonction absente, l'assistant a bien répondu. Gleba connaît un taux de germination de référence par espèce (fiche espèce), utilisé pour calculer les besoins en semences, " +
      "mais ne permet pas de saisir les graines semées et les plants levés d'une culture, ni donc de calculer un taux observé. Besoin reconnu, non planifié.",
    log: () => "Évolution produit : besoin reconnu, non planifié (2026-10-19).",
  },
]

async function main() {
  const ecrire = process.argv.includes("--ecrire")
  const admin = await prisma.user.findUnique({ where: { id: ADMIN_ID }, select: { role: true } })
  if (admin?.role !== "ADMIN") throw new Error(`Compte admin ${ADMIN_ID} introuvable`)
  if (ecrire && !IMAGE) throw new Error("IMAGE_DEPLOYEE manquant (tag, id court et heure de la bascule)")

  for (const t of TICKETS) {
    const actuel = await prisma.bugReport.findUnique({ where: { id: t.id }, select: { status: true } })
    if (!actuel) throw new Error(`Ticket ${t.id} introuvable`)
    if (actuel.status !== "OPEN") {
      console.log(`${t.id} déjà en ${actuel.status} : rien à faire`)
      continue
    }
    console.log(`${t.id} OPEN → ${t.statut}`)
    if (!ecrire) continue
    await prisma.$transaction([
      prisma.bugReport.update({
        where: { id: t.id },
        data: { status: t.statut, adminNote: t.note, resolvedAt: t.statut === "RESOLVED" ? new Date() : null },
      }),
      prisma.bugStatusLog.create({
        data: { bugReportId: t.id, fromStatus: "OPEN", toStatus: t.statut, changedById: ADMIN_ID, note: t.log(IMAGE) },
      }),
    ])
  }
  if (!ecrire) console.log("--- simulation : rien écrit (ajouter --ecrire) ---")
}

main()
  .catch((err) => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())
