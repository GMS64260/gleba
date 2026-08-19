import { describe, it, expect, afterEach } from "vitest"

import {
  googleAuthDisponible,
  motifRefusConnexionGoogle,
} from "@/lib/auth-google"

describe("googleAuthDisponible", () => {
  const idInitial = process.env.AUTH_GOOGLE_ID
  const secretInitial = process.env.AUTH_GOOGLE_SECRET

  afterEach(() => {
    if (idInitial === undefined) delete process.env.AUTH_GOOGLE_ID
    else process.env.AUTH_GOOGLE_ID = idInitial
    if (secretInitial === undefined) delete process.env.AUTH_GOOGLE_SECRET
    else process.env.AUTH_GOOGLE_SECRET = secretInitial
  })

  it("est inactif sans configuration", () => {
    delete process.env.AUTH_GOOGLE_ID
    delete process.env.AUTH_GOOGLE_SECRET
    expect(googleAuthDisponible()).toBe(false)
  })

  it("est inactif si une seule des deux variables est renseignée", () => {
    process.env.AUTH_GOOGLE_ID = "client-id"
    delete process.env.AUTH_GOOGLE_SECRET
    expect(googleAuthDisponible()).toBe(false)
  })

  it("est actif quand id et secret sont renseignés", () => {
    process.env.AUTH_GOOGLE_ID = "client-id"
    process.env.AUTH_GOOGLE_SECRET = "client-secret"
    expect(googleAuthDisponible()).toBe(true)
  })
})

describe("motifRefusConnexionGoogle", () => {
  it("refuse un profil sans email", () => {
    expect(motifRefusConnexionGoogle({ email_verified: true }, null)).toBe(
      "email_manquant"
    )
    expect(motifRefusConnexionGoogle(undefined, null)).toBe("email_manquant")
  })

  it("refuse une adresse non vérifiée par Google — le rattachement automatique au compte existant n'est sûr qu'avec une adresse prouvée", () => {
    expect(
      motifRefusConnexionGoogle({ email: "a@b.fr", email_verified: false }, null)
    ).toBe("email_non_verifie")
    // email_verified absent = non prouvé : même refus.
    expect(motifRefusConnexionGoogle({ email: "a@b.fr" }, null)).toBe(
      "email_non_verifie"
    )
  })

  it("refuse un compte Gleba désactivé, même avec une identité Google valide", () => {
    expect(
      motifRefusConnexionGoogle(
        { email: "a@b.fr", email_verified: true },
        { active: false }
      )
    ).toBe("compte_inactif")
  })

  it("accepte une première connexion (aucun compte existant)", () => {
    expect(
      motifRefusConnexionGoogle({ email: "a@b.fr", email_verified: true }, null)
    ).toBeNull()
  })

  it("accepte le rattachement à un compte existant actif", () => {
    expect(
      motifRefusConnexionGoogle(
        { email: "a@b.fr", email_verified: true },
        { active: true }
      )
    ).toBeNull()
  })
})
