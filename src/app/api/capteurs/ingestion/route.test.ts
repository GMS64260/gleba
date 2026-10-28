import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { NextRequest, NextResponse } from "next/server"

const mocks = vi.hoisted(() => ({
  connecteurFindUnique: vi.fn(),
  connecteurUpdate: vi.fn(),
  capteurFindUnique: vi.fn(),
  capteurCount: vi.fn(),
  capteurCreate: vi.fn(),
  capteurUpdate: vi.fn(),
  capteurFindUniqueOrThrow: vi.fn(),
  mesuresCreateMany: vi.fn(),
  checkRateLimit: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  default: {
    connecteurCapteurs: { findUnique: mocks.connecteurFindUnique, update: mocks.connecteurUpdate },
    capteur: {
      findUnique: mocks.capteurFindUnique,
      count: mocks.capteurCount,
      create: mocks.capteurCreate,
      update: mocks.capteurUpdate,
      findUniqueOrThrow: mocks.capteurFindUniqueOrThrow,
    },
    mesureCapteur: { createMany: mocks.mesuresCreateMany },
  },
}))
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: mocks.checkRateLimit, getClientIP: () => "203.0.113.7" }))

import { POST } from "./route"
import { genererJeton, hacherJeton } from "@/lib/capteurs/jeton"
import { consommerBudgets, viderBudgets } from "@/lib/capteurs/budget"
import { viderEmpreintesRefusees } from "@/lib/capteurs/jetons-refuses"
import { FENETRE_BUDGET_MS, MAX_CAPTEURS_PAR_CONNECTEUR, MESURES_MAX_PAR_COMPTE } from "@/lib/capteurs/ingestion"
import { JOIN_TTN, MAINTENANT_FIXTURES, UPLINK_TTN_LHT65N, UP_CHIRPSTACK_EM500 } from "@/lib/capteurs/__fixtures__/charges"

const { jeton } = genererJeton()

