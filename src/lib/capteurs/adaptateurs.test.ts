import { describe, expect, it } from "vitest"
import { adapterChirpstack, adapterGenerique, adapterTtn, MAX_TRAMES_GENERIQUES } from "./adaptateurs"
import { JOIN_TTN, MAINTENANT_FIXTURES as MAINTENANT, STATUS_CHIRPSTACK, UPLINK_TTN_LHT65N, UP_CHIRPSTACK_EM500 } from "./__fixtures__/charges"

describe("adapterTtn", () => {
  it("lit DevEUI normalisé, modèle, valeurs décodées, meilleure réception et heure du réseau", () => {
    const r = adapterTtn(UPLINK_TTN_LHT65N, MAINTENANT)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.trames).toHaveLength(1)
    const t = r.trames[0]
    expect(t.identifiantExterne).toBe("00000000000c0de1")
    expect(t.modele).toBe("dragino/lht65n")
    expect(t.mesureeA.toISOString()).toBe("2026-10-23T10:15:02.012Z")
    expect(t.rssi).toBe(-97)
    expect(t.snr).toBe(6.25)
    expect(t.valeurs).toEqual([
      ["BatV", 3.05],
      ["Bat_status", 3],
      ["Hum_SHT", 71.5],
      ["TempC_DS", 327.67],
      ["TempC_SHT", 12.84],
    ])
    expect(t.avertissement).toBeNull()
  })

  it("accuse un événement sans uplink sans rien produire", () => {
    const r = adapterTtn(JOIN_TTN, MAINTENANT)
    expect(r).toMatchObject({ ok: true, trames: [] })
    if (r.ok) expect(r.ignore).toMatch(/Uplink/)
  })

  it("signale une trame non décodée, sans la perdre (le capteur reste vu)", () => {
    const uplink: Record<string, unknown> = { ...UPLINK_TTN_LHT65N.uplink_message }
    delete uplink.decoded_payload
    const r = adapterTtn({ ...UPLINK_TTN_LHT65N, uplink_message: uplink }, MAINTENANT)
    expect(r.ok && r.trames[0].valeurs).toEqual([])
    expect(r.ok && r.trames[0].avertissement).toMatch(/Payload formatter/)
  })

  it("signale une charge décodée sans aucune valeur numérique (tableaux SenseCAP…)", () => {
    const r = adapterTtn(
      { ...UPLINK_TTN_LHT65N, uplink_message: { ...UPLINK_TTN_LHT65N.uplink_message, decoded_payload: { messages: [{ measurementValue: 21 }] } } },
      MAINTENANT,
    )
    expect(r.ok && r.trames[0].avertissement).toMatch(/profil de décodage/)
  })

  it("appareil ABP sans DevEUI : identifié par application et appareil TTN (immuables)", () => {
    const r = adapterTtn(
      { ...UPLINK_TTN_LHT65N, end_device_ids: { device_id: "sonde-serre", application_ids: { application_id: "ferme-essai" } } },
      MAINTENANT,
    )
    expect(r.ok && r.trames[0].identifiantExterne).toBe("ttn:ferme-essai/sonde-serre")
  })

  it("refuse un envoi sans aucun identifiant exploitable", () => {
    const r = adapterTtn({ ...UPLINK_TTN_LHT65N, end_device_ids: { device_id: "x" } }, MAINTENANT)
    expect(r.ok).toBe(false)
  })

  it("un uplink simulé ne porte aucune valeur, mais un avertissement", () => {
    const r = adapterTtn({ ...UPLINK_TTN_LHT65N, simulated: true }, MAINTENANT)
    expect(r.ok && r.trames[0]).toMatchObject({ identifiantExterne: "00000000000c0de1", valeurs: [], avertissement: expect.stringMatching(/simulé/) })
  })

  it("une date réseau sans fuseau n'est pas lue à l'heure du serveur : instant de réception", () => {
    const r = adapterTtn(
      { ...UPLINK_TTN_LHT65N, received_at: "2026-10-23T10:00:00", uplink_message: { ...UPLINK_TTN_LHT65N.uplink_message, received_at: "2026-10-23T10:00:00" } },
      MAINTENANT,
    )
    expect(r.ok && r.trames[0].mesureeA).toEqual(MAINTENANT)
  })
})

