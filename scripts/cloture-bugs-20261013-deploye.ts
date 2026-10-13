/**
 * Ligne « Déployé en production » dans `bug_status_logs` pour les quatre
 * signalements classés par `cloture-bugs-20261013.ts` (RESOLVED → RESOLVED,
 * statut inchangé), une fois la bascule faite et l'effet prouvé sur gleba.fr.
 *
 *   npx tsx --env-file=.env scripts/cloture-bugs-20261013-deploye.ts           # simulation
 *   npx tsx --env-file=.env scripts/cloture-bugs-20261013-deploye.ts --ecrire
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const ADMIN_ID = "admin_gleba_2026"
const IMAGE = "gleba-app:41d5e51, 4791cde86304, bascule du 2026-10-13 à 08:36:23 UTC"
const PREUVES: Record<string, string> = {
  cmv5cpu7q00028kcnik2appyj: "sonde scripts/qa/sonde-carte-fond-20261013.cjs (1640×1024, Cadastre IGN déjà coché) : dix gestes OK, dont les trois qui perdaient le fond avant le correctif (clic forcé sur le libellé ou sur le radio dans la même tâche que l'ouverture du contrôle, checked posé puis seul événement input) ; Satellite IGN coché, tuiles IGN servies et fond retrouvé après F5 dans chaque cas",
  cmv5jfsol000d8kcnr8aoiuc3: "sonde scripts/qa/sonde-lot-20261013.cjs (lecture seule) : /api/elevage/lots sert effectifPondeuses sur chaque lot pondeur (ex. Pintades perle 1/4, Pondeuses 2026 30/30) et null hors espèce pondeuse ; nbPondeuses de /api/elevage/stats = 37 = somme des effectifs pondeurs des lots actifs ; règle couverte par 14 tests unitaires dont le scénario du ticket (30 + éclosion de 3 → 30 pondeuses)",
  cmv5jwqub000r8kcnwhbkba1h: "sonde scripts/qa/sonde-lot-20261013.cjs : « Semaine suivante » → URL ?tab=calendrier&semaine=2026-10-19, F5 → « Semaine prochaine » conservée ; deux fois « précédente » → semaine=2026-10-05, F5 → « Semaine dernière » conservée ; « Cette semaine » retire le paramètre ; ?semaine=2026-13-45 → semaine courante",
  cmv5jxvcy000t8kcnuod82wj2: "sonde scripts/qa/sonde-lot-20261013.cjs : fil d'Ariane de /elevage/economie « Élevage › Économie » ; ateliers de /api/elevage/analyse-couts : « Ventes œufs », « Ventes lait », « Ventes miel », « Ventes fromage », « Ventes autre »",
}

async function main() {
  const ecrire = process.argv.includes("--ecrire")
  if (/A_COMPLETER/.test(IMAGE) || Object.values(PREUVES).some((p) => /^PREUVE_/.test(p))) {
    throw new Error("Script non renseigné : image et preuves à compléter")
  }
  const tickets = await prisma.bugReport.findMany({
    where: { id: { in: Object.keys(PREUVES) } },
    select: { id: true, status: true, userId: true },
  })
  if (tickets.length !== Object.keys(PREUVES).length) throw new Error("Tickets manquants")
  for (const t of tickets) {
    if (t.userId !== ADMIN_ID) throw new Error(`Ticket ${t.id} d'un autre compte`)
    if (t.status !== "RESOLVED") throw new Error(`Ticket ${t.id} en ${t.status}, attendu RESOLVED`)
    console.log(`${t.id} : + « Déployé en production (${IMAGE}) : ${PREUVES[t.id].slice(0, 60)}… »`)
  }
  if (!ecrire) { console.log("--- simulation : rien écrit (ajouter --ecrire) ---"); return }
  for (const t of tickets) {
    await prisma.bugStatusLog.create({
      data: { bugReportId: t.id, fromStatus: "RESOLVED", toStatus: "RESOLVED", changedById: ADMIN_ID, note: `Déployé en production (${IMAGE}). Effet constaté sur gleba.fr, compte démo : ${PREUVES[t.id]}` },
    })
    console.log(`journal écrit ${t.id}`)
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
