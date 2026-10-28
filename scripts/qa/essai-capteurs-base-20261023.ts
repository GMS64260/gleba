/**
 * Banc du lot 1 « capteurs connectés » (2026-10-23) sur une base d'ESSAI,
 * jamais la prod : le script s'arrête si DATABASE_URL ne vise pas
 * `gleba_essai_capteurs`. Exerce le vrai code (adaptateurs, ingestion,
 * agrégats, purge) et le SQL de la migration (CHECK, cascades).
 *
 * Préparer la base (une fois), depuis /var/www/gleba :
 *   sudo -n docker exec gleba_db sh -c 'psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE gleba_essai_capteurs"'
 *   set -a; . ./.env; set +a; export DATABASE_URL="${DATABASE_URL%/*}/gleba_essai_capteurs?schema=public"
 *   npx prisma migrate deploy
 * Lancer (même shell) :
 *   npx tsx scripts/qa/essai-capteurs-base-20261023.ts
 * Démonter : DROP DATABASE gleba_essai_capteurs (même docker exec, -c "DROP DATABASE …").
 */
import prisma from "@/lib/prisma"
import { adapterGenerique, adapterTtn } from "@/lib/capteurs/adaptateurs"
import { ingererTrames } from "@/lib/capteurs/ingestion"
import { agregerEtPurgerMesures } from "@/lib/capteurs/agregats"
import { UPLINK_TTN_LHT65N } from "@/lib/capteurs/__fixtures__/charges"

if (!/\/gleba_essai_capteurs\?/.test(process.env.DATABASE_URL ?? "")) throw new Error("Pas la base d'essai : arrêt")

let echecs = 0
function verifier(nom: string, ok: boolean, detail?: unknown) {
  if (!ok) echecs++
  console.log(`${ok ? "OK  " : "ÉCHEC"} ${nom}${ok ? "" : ` → ${JSON.stringify(detail)}`}`)
}