describe("adapterChirpstack", () => {
  it("lit l'événement up : DevEUI, objet décodé, heure ; le libellé du profil ne fait pas un modèle", () => {
    const r = adapterChirpstack(UP_CHIRPSTACK_EM500, "up", MAINTENANT)
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const t = r.trames[0]
    expect(t.identifiantExterne).toBe("00000000000050a1")
    expect(t.modele).toBeNull()
    expect(t.mesureeA.toISOString()).toBe("2026-10-23T10:20:00.000Z")
    expect(t.rssi).toBe(-88)
    expect(t.valeurs).toEqual([
      ["battery", 98],
      ["temperature", 14.2],
      ["moisture", 31.5],
      ["conductivity", 412],
    ])
  })

  it("lit la batterie d'un événement status", () => {
    const r = adapterChirpstack(STATUS_CHIRPSTACK, "status", MAINTENANT)
    expect(r.ok && r.trames[0]).toMatchObject({ identifiantExterne: "00000000000050a1", batterie: 87.5, valeurs: [] })
  })

  it("ne lit pas de batterie sur secteur ou indisponible", () => {
    const r = adapterChirpstack({ ...STATUS_CHIRPSTACK, externalPowerSource: true }, "status", MAINTENANT)
    expect(r.ok && r.trames[0].batterie).toBeNull()
  })

  it("ignore une batterie hors de 0 à 100 % (255 : mesure impossible en LoRaWAN), sans refuser la trame", () => {
    for (const batteryLevel of [255, -1, 100.5]) {
      const r = adapterChirpstack({ ...STATUS_CHIRPSTACK, batteryLevel }, "status", MAINTENANT)
      expect(r.ok && r.trames[0]).toMatchObject({ identifiantExterne: "00000000000050a1", batterie: null })
    }
    const r = adapterChirpstack({ ...STATUS_CHIRPSTACK, batteryLevel: 100 }, "status", MAINTENANT)
    expect(r.ok && r.trames[0].batterie).toBe(100)
  })

  it("ignore un RSSI ou un SNR hors bornes : une passerelle aberrante ne devient pas la meilleure", () => {
    const rxInfo = [
      { gatewayId: "0016c001ff10abcd", rssi: 9999, snr: 9 },
      { gatewayId: "0016c001ff10abce", rssi: -104, snr: 500 },
      { gatewayId: "0016c001ff10abcf", rssi: -250, snr: 2 },
    ]
    const r = adapterChirpstack({ ...UP_CHIRPSTACK_EM500, rxInfo }, "up", MAINTENANT)
    expect(r.ok && r.trames[0]).toMatchObject({ rssi: -104, snr: null })
  })

  it("ignore les autres événements (join, ack, log…)", () => {
    const r = adapterChirpstack(UP_CHIRPSTACK_EM500, "join", MAINTENANT)
    expect(r).toMatchObject({ ok: true, trames: [] })
  })
})

describe("adapterGenerique", () => {
  it("lit une trame unique, datée à la réception par défaut", () => {
    const r = adapterGenerique({ capteur: "serre-nord", mesures: { temperature_air: 18.4, humidite_air: 71 } }, MAINTENANT)
    expect(r.ok && r.trames).toEqual([
      expect.objectContaining({
        identifiantExterne: "serre-nord",
        mesureeA: MAINTENANT,
        valeurs: [["temperature_air", 18.4], ["humidite_air", 71]],
      }),
    ])
  })

  it("lit plusieurs trames, date, batterie et position", () => {
    const r = adapterGenerique(
      {
        trames: [
          { capteur: "cuve", mesures: { distance: 820 }, mesureeA: "2026-10-23T08:00:00Z", batterie: 64 },
          { capteur: "collier-12", mesures: {}, lat: 43.1, lng: -0.4 },
        ],
      },
      MAINTENANT,
    )
    expect(r.ok).toBe(true)
    if (!r.ok) return
    expect(r.trames[0]).toMatchObject({ identifiantExterne: "cuve", batterie: 64 })
    expect(r.trames[0].mesureeA.toISOString()).toBe("2026-10-23T08:00:00.000Z")
    expect(r.trames[1].position).toEqual({ lat: 43.1, lng: -0.4 })
  })

  it("refuse un identifiant invalide, une date illisible ou un corps hors format", () => {
    expect(adapterGenerique({ capteur: "serre nord", mesures: {} }, MAINTENANT).ok).toBe(false)
    expect(adapterGenerique({ capteur: "serre", mesureeA: "hier" }, MAINTENANT).ok).toBe(false)
    expect(adapterGenerique({ mesures: { a: 1 } }, MAINTENANT).ok).toBe(false)
    expect(adapterGenerique({ trames: [] }, MAINTENANT).ok).toBe(false)
  })

  it("exige une date AVEC fuseau : une heure locale nue serait lue à l'heure du serveur", () => {
    for (const mesureeA of ["2026-10-23T10:00:00", "1", "10/23/2026", "2026-10-23", "2026-02-30T10:00:00Z", "2026-10-23T24:00:00Z"]) {
      expect(adapterGenerique({ capteur: "serre", mesureeA, mesures: {} }, MAINTENANT).ok).toBe(false)
    }
    const r = adapterGenerique({ capteur: "serre", mesureeA: "2026-10-23T21:00:00+11:00", mesures: {} }, MAINTENANT)
    expect(r.ok && r.trames[0].mesureeA.toISOString()).toBe("2026-10-23T10:00:00.000Z")
  })

  it("refuse deux trames non datées du même capteur dans un envoi (la seconde serait perdue)", () => {
    const r = adapterGenerique({ trames: [{ capteur: "serre", mesures: { temperature_air: 1 } }, { capteur: "serre", mesures: { temperature_air: 2 } }] }, MAINTENANT)
    expect(r.ok).toBe(false)
  })

  it(`plafonne à ${MAX_TRAMES_GENERIQUES} trames et n'accepte comme modèle qu'un profil Gleba`, () => {
    const trames = Array.from({ length: MAX_TRAMES_GENERIQUES + 1 }, (_, i) => ({ capteur: `c${i}`, mesures: {} }))
    expect(adapterGenerique({ trames }, MAINTENANT).ok).toBe(false)
    expect(adapterGenerique({ capteur: "sonde", modele: "ma sonde préférée", mesures: {} }, MAINTENANT).ok).toBe(false)
    expect(adapterGenerique({ capteur: "sonde", modele: "dragino/lse01", mesures: {} }, MAINTENANT).ok).toBe(true)
  })
})
