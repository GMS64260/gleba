/**
 * Ligne « Déployé en production » dans `bug_status_logs` pour les 12 signalements
 * classés RESOLVED par `cloture-bugs-20261025.ts` (statut inchangé), une fois la
 * bascule faite et l'effet constaté sur gleba.fr.
 *
 *   npx tsx --env-file=.env scripts/cloture-bugs-20261025-deploye.ts           # simulation
 *   npx tsx --env-file=.env scripts/cloture-bugs-20261025-deploye.ts --ecrire
 */
import { PrismaClient } from "@prisma/client"

const prisma = new PrismaClient()
const ADMIN_ID = "admin_gleba_2026"
const IMAGE = "gleba-app:8f69dba-lot-20261025, 2b68cfa188ba, bascule du 2026-10-25 à 12:44:54 UTC, aucune migration"
const IMAGE_SEULE = "effet non rejoué par sonde ; chaînes métier du correctif présentes dans l'image servie (/app/.next/server) et scénario du ticket rejoué par les tests de route du lot (corps exact de l'écran)"
const SONDE = "sonde cumulative scripts/qa/sonde-cumulative.cjs (navigateur, compte démo) rejouée après la bascule"

const PREUVES: Record<string, string> = {
  // Élevage
  cmvnp6s3z0054qqozx3x38sb7: IMAGE_SEULE + " : PATCH /api/elevage/soins avec le corps « jour seul » du dialogue après « Dater » 08:00, intervalle 48 → 24 puis 24 → 48 : la première injection garde 06:00Z (02:00 avant), la seconde est recalculée (src/app/api/elevage/soins/route.test.ts)",
  cmvnookz70046qqozflwab31j: IMAGE_SEULE + " : libelleEspeceAnimale rend le nom complet d'un profil « v8-… » et cleFiltreEspece sépare deux profils au même premier mot (src/lib/elevage/__tests__/espece-base.test.ts)",
  // Verger
  cmvnp0dm9004uqqozlkmalxx5: IMAGE_SEULE + " : PATCH vente d'un lot élagage de 0,2 m³ avec facture crée « Vente de bois - Élagage (0,2 m³) » et la ligne « Élagage - <arbre> » ; « Vente de bois - elagage » absent de l'image servie (src/app/api/arbres/bois/[id]/route.test.ts)",
  cmvnorxov004bqqozel1aupud: IMAGE_SEULE + " : la fiche arbre pointe vers /verger?tab=operations&arbreId=<id>&annee=<année> et l'onglet filtre par identifiant avec la puce « Opérations de l'arbre … » et le bouton « Tous les arbres » (chaîne présente dans l'image servie)",
  // Transverse
  cmvnout4y004fqqozmi6o37wd: "curl déconnecté sur https://gleba.fr/elevage?tab=alimentation&sub=soins après la bascule : 307 vers /login?callbackUrl=%2Felevage%3Ftab%3Dalimentation%26sub%3Dsoins (avant : callbackUrl=%2Felevage) ; /login?callbackUrl=https://exemple.invalid/x servi 200 sans redirection externe",
  cmvnosa42004dqqozmbhnv4gk: "« Semaine dernière » présent 3 fois et « Semaine derniere » absent dans l'image servie (/app/.next/server) ; règle de lint étendue aux chaînes et aux gabarits",
  cmvno0s5d002eqqozetunv3w2: "GET /api/lunaire?year=2026&month=10 en session démo après la bascule : 25/10 « Gibbeuse croissante », croissante = true, 99 % ; 26/10 « Pleine Lune » à 04:12 UTC, 100 % ; 27/10 « Gibbeuse décroissante », croissante = false, 98 % (avant : « décroissante, 100 % » le 25)",
  cmvnpqtt6005jqqozxojg57jo: "même preuve que le signalement de 11:10 : GET /api/lunaire?year=2026&month=10 rend le 25/10 « Gibbeuse croissante », croissante = true, 99 %",
  // Accueil
  cmvnnwr700025qqozwnlfap11: "HTML prérendu de /aujourdhui dans l'image en service : <h1> sans date (texte masqué « Aujourd’hui » seulement, avant : « Vendredi 23 octobre ») ; /tracabilite sans « Document généré le » ; " + SONDE + " : 0 erreur d'hydratation sur /aujourdhui, /tracabilite, /maraichage/recoltes/saisie et /maraichage à 1346 et 375 px",
  // Maraîchage
  cmvnpkkhp005fqqoz5b0zcv1j: IMAGE_SEULE + " : POST /api/cultures avec le corps exact de « Semer » (Laitue, 2027, 3 rangs, 16 m, 30 cm, sans quantité) enregistre quantite = 159, et le corps de « Semer » porte quantite = 159 (src/app/api/cultures/route.quantite.test.ts, corps-culture-semer.test.ts) ; chaîne « saisie à la main » présente dans l'image servie",
  cmvnppfaa005hqqoz0i99crm5: "complément du signalement FB-0ZCV1J, même preuve : la création par « Semer » enregistre la quantité calculée (159) par la règle unique nbPlantsCulture",
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