function requete(corps: unknown, options: { auth?: string | null; query?: string } = {}) {
  const auth = options.auth === undefined ? `Bearer ${jeton}` : options.auth
  return new NextRequest(`http://localhost/api/capteurs/ingestion${options.query ?? ""}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...(auth ? { authorization: auth } : {}) },
    body: typeof corps === "string" ? corps : JSON.stringify(corps),
  })
}

function connecteur(type: string, surcharges: Record<string, unknown> = {}) {
  return { id: "conn-1", userId: "proprio", type, actif: true, ...surcharges }
}

function capteurEnBase(surcharges: Record<string, unknown> = {}) {
  return { id: "cap-1", modele: null, correspondances: null, clesInconnues: [], clesRecues: [], refus: null, ...surcharges }
}

describe("POST /api/capteurs/ingestion", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Les charges des fixtures sont datées : l'horloge est figée à côté
    // d'elles, sinon elles deviendraient « de plus de 7 jours » (relecture).
    vi.useFakeTimers({ toFake: ["Date"] })
    vi.setSystemTime(MAINTENANT_FIXTURES)
    viderBudgets()
    viderEmpreintesRefusees()
    mocks.checkRateLimit.mockReturnValue(null)
    mocks.capteurFindUnique.mockResolvedValue(null)
    mocks.capteurCount.mockResolvedValue(0)
    mocks.capteurCreate.mockImplementation(async ({ data }: { data: { modele: string | null } }) => capteurEnBase({ modele: data.modele }))
    mocks.mesuresCreateMany.mockImplementation(async ({ data }: { data: unknown[] }) => ({ count: data.length }))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("refuse sans jeton, sans interroger la base, et compte l'échec par adresse", async () => {
    const r = await POST(requete(UPLINK_TTN_LHT65N, { auth: null }))
    expect(r.status).toBe(401)
    expect(mocks.connecteurFindUnique).not.toHaveBeenCalled()
    expect(mocks.checkRateLimit).toHaveBeenCalledWith("capteurs-echec:203.0.113.7", expect.any(Object))
  })

  it("cherche le connecteur par l'empreinte du jeton, jamais par le jeton en clair", async () => {
    mocks.connecteurFindUnique.mockResolvedValue(null)
    const r = await POST(requete(UPLINK_TTN_LHT65N))
    expect(r.status).toBe(401)
    expect(mocks.connecteurFindUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { jetonHash: hacherJeton(jeton) } }))
  })

  it("un jeton déjà refusé ne coûte plus de lecture en base (webhook resté sur un jeton périmé)", async () => {
    mocks.connecteurFindUnique.mockResolvedValue(null)
    expect((await POST(requete(UPLINK_TTN_LHT65N))).status).toBe(401)
    expect((await POST(requete(UPLINK_TTN_LHT65N))).status).toBe(401)
    expect(mocks.connecteurFindUnique).toHaveBeenCalledTimes(1)
  })

  it("le cache des refus ne touche pas un autre jeton", async () => {
    mocks.connecteurFindUnique.mockResolvedValueOnce(null)
    await POST(requete(UPLINK_TTN_LHT65N))
    mocks.connecteurFindUnique.mockResolvedValue(connecteur("ttn"))
    const autre = genererJeton().jeton
    expect((await POST(requete(UPLINK_TTN_LHT65N, { auth: `Bearer ${autre}` }))).status).toBe(200)
  })

  it("un jeton valide passe même quand l'adresse a épuisé son quota d'échecs (adresses TTN partagées)", async () => {
    mocks.checkRateLimit.mockImplementation((cle: string) =>
      cle.startsWith("capteurs-echec:") ? NextResponse.json({ error: "Trop de requêtes" }, { status: 429 }) : null,
    )
    mocks.connecteurFindUnique.mockResolvedValue(connecteur("ttn"))
    expect((await POST(requete(UPLINK_TTN_LHT65N))).status).toBe(200)
  })

  it("refuse un connecteur désactivé", async () => {
    mocks.connecteurFindUnique.mockResolvedValue(connecteur("ttn", { actif: false }))
    expect((await POST(requete(UPLINK_TTN_LHT65N))).status).toBe(403)
    expect(mocks.capteurCreate).not.toHaveBeenCalled()
  })

  it("enregistre une trame TTN chez le propriétaire du connecteur, profil du modèle appliqué", async () => {
    mocks.connecteurFindUnique.mockResolvedValue(connecteur("ttn"))
    const r = await POST(requete(UPLINK_TTN_LHT65N))
    expect(r.status).toBe(200)

    expect(mocks.capteurFindUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { connecteurId_identifiantExterne: { connecteurId: "conn-1", identifiantExterne: "00000000000c0de1" } } }),
    )
    expect(mocks.capteurCreate).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ userId: "proprio", connecteurId: "conn-1", modele: "dragino/lht65n" }) }),
    )
    const { data, skipDuplicates } = mocks.mesuresCreateMany.mock.calls[0][0]
    expect(skipDuplicates).toBe(true)
    expect(data.map((m: { grandeur: string; valeur: number; unite: string }) => [m.grandeur, m.valeur, m.unite])).toEqual([
      ["tension_batterie", 3.05, "V"],
      ["humidite_air", 71.5, "%"],
      ["temperature_air", 12.84, "°C"],
    ])
    expect(data.every((m: { capteurId: string; mesureeA: Date }) => m.capteurId === "cap-1" && m.mesureeA.toISOString() === "2026-10-23T10:15:02.012Z")).toBe(true)

    const bilan = await r.json()
    expect(bilan).toMatchObject({ trames: 1, mesures: 3, doublons: 0, refusees: 0, inconnues: ["Bat_status", "TempC_DS"] })
    const maj = mocks.capteurUpdate.mock.calls[0][0]
    expect(maj.where).toEqual({ id: "cap-1" })
    expect(maj.data).toMatchObject({
      rssi: -97,
      snr: 6.25,
      avertissement: null,
      clesInconnues: ["Bat_status", "TempC_DS"],
      clesRecues: ["BatV", "Bat_status", "Hum_SHT", "TempC_DS", "TempC_SHT"],
    })
    // Le profil n'est posé qu'à la création : un choix fait à l'écran n'est jamais écrasé.
    expect(maj.data).not.toHaveProperty("modele")
    expect(mocks.connecteurUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: "conn-1" } }))
  })

  it("le même DevEUI envoyé par le connecteur d'un autre compte reste chez cet autre compte", async () => {
    mocks.connecteurFindUnique.mockResolvedValue({ id: "conn-autre", userId: "voisin", type: "ttn", actif: true })
    await POST(requete(UPLINK_TTN_LHT65N))
    expect(mocks.capteurFindUnique.mock.calls[0][0].where.connecteurId_identifiantExterne.connecteurId).toBe("conn-autre")
    expect(mocks.capteurCreate.mock.calls[0][0].data).toMatchObject({ userId: "voisin", connecteurId: "conn-autre" })
  })

  it("un envoi rejoué ne crée pas de doublon et le dit", async () => {
    mocks.connecteurFindUnique.mockResolvedValue(connecteur("ttn"))
    mocks.mesuresCreateMany.mockResolvedValue({ count: 0 })
    const bilan = await (await POST(requete(UPLINK_TTN_LHT65N))).json()
    expect(bilan).toMatchObject({ mesures: 0, doublons: 3 })
  })

  it("accuse un événement sans mesure (202) sans rien écrire", async () => {
    mocks.connecteurFindUnique.mockResolvedValue(connecteur("ttn"))
    const r = await POST(requete(JOIN_TTN))
    expect(r.status).toBe(202)
    expect(mocks.capteurFindUnique).not.toHaveBeenCalled()
  })

  it("un uplink simulé depuis la console TTN fait voir le capteur sans écrire de mesure", async () => {
    mocks.connecteurFindUnique.mockResolvedValue(connecteur("ttn"))
    const bilan = await (await POST(requete({ ...UPLINK_TTN_LHT65N, simulated: true }))).json()
    expect(bilan).toMatchObject({ trames: 1, mesures: 0 })
    expect(mocks.mesuresCreateMany).not.toHaveBeenCalled()
    expect(mocks.capteurUpdate.mock.calls[0][0].data.avertissement).toMatch(/simulé/)
  })

  it("ChirpStack : le libellé du profil d'appareil ne choisit aucun profil, les clés ambiguës attendent", async () => {
    mocks.connecteurFindUnique.mockResolvedValue(connecteur("chirpstack"))
    const bilan = await (await POST(requete(UP_CHIRPSTACK_EM500, { query: "?event=up" }))).json()
    expect(mocks.capteurCreate.mock.calls[0][0].data.modele).toBeNull()
    expect(mocks.mesuresCreateMany).not.toHaveBeenCalled()
    expect(bilan.inconnues).toEqual(["battery", "temperature", "moisture", "conductivity"])
  })

  it("ChirpStack : le profil choisi à l'écran fait lire la sonde de sol comme le sol", async () => {
    mocks.connecteurFindUnique.mockResolvedValue(connecteur("chirpstack"))
    mocks.capteurFindUnique.mockResolvedValue(capteurEnBase({ modele: "milesight-iot/em500-smtc" }))
    await POST(requete(UP_CHIRPSTACK_EM500, { query: "?event=up" }))
    const { data } = mocks.mesuresCreateMany.mock.calls[0][0]
    expect(data.map((m: { grandeur: string }) => m.grandeur)).toEqual(["batterie", "temperature_sol", "humidite_sol", "conductivite_sol"])
    expect(mocks.capteurUpdate.mock.calls[0][0].data.batterie).toBe(98)
  })

  it("répond 422 à un envoi ChirpStack sans DevEUI", async () => {
    mocks.connecteurFindUnique.mockResolvedValue(connecteur("chirpstack"))
    const r = await POST(requete({ ...UP_CHIRPSTACK_EM500, deviceInfo: {} }, { query: "?event=up" }))
    expect(r.status).toBe(422)
  })

  it("arrête un flux sans Content-Length dès le plafond, sans attendre sa fin", async () => {
    mocks.connecteurFindUnique.mockResolvedValue(connecteur("ttn"))
    const annuler = vi.fn()
    let lectures = 0
    const flux = new ReadableStream<Uint8Array>({
      pull(controller) { lectures++; controller.enqueue(new Uint8Array(64 * 1024)) },
      cancel: annuler,
    })
    const init = { method: "POST", headers: { authorization: `Bearer ${jeton}` }, body: flux, duplex: "half" as const }
    const r = await POST(new NextRequest("http://localhost/api/capteurs/ingestion", init))
    expect(r.status).toBe(413)
    expect(annuler).toHaveBeenCalledOnce()
    expect(lectures).toBeLessThan(10)
    expect(mocks.mesuresCreateMany).not.toHaveBeenCalled()
  })

  it("refuse un corps trop volumineux ou illisible", async () => {
    mocks.connecteurFindUnique.mockResolvedValue(connecteur("generique"))
    expect((await POST(requete("x".repeat(300 * 1024)))).status).toBe(413)
    expect((await POST(requete("{pas du json"))).status).toBe(400)
  })

  it("plafonne le nombre de requêtes par connecteur", async () => {
    mocks.connecteurFindUnique.mockResolvedValue(connecteur("generique"))
    mocks.checkRateLimit.mockImplementation((cle: string) =>
      cle === "capteurs:conn-1" ? NextResponse.json({ error: "Trop de requêtes" }, { status: 429 }) : null,
    )
    expect((await POST(requete({ capteur: "serre", mesures: { temperature_air: 20 } }))).status).toBe(429)
  })

  it("compte les TRAMES par connecteur, pas les requêtes : 600 par quart d'heure", async () => {
    mocks.connecteurFindUnique.mockResolvedValue(connecteur("generique"))
    const envoi = (n: number) => ({
      trames: Array.from({ length: 20 }, (_, i) => ({ capteur: `c${i}`, mesureeA: new Date(MAINTENANT_FIXTURES.getTime() - (n * 20 + i) * 1000).toISOString(), mesures: {} })),
    })
    for (let n = 0; n < 30; n++) expect((await POST(requete(envoi(n)))).status).toBe(200)
    const refus = await POST(requete(envoi(30)))
    expect(refus.status).toBe(429)
    expect(refus.headers.get("Retry-After")).toMatch(/^\d+$/)
  })

  it("compte les MESURES par compte, tous connecteurs confondus", async () => {
    const mesures = Object.fromEntries(["temperature_air", "humidite_air", "poids", "temperature_sol", "humidite_sol", "tension_sol", "conductivite_sol", "luminosite", "vent_vitesse", "vent_rafale"].map((g, i) => [g, 10 + i]))
    const envoi = (k: number) => ({
      trames: Array.from({ length: 20 }, (_, i) => ({ capteur: `c${i}`, mesureeA: new Date(MAINTENANT_FIXTURES.getTime() - (k * 20 + i) * 1000).toISOString(), mesures })),
    })
    // 200 mesures par envoi ; 3 000 par compte et par quart d'heure, réparties sur deux connecteurs.
    for (let k = 0; k < 15; k++) {
      mocks.connecteurFindUnique.mockResolvedValueOnce(connecteur("generique", { id: k % 2 ? "conn-a" : "conn-b" }))
      expect((await POST(requete(envoi(k)))).status).toBe(200)
    }
    mocks.connecteurFindUnique.mockResolvedValueOnce(connecteur("generique", { id: "conn-c" }))
    const refus = await POST(requete(envoi(15)))
    expect(refus.status).toBe(429)
    expect(refus.headers.get("Retry-After")).toMatch(/^\d+$/)
  })

  it("les clés inconnues d'un décodeur bavard n'entament pas le budget de mesures", async () => {
    mocks.connecteurFindUnique.mockResolvedValue(connecteur("generique"))
    const bavard = { temperature_air: 12, ...Object.fromEntries(Array.from({ length: 11 }, (_, i) => [`champ_${i}`, i])) }
    const trames = Array.from({ length: 20 }, (_, i) => ({ capteur: `c${i}`, mesureeA: new Date(MAINTENANT_FIXTURES.getTime() - i * 1000).toISOString(), mesures: bavard }))
    expect((await POST(requete({ trames }))).status).toBe(200)
    // 20 mesures écrites, pas 240 clés : il reste exactement le plafond moins 20.
    expect(consommerBudgets([{ cle: "mesures:proprio", quantite: MESURES_MAX_PAR_COMPTE - 20, max: MESURES_MAX_PAR_COMPTE }], FENETRE_BUDGET_MS).ok).toBe(true)
  })

  it("une clé au nom d'une grandeur Gleba n'est pas prise telle quelle d'un décodeur TTN (unité non signée)", async () => {
    mocks.connecteurFindUnique.mockResolvedValue(connecteur("ttn"))
    const charge = { ...UPLINK_TTN_LHT65N, uplink_message: { ...UPLINK_TTN_LHT65N.uplink_message, version_ids: undefined, decoded_payload: { distance: 82 } } }
    const bilan = await (await POST(requete(charge))).json()
    expect(bilan).toMatchObject({ mesures: 0, inconnues: ["distance"] })
  })

  it(`plafonne à ${MAX_CAPTEURS_PAR_CONNECTEUR} capteurs par connecteur`, async () => {
    mocks.connecteurFindUnique.mockResolvedValue(connecteur("generique"))
    mocks.capteurCount.mockResolvedValue(MAX_CAPTEURS_PAR_CONNECTEUR)
    const bilan = await (await POST(requete({ capteur: "nouveau", mesures: { temperature_air: 20 } }))).json()
    expect(mocks.capteurCreate).not.toHaveBeenCalled()
    expect(bilan).toMatchObject({ mesures: 0, refusees: 1 })
    expect(bilan.avertissements[0]).toMatch(/Plafond/)
  })

  it("refuse une mesure datée dans le futur et la montre sur le capteur", async () => {
    mocks.connecteurFindUnique.mockResolvedValue(connecteur("generique"))
    const dansUneHeure = new Date(MAINTENANT_FIXTURES.getTime() + 3600 * 1000).toISOString()
    const bilan = await (await POST(requete({ capteur: "serre", mesureeA: dansUneHeure, mesures: { temperature_air: 20 } }))).json()
    expect(bilan).toMatchObject({ mesures: 0, refusees: 1 })
    expect(mocks.mesuresCreateMany).not.toHaveBeenCalled()
    const refus = mocks.capteurUpdate.mock.calls[0][0].data.refus
    expect(refus[0]).toMatchObject({ cle: "temperature_air", raison: expect.stringMatching(/futur/) })
  })
})
