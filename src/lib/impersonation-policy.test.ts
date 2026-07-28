import { describe, expect, it } from "vitest"
import {
  estSurfaceAdministration,
  motifInterdictionConsultation,
} from "./impersonation-policy"

describe("politique de consultation admin", () => {
  it("bloque les pages et API d'administration", () => {
    expect(estSurfaceAdministration("/admin/users")).toBe(true)
    expect(estSurfaceAdministration("/api/admin/users")).toBe(true)
    expect(motifInterdictionConsultation("/api/admin/metrics", "GET"))
      .toBe("ADMINISTRATION")
  })

  it("bloque les mutations même sur une API publique", () => {
    expect(motifInterdictionConsultation("/api/cookie-consent", "POST"))
      .toBe("MUTATION")
    expect(motifInterdictionConsultation("/api/boutique/public/ferme/commande", "POST"))
      .toBe("MUTATION")
  })

  it("autorise uniquement la mutation nécessaire pour quitter la consultation", () => {
    expect(motifInterdictionConsultation("/api/auth/signout", "POST")).toBeNull()
    expect(motifInterdictionConsultation("/api/auth/callback/credentials", "POST"))
      .toBe("MUTATION")
  })

  it("bloque les GET et HEAD connus pour écrire", () => {
    for (const pathname of [
      "/api/auth/verify",
      "/api/calendrier",
      "/api/taches",
      "/api/cultures/irriguer",
      "/api/elevage/inventaire-cheptel",
      "/api/elevage/declarations-reglementaires/export",
      "/api/elevage/declarations-reglementaires/document-circulation",
      "/api/elevage/registre-elevage",
      "/api/elevage/registre-elevage-complet",
      "/api/elevage/registres-archives/archive-1",
      "/api/elevage/registre-sanitaire",
    ]) {
      expect(motifInterdictionConsultation(pathname, "GET"))
        .toBe("GET_AVEC_EFFET_DE_BORD")
      expect(motifInterdictionConsultation(pathname, "HEAD"))
        .toBe("GET_AVEC_EFFET_DE_BORD")
    }
  })

  it("laisse passer une lecture métier pure et les prévols", () => {
    expect(motifInterdictionConsultation("/api/elevage/animaux", "GET")).toBeNull()
    expect(motifInterdictionConsultation("/api/cookie-consent", "OPTIONS")).toBeNull()
  })
})
