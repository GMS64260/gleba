import { afterAll, beforeAll, describe, expect, it, vi } from "vitest"
import { snapshotStatutBio, statutBioCourant } from "./statut-bio"

/**
 * MAR-02 (revue Codex du 2026-11-12) : la progression C1 → C2 → C3 → AB se
 * fait au jour anniversaire du début de conversion, pas au changement de mois.
 * Les seuils restent ceux de ce code (12, 24 et 36 mois) ; seul le jour change.
 */

// Fuseau de la production : dates stockées à minuit de Paris.
beforeAll(() => { vi.stubEnv("TZ", "Europe/Paris") })
afterAll(() => { vi.unstubAllEnvs() })

// Minuit local (Paris), comme les dates saisies dans l'application.
const jour = (iso: string) => {
  const [a, m, j] = iso.split("-").map(Number)
  return new Date(a, m - 1, j)
}

describe("statutBioCourant — anniversaire au jour civil", () => {
  it("conversion du 2023-11-30 : C3 le 2026-11-01, la veille et le jour de l'anniversaire", () => {
    expect(statutBioCourant("C1", jour("2023-11-30"), jour("2026-11-01"))).toBe("C3")
    expect(statutBioCourant("C1", jour("2023-11-30"), jour("2026-11-29"))).toBe("C3")
    expect(statutBioCourant("C1", jour("2023-11-30"), jour("2026-11-30"))).toBe("AB")
  })

  it("reproduit le banc de Codex (dates ISO à minuit UTC) sans qualification prématurée", () => {
    expect(snapshotStatutBio("C1", "2023-11-30T00:00:00Z", new Date("2026-11-01T12:00:00Z"))).toBe("C3")
  })

  it("seuils de 12 et 24 mois au jour près", () => {
    const debut = jour("2023-11-30")
    expect(statutBioCourant("C1", debut, jour("2024-11-01"))).toBe("C1")
    expect(statutBioCourant("C1", debut, jour("2024-11-29"))).toBe("C1")
    expect(statutBioCourant("C1", debut, jour("2024-11-30"))).toBe("C2")
    expect(statutBioCourant("C1", debut, jour("2025-11-01"))).toBe("C2")
    expect(statutBioCourant("C1", debut, jour("2025-11-30"))).toBe("C3")
  })

  it("le jour même du début : C1 ; avant le début : statut nominal", () => {
    expect(statutBioCourant("C2", jour("2023-11-30"), jour("2023-11-30"))).toBe("C1")
    expect(statutBioCourant("C2", jour("2023-11-30"), jour("2023-11-29"))).toBe("C2")
  })

  it("le jour du début compte en entier, quelle que soit l'heure de la récolte", () => {
    // Début saisi à 18 h, récolte du même jour à 8 h : déjà en C1.
    expect(statutBioCourant("C3", new Date(2023, 10, 30, 18), new Date(2023, 10, 30, 8))).toBe("C1")
  })

  it("29 février : l'anniversaire d'une année non bissextile tombe le 1er mars, jamais avant", () => {
    const debut = jour("2024-02-29")
    expect(statutBioCourant("C1", debut, jour("2025-02-28"))).toBe("C1")
    expect(statutBioCourant("C1", debut, jour("2025-03-01"))).toBe("C2")
    expect(statutBioCourant("C1", debut, jour("2027-02-28"))).toBe("C3")
    expect(statutBioCourant("C1", debut, jour("2027-03-01"))).toBe("AB")
  })

  it("fin de mois : un début au 31 garde son jour aux anniversaires annuels", () => {
    const debut = jour("2023-12-31")
    expect(statutBioCourant("C1", debut, jour("2026-12-30"))).toBe("C3")
    expect(statutBioCourant("C1", debut, jour("2026-12-31"))).toBe("AB")
  })

  it("AB et Conventionnel ne progressent pas ; sans date, le nominal reste", () => {
    expect(statutBioCourant("AB", jour("2026-01-01"), jour("2026-02-01"))).toBe("AB")
    expect(statutBioCourant("Conventionnel", jour("2020-01-01"), jour("2026-02-01"))).toBe("Conventionnel")
    expect(statutBioCourant("C2", null, jour("2026-02-01"))).toBe("C2")
    expect(statutBioCourant(null, null)).toBe("Conventionnel")
    expect(statutBioCourant("C1", "pas une date", jour("2026-02-01"))).toBe("C1")
  })
})
