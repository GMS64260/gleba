/**
 * Ticket cmv28y78w (QA 2026-10-10) — un client (ou fournisseur) créé avec le
 * seul nom était refusé « email: Email invalide » : le formulaire envoie
 * `email: ""` quand le champ reste vide.
 */

import { describe, it, expect } from "vitest"
import { createClientSchema, updateClientSchema } from "../client"
import { createFournisseurSchema } from "../fournisseur"

describe("e-mail facultatif des fiches client et fournisseur", () => {
  it("accepte un client avec le seul nom et un e-mail vide", () => {
    const r = createClientSchema.safeParse({ nom: "QA client", email: "" })
    expect(r.success).toBe(true)
    expect(r.success && r.data.email).toBeNull()
  })

  it("traite un e-mail fait d'espaces comme absent", () => {
    const r = createClientSchema.safeParse({ nom: "QA client", email: "   " })
    expect(r.success && r.data.email).toBeNull()
  })

  it("accepte un e-mail absent ou null", () => {
    expect(createClientSchema.safeParse({ nom: "QA client" }).success).toBe(true)
    expect(createClientSchema.safeParse({ nom: "QA client", email: null }).success).toBe(true)
  })

  it("rogne puis valide une adresse saisie", () => {
    const r = createClientSchema.safeParse({ nom: "QA client", email: "  qa@example.com " })
    expect(r.success && r.data.email).toBe("qa@example.com")
  })

  it("refuse toujours une adresse mal formée", () => {
    const r = createClientSchema.safeParse({ nom: "QA client", email: "pas-une-adresse" })
    expect(r.success).toBe(false)
  })

  it("vider l'e-mail à la modification l'efface", () => {
    const r = updateClientSchema.safeParse({ id: 3, email: "" })
    expect(r.success && r.data.email).toBeNull()
  })

  it("applique la même règle aux fournisseurs", () => {
    const r = createFournisseurSchema.safeParse({ id: "QA fournisseur", email: "" })
    expect(r.success).toBe(true)
    expect(r.success && r.data.email).toBeNull()
  })
})
