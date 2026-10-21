/**
 * Ligne « Déployé en production » dans `bug_status_logs` pour les 13
 * signalements classés RESOLVED par `cloture-bugs-20261020.ts` (statut
 * inchangé), une fois la bascule faite et l'effet prouvé sur gleba.fr.
 *
 *   npx tsx --env-file=.env scripts/cloture-bugs-20261020-deploye.ts           # simulation
 *   npx tsx --env-file=.env scripts/cloture-bugs-20261020-deploye.ts --ecrire
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const ADMIN_ID = "admin_gleba_2026"
const IMAGE = "gleba-app:686c4ab, ea9363b42e11, bascule du 2026-10-21 à 09:17:53 UTC"
const SONDE = "sonde scripts/qa/sonde-lot-20261020.cjs (API, lecture seule, compte démo, 15/15)"
const IMAGE_SEULE = "effet non rejoué par sonde ; chaîne métier du correctif présente dans l'image servie (/app/.next/server) et code couvert par les tests unitaires du lot"

const PREUVES: Record<string, string> = {
  cmvgddn3l000i4jmqzhmdwgzk: SONDE + " : /api/verger/porte-greffes?especeId=prunier résout « Prunier » et sert ses porte-greffes (avant : liste vide pour la minuscule)",
  cmvgdo90z001g4jmqzz0uzdlw: SONDE + " : /api/comptabilite/stocks rend « Pintades perle A3 1708 : 4 têtes », comme Élevage > Lots (avant : 5)",
  cmvgdp9fn001i4jmqqje30x6e: SONDE + " : GET /api/planches/{id}/suppression sur v8-Marc-2010 rend « porte encore 4 cultures (année 2027) et 2 interventions (année 2026) » avec le lien vers Cultures (avant : « a 4 culture(s) associée(s) » sans année)",
  cmvgdzsf7002f4jmqn8ehdk9c: SONDE + " : /api/comptabilite/revenus rend l'écriture 909 (suivi modeReglement, numeroPiece, notes modifiable) sur la vente d'œufs 86,40 € et la facture F-2026-0007 sur la vente Dahlia 48 € (avant : aucune action possible)",
  cmvge3bqj002m4jmqjcf56bhw: SONDE + " : /api/comptabilite/couts-production rend production = 14 181,49 kg et productionParUnite = {kg 14 181,49 ; tige 60} (avant : 14 241,5 kg, tiges comptées en kilos)",
  cmvge3o5z002o4jmqktfks131: SONDE + " : /api/cultures/irriguer rend la tournée de Tâches et horsTournee = Poireau Bleu de Solaise (C2), critique, non cochée (avant : 3 urgences contre 2 tâches, sans explication)",
  cmvge803p002u4jmq9ecjvh3t: IMAGE_SEULE + " (formatMontantFec, contrôle d'équilibre et message d'export ; 4 tests)",
  cmvgebfkr00324jmqhpeqvbg1: "sonde scripts/qa/sonde-carte-fond-20261020.cjs sans CSS_CORRECTIF : toutes les réouvertures du menu Layers (clic rapide, clic lent, double clic, survol) tombent sur « bouton Layers » et le fond Satellite IGN est conservé après rechargement, sur toutes les tailles testées (avant la bascule : PERDU_A_LA_REOUVERTURE 2/2)",
  cmvgee5s900374jmqhhzbueej: SONDE + " : /api/arbres/pollinisation rend pour #835 nombrePollinisateursValides = 0 avec 1 association explicite démentie (floraisonIncompatible) (avant : « Partielle » sans semaine commune)",
  cmvgeecem00394jmqv940gr3i: SONDE + " : /api/comptabilite/clients rend « v8-Nathalie Amap 2010 » avec nbVentes = 2 (avant : 0 vente)",
  cmvgef6ou003b4jmq5x9ltptu: SONDE + " : /api/consommations sert `unite` sur chaque sortie ; chaîne « Quantité (tiges) » et règle d'unité (preparerSortieStock) dans l'image servie",
  cmvgeif10003d4jmqz5uqvrci: SONDE + " : POST /api/elevage/especes-animales avec rendementCarcasse 65 refusé 400 en nommant le champ rendementCarcasse, rien créé (avant : accepté tel quel)",
  cmvgeltj1003h4jmqb3o9yz1g: SONDE + " : registre phytosanitaire général, ligne v8-Hélène 0929 : surface 100 m², ZNT 20 m, applicateur « v8-Hélène » (avant : Manquant, « - », nom de l'exploitation)",
}

async function main() {
  const ecrire = process.argv.includes("--ecrire")
  const tickets = await prisma.bugReport.findMany({
    where: { id: { in: Object.keys(PREUVES) } },
    select: { id: true, status: true, statusLogs: { select: { note: true }, orderBy: { changedAt: "desc" }, take: 1 } },
  })
  if (tickets.length !== Object.keys(PREUVES).length) throw new Error(`${tickets.length} tickets trouvés sur ${Object.keys(PREUVES).length}`)
  for (const t of tickets) {
    if (t.status !== "RESOLVED") { console.log(`${t.id} en ${t.status} : ignoré`); continue }
    if (t.statusLogs[0]?.note?.startsWith("Déployé en production")) { console.log(`${t.id} déjà journalisé`); continue }
    const note = `Déployé en production (${IMAGE}). Effet constaté sur gleba.fr : ${PREUVES[t.id]}.`
    console.log(`${t.id} → ${note.slice(0, 110)}…`)
    if (!ecrire) continue
    await prisma.bugStatusLog.create({ data: { bugReportId: t.id, fromStatus: "RESOLVED", toStatus: "RESOLVED", changedById: ADMIN_ID, note } })
  }
  if (!ecrire) console.log("--- simulation : rien écrit (ajouter --ecrire) ---")
}

main().catch((e) => { console.error(e); process.exitCode = 1 }).finally(() => prisma.$disconnect())
