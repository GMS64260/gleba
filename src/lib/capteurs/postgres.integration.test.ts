/**
 * Régressions sur une base PostgreSQL JETABLE, jamais sur une base utilisateur.
 * Appliquer les migrations puis lancer ce fichier avec DATABASE_URL et
 * CAPTEURS_TEST_DATABASE_URL identiques, base locale gleba_capteurs_regression.
 * Sans ce second paramètre, la suite ordinaire ignore ce banc.
 */
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest"
import { randomUUID } from "node:crypto"
import { NextRequest } from "next/server"

const session = vi.hoisted(() => ({ userId: "" }))
vi.mock("@/lib/auth-utils", () => ({
  requireAuthApi: async () => ({ error: null, session: { user: { id: session.userId, estProprietaireExploitation: true } } }),
  getUserId: (s: { user: { id: string } }) => s.user.id,
}))
vi.mock("@/lib/demo-garde", () => ({ refusSiCompteDemo: async () => null, MESSAGES_REFUS_DEMO: {} }))

import prisma from "@/lib/prisma"
import { agregerEtPurgerMesures, agregerMesuresRecentes, purgerMesuresAnciennes, supprimerMesuresBrutesDuCompte } from "./agregats"
import { ingererTrames } from "./ingestion"
import { importAccount } from "@/lib/account-transfer"
import { PATCH as modifierCapteur } from "@/app/api/capteurs/[id]/route"
import { PATCH as modifierConnecteur } from "@/app/api/capteurs/connecteurs/[id]/route"
import { GET as exporter } from "@/app/api/account/export/route"
import { GET as lister } from "@/app/api/capteurs/route"
import { GET as lireMesures } from "@/app/api/capteurs/[id]/mesures/route"

const testUrl = process.env.CAPTEURS_TEST_DATABASE_URL
const jourMs = 86400_000

