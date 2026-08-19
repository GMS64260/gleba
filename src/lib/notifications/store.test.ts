import { beforeEach, describe, expect, it } from "vitest"
import {
  alerteDejaEnvoyee,
  marquerAlerteEnvoyee,
  nettoyerAlertesEnvoyees,
  nombreAlertesMemorisees,
  resetStorePourTests,
} from "./store"

function hierIso(): string {
  const hier = new Date()
  hier.setDate(hier.getDate() - 1)
  const m = String(hier.getMonth() + 1).padStart(2, "0")
  const d = String(hier.getDate()).padStart(2, "0")
  return `${hier.getFullYear()}-${m}-${d}`
}

function demainIso(): string {
  const demain = new Date()
  demain.setDate(demain.getDate() + 1)
  const m = String(demain.getMonth() + 1).padStart(2, "0")
  const d = String(demain.getDate()).padStart(2, "0")
  return `${demain.getFullYear()}-${m}-${d}`
}

describe("store anti-redondance", () => {
  beforeEach(() => {
    resetStorePourTests()
  })

  it("une alerte non envoyée n'est pas mémorisée", () => {
    expect(alerteDejaEnvoyee("gel:2026-08-10")).toBe(false)
    expect(nombreAlertesMemorisees()).toBe(0)
  })

  it("bloque une seconde notification de la même alerte active", () => {
    const demain = demainIso()
    marquerAlerteEnvoyee(`u1:gel:${demain}`, { until: demain })
    expect(alerteDejaEnvoyee(`u1:gel:${demain}`)).toBe(true)
  })

  it("l'anti-redondance est scellée par utilisateur", () => {
    const demain = demainIso()
    marquerAlerteEnvoyee(`u1:gel:${demain}`, { until: demain })
    // L'utilisateur 2 dans la même région doit bien être notifié
    expect(alerteDejaEnvoyee(`u2:gel:${demain}`)).toBe(false)
  })

  it("libère l'alerte une fois sa date passée (re-notification possible)", () => {
    const hier = hierIso()
    marquerAlerteEnvoyee(`u1:gel:${hier}`, { until: hier })
    expect(alerteDejaEnvoyee(`u1:gel:${hier}`)).toBe(false)
  })

  it("les entrées expirées sont purgées par nettoyerAlertesEnvoyees", () => {
    const hier = hierIso()
    marquerAlerteEnvoyee(`u1:gel:${hier}`, { until: hier })
    marquerAlerteEnvoyee("u1:canicule:2099-01-01")
    expect(nombreAlertesMemorisees()).toBe(2)
    nettoyerAlertesEnvoyees()
    expect(nombreAlertesMemorisees()).toBe(1)
  })

  it("une alerte sans date de validité reste mémorisée", () => {
    marquerAlerteEnvoyee("u1:tache-retard:semis:123")
    expect(alerteDejaEnvoyee("u1:tache-retard:semis:123")).toBe(true)
  })
})
