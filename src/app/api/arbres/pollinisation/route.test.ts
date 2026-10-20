import { beforeEach, describe, expect, it, vi } from "vitest"

/**
 * QA cmvgee5s9 (2026-10-20) — Verger > Santé & Phyto > Pollinisation : un
 * prunier fleurissant en S23-S25 associé à un pollinisateur en S14-S16 était
 * enregistré « Partielle ». La route applique la règle de la matrice
 * (`compatibiliteFloraison`) et refuse un pollinisateur sans floraison commune.
 * Les corps envoyés sont ceux du dialogue « Nouvelle association » (formData).
 */

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  arbreFindMany: vi.fn(),
  varieteFindMany: vi.fn(),
  associationCreate: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    arbre: { findMany: mocks.arbreFindMany },
    variete: { findMany: mocks.varieteFindMany },
    pollinisationArbre: { create: mocks.associationCreate },
  },
}))

import { POST } from "./route"

const post = (body: unknown) =>
  POST(
    new Request("http://localhost/api/arbres/pollinisation", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }) as never,
  )

const arbre = (id: number, variete: string) => ({
  id,
  nom: `v8 prunier ${id}`,
  espece: "Prunier",
  especeId: "Prunier",
  variete,
  groupePollinisation: null,
  userId: "user-1",
})

const variete = (id: string, semaineFloraison: number | null, dureeFloraison: number | null) => ({
  id,
  nom: id,
  nomNormalise: id.toLowerCase(),
  especeId: "Prunier",
  userId: "user-1",
  ploidie: null,
  groupePollinisation: null,
  semaineFloraison,
  dureeFloraison,
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.requireAuthApi.mockResolvedValue({ error: null, session: { user: { id: "user-1" } } })
  mocks.arbreFindMany.mockResolvedValue([arbre(836, "var-b"), arbre(835, "var-a")])
  mocks.associationCreate.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({ id: 1, ...data }))
})

describe("POST /api/arbres/pollinisation — floraisons", () => {
  it("scénario du ticket : S23-S25 pollinisé par S14-S16, aucune semaine commune → 422 explicite, rien n'est enregistré", async () => {
    mocks.varieteFindMany.mockResolvedValue([variete("var-a", 14, 3), variete("var-b", 23, 3)])
    const res = await post({ arbrePolliniseId: "836", arbrePollinisateurId: "835", compatibilite: "partielle", notes: "" })
    expect(res.status).toBe(422)
    const { error } = await res.json()
    expect(error).toContain("Pollinisateur incompatible")
    expect(error).toContain("sans semaine commune")
    expect(mocks.associationCreate).not.toHaveBeenCalled()
  })

  it("floraisons qui se recouvrent : l'association est enregistrée au niveau choisi", async () => {
    mocks.varieteFindMany.mockResolvedValue([variete("var-a", 14, 3), variete("var-b", 14, 3)])
    const res = await post({ arbrePolliniseId: "836", arbrePollinisateurId: "835", compatibilite: "excellente", notes: "" })
    expect(res.status).toBe(201)
    expect(mocks.associationCreate.mock.calls[0][0].data.compatibilite).toBe("excellente")
  })

  it("floraison inconnue d'un côté : présumée, enregistrée", async () => {
    mocks.varieteFindMany.mockResolvedValue([variete("var-a", 14, 3), variete("var-b", null, null)])
    const res = await post({ arbrePolliniseId: "836", arbrePollinisateurId: "835", compatibilite: "partielle", notes: "" })
    expect(res.status).toBe(201)
  })

  it("groupes hors de l'échelle A-E (« précoce » / « mi-saison »), sans période : rien n'est vérifié, association enregistrée", async () => {
    mocks.arbreFindMany.mockResolvedValue([
      { ...arbre(836, "var-b"), groupePollinisation: "mi-saison" },
      { ...arbre(835, "var-a"), groupePollinisation: "précoce" },
    ])
    mocks.varieteFindMany.mockResolvedValue([variete("var-a", null, null), variete("var-b", null, null)])
    const res = await post({ arbrePolliniseId: "836", arbrePollinisateurId: "835", compatibilite: "partielle", notes: "" })
    expect(res.status).toBe(201)
  })

  it("groupes A et D de l'échelle, sans période : incompatibilité vérifiée, 422", async () => {
    mocks.arbreFindMany.mockResolvedValue([
      { ...arbre(836, "var-b"), groupePollinisation: "D" },
      { ...arbre(835, "var-a"), groupePollinisation: "A" },
    ])
    mocks.varieteFindMany.mockResolvedValue([variete("var-a", null, null), variete("var-b", null, null)])
    const res = await post({ arbrePolliniseId: "836", arbrePollinisateurId: "835", compatibilite: "partielle", notes: "" })
    expect(res.status).toBe(422)
    expect((await res.json()).error).toContain("trop écartés")
  })

  it("« incompatible » n'est pas un niveau enregistrable : refus qui nomme le champ", async () => {
    mocks.varieteFindMany.mockResolvedValue([variete("var-a", 14, 3), variete("var-b", 14, 3)])
    const res = await post({ arbrePolliniseId: "836", arbrePollinisateurId: "835", compatibilite: "incompatible", notes: "" })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toContain("compatibilite")
    expect(mocks.associationCreate).not.toHaveBeenCalled()
  })
})