describe.skipIf(!testUrl)("capteurs : régressions PostgreSQL", () => {
  const comptes: string[] = []
  let connecteurId: string
  let capteurId: string

  async function nouveauCompte() {
    const user = await prisma.user.create({ data: { email: `qa-${randomUUID()}@example.invalid` } })
    comptes.push(user.id)
    return user.id
  }

  async function nouveauCapteur(userId: string, fuseau = "Europe/Paris") {
    const connecteur = await prisma.connecteurCapteurs.create({
      data: { userId, nom: "Banc synthétique", type: "generique", jetonHash: randomUUID(), jetonPrefixe: "glc_essai", fuseau },
    })
    const capteur = await prisma.capteur.create({ data: { userId, connecteurId: connecteur.id, identifiantExterne: "sonde" } })
    return { connecteurId: connecteur.id, capteurId: capteur.id }
  }

  function mesure(mesureeA: Date, valeur = 12, id?: bigint) {
    return prisma.mesureCapteur.create({ data: { id, capteurId, grandeur: "temperature_air", valeur, unite: "°C", mesureeA } })
  }

  function patchCapteur(corps: unknown) {
    return modifierCapteur(new Request("http://localhost/api/capteurs/sonde", { method: "PATCH", body: JSON.stringify(corps) }), {
      params: Promise.resolve({ id: capteurId }),
    })
  }

  function patchConnecteur(corps: unknown) {
    return modifierConnecteur(new Request("http://localhost/api/capteurs/connecteurs/banc", { method: "PATCH", body: JSON.stringify(corps) }), {
      params: Promise.resolve({ id: connecteurId }),
    })
  }

  const agregats = () => prisma.mesureCapteurJour.findMany({ where: { capteurId }, orderBy: { jour: "asc" } })
  const valeurSequenceJours = async () => (await prisma.$queryRaw<Array<{ v: bigint | null }>>`
    SELECT pg_sequence_last_value(pg_get_serial_sequence('mesures_capteurs_jours', 'id')::regclass) AS v
  `)[0].v
  const midiUtc = (joursAvant: number) => new Date(`${new Date(Date.now() - joursAvant * jourMs).toISOString().slice(0, 10)}T12:00:00Z`)

  beforeAll(() => {
    const url = new URL(testUrl!)
    if (url.hostname !== "127.0.0.1" || url.pathname !== "/gleba_capteurs_regression" || process.env.DATABASE_URL !== testUrl) {
      throw new Error("Le banc exige sa base locale jetable, identique dans les deux variables d'environnement")
    }
  })

  beforeEach(async () => {
    session.userId = await nouveauCompte()
    ;({ connecteurId, capteurId } = await nouveauCapteur(session.userId))
  })

  afterEach(async () => {
    if (comptes.length) await prisma.user.deleteMany({ where: { id: { in: comptes.splice(0) } } })
  })
  afterAll(() => prisma.$disconnect())

  it("rattrape 20 et 100 jours avant de purger, et conserve l'agrégat aux passages suivants", async () => {
    await mesure(new Date(Date.now() - 100 * jourMs), 5)
    await mesure(midiUtc(20), 15)
    const resultat = await agregerEtPurgerMesures()
    expect(resultat).toEqual({ agregats: 2, purgees: 1, echecs: 0 })
    const jours = await agregats()
    expect(jours.map((j) => j.moyenne)).toEqual([5, 15])
    const sequence = await valeurSequenceJours()
    // Journées déjà agrégées et inchangées : ni écriture ni valeur de séquence (SERIAL int4).
    expect(await agregerEtPurgerMesures()).toEqual({ agregats: 0, purgees: 0, echecs: 0 })
    expect(await agregats()).toEqual(jours)
    // Journée complétée : mise à jour en place, toujours sans séquence.
    await mesure(new Date(midiUtc(20).getTime() + 1000), 25)
    expect(await agregerEtPurgerMesures()).toEqual({ agregats: 1, purgees: 0, echecs: 0 })
    expect((await agregats()).map((j) => [j.id, j.moyenne, j.nombre])).toEqual([[jours[0].id, 5, 1], [jours[1].id, 20, 2]])
    expect(await valeurSequenceJours()).toBe(sequence)
  })

  it("une purge appelée directement agrège d'abord les jours manqués", async () => {
    await mesure(new Date(Date.now() - 120 * jourMs), 7)
    expect(await purgerMesuresAnciennes()).toBe(1)
    expect(await agregats()).toMatchObject([{ moyenne: 7, nombre: 1 }])
  })

  it("garde la journée entière au seuil de rétention, même à Nouméa", async () => {
    await prisma.connecteurCapteurs.update({ where: { id: connecteurId }, data: { fuseau: "Pacific/Noumea" } })
    const [seuil] = await prisma.$queryRaw<Array<{ jour: string }>>`
      SELECT to_char((now() - interval '90 days') AT TIME ZONE 'Pacific/Noumea', 'YYYY-MM-DD') AS jour
    `
    await mesure(new Date(`${seuil.jour}T00:00:00+11:00`), 10)
    await mesure(new Date(`${seuil.jour}T23:59:59+11:00`), 30)
    expect((await agregerEtPurgerMesures()).purgees).toBe(0)
    expect(await prisma.mesureCapteur.count({ where: { capteurId } })).toBe(2)
    await agregerEtPurgerMesures()
    expect(await agregats()).toMatchObject([{ moyenne: 20, nombre: 2 }])
  })

  it("une erreur d'agrégation annule aussi la purge du connecteur, sans arrêter les autres", async () => {
    await mesure(new Date(Date.now() - 100 * jourMs), 10)
    await mesure(new Date(Date.now() - 100 * jourMs + 1000), 20)
    const tiers = await nouveauCapteur(await nouveauCompte())
    await prisma.mesureCapteur.create({ data: { capteurId: tiers.capteurId, grandeur: "temperature_air", valeur: 4, unite: "°C", mesureeA: new Date(Date.now() - 100 * jourMs) } })
    await prisma.$executeRaw`ALTER TABLE "mesures_capteurs_jours" ADD CONSTRAINT "banc_nombre" CHECK ("nombre" < 2)`
    try {
      expect(await agregerEtPurgerMesures()).toEqual({ agregats: 1, purgees: 1, echecs: 1 })
      expect(await prisma.mesureCapteur.count({ where: { capteurId } })).toBe(2)
      expect(await agregats()).toEqual([])
      expect(await prisma.mesureCapteur.count({ where: { capteurId: tiers.capteurId } })).toBe(0)
      expect(await prisma.mesureCapteurJour.findMany({ where: { capteurId: tiers.capteurId } })).toMatchObject([{ moyenne: 4, nombre: 1 }])
    } finally {
      await prisma.$executeRaw`ALTER TABLE "mesures_capteurs_jours" DROP CONSTRAINT "banc_nombre"`
    }
  })

  it("un fuseau invalide déjà en base n'empêche ni les agrégats ni la purge des autres comptes", async () => {
    await prisma.$executeRaw`UPDATE "connecteurs_capteurs" SET "fuseau" = 'Mars/Olympus' WHERE "id" = ${connecteurId}`
    await mesure(new Date(Date.now() - 100 * jourMs), 10)
    const tiers = await nouveauCapteur(await nouveauCompte(), "Pacific/Noumea")
    await prisma.mesureCapteur.create({ data: { capteurId: tiers.capteurId, grandeur: "temperature_air", valeur: 4, unite: "°C", mesureeA: new Date(Date.now() - 100 * jourMs) } })
    expect(await agregerEtPurgerMesures()).toEqual({ agregats: 1, purgees: 1, echecs: 1 })
    expect(await prisma.mesureCapteur.count({ where: { capteurId } })).toBe(1)
    expect(await prisma.mesureCapteur.count({ where: { capteurId: tiers.capteurId } })).toBe(0)
  })

  it("restaure un fuseau importé hors liste sur le défaut, et le cron passe ensuite", async () => {
    await mesure(new Date(), 12)
    const fichier = await (await exporter(new Request("http://localhost/api/account/export"))).json()
    fichier.data.ConnecteurCapteurs[0].fuseau = "Mars/Olympus"
    await prisma.user.delete({ where: { id: session.userId } })
    const resultat = await importAccount(await nouveauCompte(), fichier)
    expect(resultat.warnings).toContainEqual(expect.stringContaining("« Mars/Olympus » inconnu, remplacé par Europe/Paris"))
    expect((await prisma.connecteurCapteurs.findUniqueOrThrow({ where: { id: connecteurId } })).fuseau).toBe("Europe/Paris")
    expect((await agregerEtPurgerMesures()).echecs).toBe(0)
  })

  it("corrige un fuseau stocké invalide sans 500, en gardant un agrégat importé sans son brut", async () => {
    await prisma.$executeRaw`UPDATE "connecteurs_capteurs" SET "fuseau" = 'Mars/Olympus' WHERE "id" = ${connecteurId}`
    const jour = new Date(Date.now() - 3 * jourMs).toISOString().slice(0, 10)
    await mesure(new Date(`${jour}T20:00:00Z`), 12)
    await prisma.mesureCapteurJour.create({ data: { capteurId, grandeur: "temperature_air", jour: new Date("2026-01-15"), min: 1, max: 3, moyenne: 2, nombre: 96, unite: "°C" } })
    expect((await patchConnecteur({ fuseau: "Pacific/Noumea" })).status).toBe(200)
    expect((await prisma.connecteurCapteurs.findUniqueOrThrow({ where: { id: connecteurId } })).fuseau).toBe("Pacific/Noumea")
    const jours = await agregats()
    expect(jours.map((j) => [j.jour.toISOString().slice(0, 10), j.nombre])).toEqual([
      ["2026-01-15", 96],
      [new Date(new Date(jour).getTime() + jourMs).toISOString().slice(0, 10), 1],
    ])
    expect((await agregerEtPurgerMesures()).echecs).toBe(0)
  })

  it("une trame reçue pendant le rattachement d'une clé ne la fait pas réapparaître inconnue", async () => {
    await prisma.capteur.update({ where: { id: capteurId }, data: { clesRecues: ["x"], clesInconnues: ["x"] } })
    let relacher!: () => void
    const attente = new Promise<void>((r) => { relacher = r })
    // Comme PATCH /api/capteurs/[id] : verrou de ligne, puis correspondance et inconnues recalculées.
    const rattachement = prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT "id" FROM "capteurs" WHERE "id" = ${capteurId} FOR UPDATE`
      await attente
      await tx.capteur.update({ where: { id: capteurId }, data: { correspondances: { x: "temperature_air" }, clesInconnues: [] } })
    })
    const trame = { identifiantExterne: "sonde", modele: null, mesureeA: new Date(), valeurs: [["x", 21]] as Array<[string, number]>, batterie: null, rssi: null, snr: null, position: null, avertissement: null }
    const ingestion = ingererTrames({ id: connecteurId, userId: session.userId, type: "generique" }, [trame], new Date())
    await new Promise((r) => setTimeout(r, 300))
    relacher()
    await rattachement
    expect(await ingestion).toMatchObject({ mesures: 1, inconnues: [] })
    expect((await prisma.capteur.findUniqueOrThrow({ where: { id: capteurId } })).clesInconnues).toEqual([])
  })

  it("« Vider mes données » supprime le brut du seul compte, par lots", async () => {
    for (let i = 0; i < 3; i++) await mesure(new Date(Date.now() - i * 1000), i)
    const tiers = await nouveauCapteur(await nouveauCompte())
    await prisma.mesureCapteur.create({ data: { capteurId: tiers.capteurId, grandeur: "temperature_air", valeur: 4, unite: "°C", mesureeA: new Date() } })
    expect(await supprimerMesuresBrutesDuCompte(session.userId)).toBe(3)
    expect(await prisma.mesureCapteur.count({ where: { capteurId } })).toBe(0)
    expect(await prisma.mesureCapteur.count({ where: { capteurId: tiers.capteurId } })).toBe(1)
  })

  it("retire l'ancien jour et reconstruit immédiatement après un changement de fuseau", async () => {
    const jour = new Date(Date.now() - 3 * jourMs).toISOString().slice(0, 10)
    await mesure(new Date(`${jour}T20:00:00Z`))
    await agregerMesuresRecentes()
    expect((await agregats())[0].jour.toISOString().slice(0, 10)).toBe(jour)
    const tiers = await nouveauCapteur(await nouveauCompte())
    await prisma.mesureCapteurJour.create({ data: { capteurId: tiers.capteurId, grandeur: "temperature_air", jour: new Date(jour), min: 1, max: 1, moyenne: 1, nombre: 1, unite: "°C" } })

    expect((await patchConnecteur({ fuseau: "Pacific/Noumea" })).status).toBe(200)
    const nouveaux = await agregats()
    expect(nouveaux).toHaveLength(1)
    expect(nouveaux[0].nombre).toBe(1)
    expect(nouveaux[0].jour.toISOString().slice(0, 10)).toBe(new Date(new Date(jour).getTime() + jourMs).toISOString().slice(0, 10))
    await agregerEtPurgerMesures()
    expect(await agregats()).toEqual(nouveaux)
    expect(await prisma.mesureCapteurJour.count({ where: { capteurId: tiers.capteurId } })).toBe(1)
  })

  it("ne change aucun réglage ni agrégat si le brut archivé empêche la reconstruction", async () => {
    await mesure(new Date(Date.now() - 100 * jourMs))
    await agregerEtPurgerMesures()
    const avant = await prisma.connecteurCapteurs.findUniqueOrThrow({ where: { id: connecteurId } })
    const jours = await agregats()
    expect((await patchConnecteur({ fuseau: "Pacific/Noumea", regenererJeton: true, nom: "Autre nom" })).status).toBe(409)
    expect(await prisma.connecteurCapteurs.findUnique({ where: { id: connecteurId } })).toEqual(avant)
    expect(await agregats()).toEqual(jours)
  })

  it("conserve deux modifications concurrentes puis un retrait concurrent d'une autre clé", async () => {
    const reponses = await Promise.all([
      patchCapteur({ correspondances: { x: "temperature_air" } }),
      patchCapteur({ correspondances: { y: "humidite_air" } }),
    ])
    expect(reponses.map((r) => r.status)).toEqual([200, 200])
    expect((await prisma.capteur.findUniqueOrThrow({ where: { id: capteurId } })).correspondances).toEqual({ x: "temperature_air", y: "humidite_air" })
    await Promise.all([
      patchCapteur({ retirerCorrespondances: ["x"] }),
      patchCapteur({ correspondances: { z: "poids" } }),
    ])
    expect((await prisma.capteur.findUniqueOrThrow({ where: { id: capteurId } })).correspondances).toEqual({ y: "humidite_air", z: "poids" })
  })

  it("sérialise le cron avec un changement de fuseau", async () => {
    const jour = new Date(Date.now() - 3 * jourMs).toISOString().slice(0, 10)
    await mesure(new Date(`${jour}T20:00:00Z`))
    await agregerMesuresRecentes()
    await Promise.all([agregerEtPurgerMesures(), patchConnecteur({ fuseau: "Pacific/Noumea" })])
    const jours = await agregats()
    expect(jours).toHaveLength(1)
    expect(jours[0].nombre).toBe(1)
    expect(jours[0].jour.toISOString().slice(0, 10)).not.toBe(jour)
  })

  it("exporte par HTTP puis importe les BigInt sans collision ni perte de précision", async () => {
    const ancienId = BigInt("9007199254740993")
    await mesure(new Date(), 12, ancienId)
    const reponse = await exporter(new Request("http://localhost/api/account/export"))
    expect(reponse.status).toBe(200)
    const fichier = await reponse.json()
    expect(fichier.data.MesureCapteur[0].id).toBe(ancienId.toString())

    await prisma.user.delete({ where: { id: session.userId } })
    const tiers = await nouveauCapteur(await nouveauCompte())
    await prisma.mesureCapteur.create({ data: { id: ancienId, capteurId: tiers.capteurId, grandeur: "temperature_air", valeur: 50, unite: "°C", mesureeA: new Date() } })
    const cible = await nouveauCompte()
    const resultat = await importAccount(cible, fichier)
    expect(resultat.imported.MesureCapteur).toBe(1)
    expect(resultat.skipped.MesureCapteur).toBeUndefined()
    const restauree = await prisma.mesureCapteur.findFirstOrThrow({ where: { capteurId } })
    expect(restauree.id).not.toBe(ancienId)
    expect(restauree.valeur).toBe(12)
    expect((await prisma.capteur.findUniqueOrThrow({ where: { id: capteurId } })).userId).toBe(cible)
  })

  it("sert l'historique annuel d'un capteur muet dont le brut est purgé", async () => {
    await mesure(new Date(Date.now() - 100 * jourMs), 9)
    await agregerEtPurgerMesures()
    const liste = await (await lister()).json()
    expect(liste.capteurs[0].dernieresValeurs).toEqual([])
    const historique = await lireMesures(new NextRequest(`http://localhost/api/capteurs/${capteurId}/mesures?grandeur=temperature_air&jours=365`), {
      params: Promise.resolve({ id: capteurId }),
    })
    expect((await historique.json()).jours).toMatchObject([{ moyenne: 9, nombre: 1 }])
  })
})
