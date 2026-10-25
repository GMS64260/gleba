/**
 * Ligne « Déployé en production » dans `bug_status_logs` pour les 8 signalements
 * de l'après-midi du 2026-10-25 classés RESOLVED par `cloture-bugs-20261025b.ts`
 * (statut inchangé), une fois la seconde bascule faite et l'effet constaté.
 *
 *   npx tsx --env-file=.env scripts/cloture-bugs-20261025b-deploye.ts           # simulation
 *   npx tsx --env-file=.env scripts/cloture-bugs-20261025b-deploye.ts --ecrire
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const ADMIN_ID = "admin_gleba_2026"
const IMAGE = process.env.IMAGE_LOT ?? "gleba-app:<tag>, <id>, bascule du 2026-10-25 à <heure> UTC, migration 20261025100000_salon_communaute"
const IMAGE_SEULE = "effet non rejoué par sonde ; chaînes métier du correctif présentes dans l'image servie (/app/.next/server) et scénario du ticket rejoué par les tests du lot (corps exact de l'écran)"

const PREUVES: Record<string, string> = {
  cmvntzwng0005mox2i5gvcbj3: "curl en session démo après la bascule : /tracabilite?registre=culture&annee=2027 servi 200 et chaîne « registre= » dans le bundle servi ; " + IMAGE_SEULE + " (src/lib/tracabilite/__tests__/registre-url.test.ts)",
  cmvnulry1001umox2yedrqv9y: "GET /api/tracabilite/registre-culture en session démo après la bascule : les dates servies sont au format « AAAA-MM-JJ » (jour civil) ; " + IMAGE_SEULE + " (route.test.ts : ligne stockée 22:00Z affichée « 12 avr. »)",
  cmvnu7ad8000pmox2ejmeaycq: "curl https://gleba.fr/referentiel/vegetaux/Pommier après la bascule : « NON_TROUVE » absent de la page, « À documenter » présent",
  cmvnur8eu003cmox21ahc0p7g: IMAGE_SEULE + " : get_planches classe la courge 826 (récolte du 04/10 au 01/11/2026) « en place : en récolte (2026) » et le poivron « planifiée pour 2027 » (src/lib/chat/situation-culture.test.ts, zone privée, et src/lib/cultures/__tests__/en-place.test.ts)",
  cmvnvaal2005umox2ac7dyjfb: "GET /api/recoltes en session démo après la bascule : chaque lot en stock porte `valorisation` (source, prixUnitaire, nombreVentes) et les lots de dahlia en tiges ne sont plus valorisés 30 €/tige ; " + IMAGE_SEULE + " (valorisation.test.ts : Récoltes et Stocks unifiés = même montant)",
  cmvnuxvax004pmox29m1oukuk: IMAGE_SEULE + " : le PDF de la facture à 40 tiges × 1,20 € TTC contient « 1,1374 », « soit 1,20 € TTC », 45,50 / 2,50 / 48,00 (src/lib/__tests__/facture-pdf.test.ts, facturx-echantillons.test.ts)",
  cmvnv4vww005kmox2fifm8998: "chaînes « 5,00 € » : formatMontantDevise dans les écrans de la boutique (zone privée) et les courriels de commande ; plus aucun toFixed(2) + « € » dans la boutique ni dans src/lib/mail.ts (image servie)",
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