async function main() {
  const user = await prisma.user.upsert({ where: { email: "essai-capteurs@example.invalid" }, create: { email: "essai-capteurs@example.invalid" }, update: {} })
  await prisma.connecteurCapteurs.deleteMany({ where: { userId: user.id } })
  const maintenant = new Date()

  // 1. TTN : enregistrement puis rejeu
  const ttn = await prisma.connecteurCapteurs.create({ data: { userId: user.id, nom: "TTN", type: "ttn", jetonHash: "essai-h1", jetonPrefixe: "glc_essai", fuseau: "Europe/Paris" } })
  const recuA = new Date(maintenant.getTime() - 60_000).toISOString()
  const a = adapterTtn({ ...UPLINK_TTN_LHT65N, uplink_message: { ...UPLINK_TTN_LHT65N.uplink_message, received_at: recuA } }, maintenant)
  if (!a.ok) throw new Error(a.erreur)
  const b1 = await ingererTrames(ttn, a.trames, maintenant)
  verifier("TTN : 3 mesures, 2 clés inconnues", b1.mesures === 3 && b1.inconnues.length === 2, b1)
  const b2 = await ingererTrames(ttn, a.trames, maintenant)
  verifier("TTN rejoué : 0 mesure, 3 doublons", b2.mesures === 0 && b2.doublons === 3, b2)
  const capteurTtn = await prisma.capteur.findFirstOrThrow({ where: { connecteurId: ttn.id } })
  verifier(
    "capteur créé chez le propriétaire, DevEUI normalisé, modèle, signal, clés reçues",
    capteurTtn.userId === user.id && capteurTtn.identifiantExterne === "00000000000c0de1" && capteurTtn.modele === "dragino/lht65n" &&
      capteurTtn.rssi === -97 && capteurTtn.clesRecues.length === 5 && capteurTtn.avertissement === null,
    capteurTtn,
  )

  // 2. Générique à Nouméa (UTC+11) : 12:30 UTC = 23:30 locale, 13:30 UTC = 00:30 locale du lendemain
  const nou = await prisma.connecteurCapteurs.create({ data: { userId: user.id, nom: "Script", type: "generique", jetonHash: "essai-h2", jetonPrefixe: "glc_essai", fuseau: "Pacific/Noumea" } })
  const avantHier = new Date(maintenant.getTime() - 2 * 86400_000)
  const jourUtc = avantHier.toISOString().slice(0, 10)
  const g = adapterGenerique(
    {
      trames: [
        { capteur: "serre", mesureeA: `${jourUtc}T12:30:00Z`, mesures: { temperature_air: 10 } },
        { capteur: "serre", mesureeA: `${jourUtc}T12:45:00Z`, mesures: { temperature_air: 14 } },
        { capteur: "serre", mesureeA: `${jourUtc}T13:30:00Z`, mesures: { temperature_air: 30 } },
      ],
    },
    maintenant,
  )
  if (!g.ok) throw new Error(g.erreur)
  const b3 = await ingererTrames(nou, g.trames, maintenant)
  verifier("générique : 3 mesures", b3.mesures === 3, b3)

  // 3. Une mesure de plus de 90 jours doit être agrégée AVANT de partir à la purge.
  const serre = await prisma.capteur.findFirstOrThrow({ where: { connecteurId: nou.id } })
  await prisma.mesureCapteur.create({ data: { capteurId: serre.id, grandeur: "temperature_air", valeur: 5, unite: "°C", mesureeA: new Date(maintenant.getTime() - 100 * 86400_000) } })

  const r = await agregerEtPurgerMesures()
  verifier("agrégation et purge exécutées (paramètres typés)", r.agregats >= 4 && r.purgees === 1, r)
  const jours = await prisma.mesureCapteurJour.findMany({ where: { capteurId: serre.id }, orderBy: { jour: "asc" } })
  const j1 = new Date(`${jourUtc}T00:00:00Z`).toISOString().slice(0, 10)
  const j2 = new Date(new Date(`${jourUtc}T00:00:00Z`).getTime() + 86400_000).toISOString().slice(0, 10)
  const recents = jours.filter((j) => j.jour >= new Date(jourUtc))
  verifier("historique de la mesure ancienne conservé", jours.length === 3 && jours[0].moyenne === 5 && jours[0].nombre === 1, jours)
  verifier(
    "jours du lieu à Nouméa : 23:30 et 23:45 le même jour, 00:30 le lendemain",
    recents.length === 2 &&
      recents[0].jour.toISOString().slice(0, 10) === j1 && recents[0].min === 10 && recents[0].max === 14 && recents[0].moyenne === 12 && recents[0].nombre === 2 &&
      recents[1].jour.toISOString().slice(0, 10) === j2 && recents[1].nombre === 1,
    jours,
  )
  const r2 = await agregerEtPurgerMesures()
  const jours2 = await prisma.mesureCapteurJour.findMany({ where: { capteurId: serre.id } })
  verifier("réagrégation idempotente", jours2.length === 3 && r2.purgees === 0, { r2, n: jours2.length })

  // 4. Dernières valeurs (requête de GET /api/capteurs)
  const dernieres = await prisma.$queryRaw<Array<{ capteur_id: string; grandeur: string; valeur: number }>>`
    SELECT DISTINCT ON (m."capteur_id", m."grandeur") m."capteur_id", m."grandeur", m."valeur", m."unite", m."mesuree_a"
    FROM "mesures_capteurs" m JOIN "capteurs" c ON c."id" = m."capteur_id"
    WHERE c."user_id" = ${user.id} AND m."mesuree_a" >= (now() AT TIME ZONE 'UTC') - make_interval(days => ${30}::int)
    ORDER BY m."capteur_id", m."grandeur", m."mesuree_a" DESC`
  const serreDerniere = dernieres.find((d) => d.capteur_id === serre.id)
  verifier("dernière valeur = la plus récente", dernieres.length === 4 && serreDerniere?.valeur === 30, dernieres)

  // 5. CHECK : un seul rattachement (vérifié avant les clés étrangères)
  try {
    await prisma.$executeRawUnsafe(`UPDATE "capteurs" SET "planche_id" = 'x', "arbre_id" = 1 WHERE "id" = $1`, serre.id)
    verifier("CHECK un seul rattachement", false, "accepté")
  } catch (e) {
    verifier("CHECK un seul rattachement", String(e).includes("capteurs_un_rattachement_check"), String(e).slice(0, 200))
  }

  // 6. Cascade : supprimer le connecteur emporte capteurs, mesures et agrégats
  await prisma.connecteurCapteurs.delete({ where: { id: nou.id } })
  const restes = await prisma.mesureCapteurJour.count({ where: { capteurId: serre.id } })
  verifier("suppression en cascade", restes === 0 && (await prisma.capteur.count({ where: { id: serre.id } })) === 0, restes)

  console.log(echecs === 0 ? "\nTout est vert." : `\n${echecs} échec(s).`)
  process.exitCode = echecs === 0 ? 0 : 1
}

main().finally(() => prisma.$disconnect())
