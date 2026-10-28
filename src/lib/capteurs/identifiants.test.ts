import { describe, expect, it } from "vitest"
import { normaliserDevEui, normaliserIdentifiantGenerique, normaliserNoeudMeshtastic } from "./identifiants"

describe("normaliserDevEui", () => {
  it("rend un même DevEUI quelle que soit l'écriture du serveur", () => {
    expect(normaliserDevEui("A84041000181C0DE")).toBe("a84041000181c0de")
    expect(normaliserDevEui("a8-40-41-00-01-81-c0-de")).toBe("a84041000181c0de")
    expect(normaliserDevEui("A8:40:41:00:01:81:C0:DE")).toBe("a84041000181c0de")
  })

  it("refuse ce qui n'est pas un EUI-64", () => {
    expect(normaliserDevEui("a84041000181c0d")).toBeNull()
    expect(normaliserDevEui("a84041000181c0dez")).toBeNull()
    expect(normaliserDevEui(1234)).toBeNull()
    expect(normaliserDevEui(undefined)).toBeNull()
  })
})

describe("normaliserNoeudMeshtastic", () => {
  it("donne le même nœud avec ou sans zéros de tête (!2ead82c = !02ead82c)", () => {
    expect(normaliserNoeudMeshtastic("!2ead82c")).toBe("!02ead82c")
    expect(normaliserNoeudMeshtastic("!02EAD82C")).toBe("!02ead82c")
  })

  it("accepte le numéro de nœud décimal des paquets", () => {
    expect(normaliserNoeudMeshtastic(0x02ead82c)).toBe("!02ead82c")
    expect(normaliserNoeudMeshtastic(String(0x02ead82c))).toBe("!02ead82c")
  })

  it("refuse un identifiant hors de 32 bits ou mal formé", () => {
    expect(normaliserNoeudMeshtastic(0x1_0000_0000)).toBeNull()
    expect(normaliserNoeudMeshtastic("!xyz")).toBeNull()
    expect(normaliserNoeudMeshtastic("!123456789")).toBeNull()
    expect(normaliserNoeudMeshtastic(-1)).toBeNull()
  })
})

describe("normaliserIdentifiantGenerique", () => {
  it("garde l'identifiant tel quel, sans les espaces de bord", () => {
    expect(normaliserIdentifiantGenerique("  serre-nord ")).toBe("serre-nord")
    expect(normaliserIdentifiantGenerique("sensor.cuve_1")).toBe("sensor.cuve_1")
  })

  it("refuse les espaces internes, le vide et les identifiants trop longs", () => {
    expect(normaliserIdentifiantGenerique("serre nord")).toBeNull()
    expect(normaliserIdentifiantGenerique("")).toBeNull()
    expect(normaliserIdentifiantGenerique("x".repeat(101))).toBeNull()
    expect(normaliserIdentifiantGenerique("ttn:" + "a".repeat(36) + "/" + "b".repeat(36))).not.toBeNull()
  })
})
