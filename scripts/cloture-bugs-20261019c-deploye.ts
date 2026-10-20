/**
 * Ligne « Déployé en production » dans `bug_status_logs` pour les 18
 * signalements classés RESOLVED par `cloture-bugs-20261019c.ts` (statut
 * inchangé), une fois la bascule faite et l'effet prouvé sur gleba.fr.
 *
 *   npx tsx --env-file=.env scripts/cloture-bugs-20261019c-deploye.ts           # simulation
 *   npx tsx --env-file=.env scripts/cloture-bugs-20261019c-deploye.ts --ecrire
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const ADMIN_ID = "admin_gleba_2026"
const IMAGE = "gleba-app:5beb523, fd240e9c3875, bascule du 2026-10-20 à 07:09:46 UTC"
const SONDE = "sonde scripts/qa/sonde-lot-20261019c.cjs (API, lecture seule, compte démo)"
const IMAGE_SEULE = "effet non rejoué par sonde ; chaîne métier du correctif présente dans l'image servie (/app/.next/server) et code couvert par les tests unitaires du lot"

const PREUVES: Record<string, string> = {
  cmvfdacar000oitoeezeiztid: "relance à froid unique sur issue « blocked » livrée dans l'image (zone privée) ; mesure dans les métriques `relanceFroide` de l'assistant",
  cmvfdjkja000sitoens1ruwwy: "relance à froid unique sur issue « blocked » livrée dans l'image (zone privée) ; mesure dans les métriques `relanceFroide` de l'assistant",
  cmvfkmu1b0012itoe2izmu3qe: IMAGE_SEULE + " (recherche sur culture et planche, `src/lib/interventions/recherche.ts`)",
  cmvfl8smf001litoetqqowsry: IMAGE_SEULE + " (unité de comptage de l'espèce affichée avec lien vers la carte « Chez moi »)",
  cmvfln83f002uitoenu4em7dd: IMAGE_SEULE + " (« Noter l'arrosage de … » présent dans l'image servie, 1 fichier)",
  cmvfm1yvc0049itoekd8vl0sk: SONDE + " : POST /api/planches/{id}/dupliquer existe et refuse nombre=0 en nommant le champ, sans rien créer ; copie des attributs couverte par 15 tests",
  cmvfljv98002kitoe5d3iykme: SONDE + " : /api/arbres/pollinisation sert periodeFloraison sur les deux pruniers aux variétés personnelles (S14+3 et S23+3), là où la colonne affichait « - »",
  cmvflq0sf0032itoe6k42bfao: IMAGE_SEULE + " (« Liane fruitière » dans 21 fichiers de l'image servie)",
  cmvflyt1w0042itoehpgijwuv: SONDE + " : /api/arbres/operations?annee=2027 ne rend que l'opération de 2027, annee=2025 n'en rend aucune de 2026-2027, sans paramètre 21 opérations",
  cmvflv6ku003nitoeo9v3erfy: SONDE + " : lot de la Cave du signalement rendu 2 pc · 0,15 kg · 4 € à 2 €/pièce (avant : 0,3 kg, 0,6 €)",
  cmvfm1aj30045itoet15sl5ho: SONDE + " : /api/tracabilite/carnet-sanitaire?annee=2026 sert Vermifuge, Vaccination, Parage, Prophylaxie… avec typeLabel sur 28 lignes (avant : tout « Autre »)",
  cmvfm1ow70047itoehodzhwt0: SONDE + " : types réels servis par la route, filtre fondé sur la même clé",
  cmvfm9wi5004kitoejer6czwd: SONDE + " : /api/elevage/taches rend stats.echeancesSoins = {total 3, enRetard 2, aVenir 1} au 2026-10-20 (avant : « 3 soins prévus dans les 30 prochains jours »)",
  cmvflhyyu0029itoetnzg2dnv: IMAGE_SEULE + " (« Conditions et notes » dans l'image servie, 2 fichiers ; PDF couvert par 4 tests et une sonde de 5 000 PDF hors dépôt)",
  cmvfljaru002gitoe0n9np2mf: IMAGE_SEULE + " (sélecteur de fiche, encadré de rattachement, 409 sans choix explicite ; 15 tests de route)",
  cmvflk17e002mitoeqe27hfn6: "doublon : même preuve que FB-0N9NP2MF",
  cmvflua2x003litoejod1ddxj: SONDE + " : /api/comptabilite/stats?year=2026 rend revenusEcart = 0 et somme des modules = revenus = 35 169,52 € (avant : écart de 128,10 €)",
  cmvflvsk4003pitoe6yutubct: "sonde scripts/qa/sonde-carte-fond-20261019.cjs (1041×701, Cadastre déjà coché) : 9 gestes OK dont la coche par script sans événement, libellé 100 % visible, menu plus recouvert par la barre ; ancienne sonde du 2026-10-13 toujours verte",
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
