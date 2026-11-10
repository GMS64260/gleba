import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ default: { user: { findMany: mocks.findMany } } }))

import { lireEtatCompte } from "./compte-actif"

describe("état du compte relu en base", () => {
  beforeEach(() => { mocks.findMany.mockReset() })

  it("rend le rôle de la base pour un compte actif", async () => {
    mocks.findMany.mockResolvedValue([{ id: "u1", active: true, role: "USER" }])
    expect(await lireEtatCompte("u1")).toEqual({ actif: true, role: "USER" })
    expect(mocks.findMany.mock.calls[0][0].where).toEqual({ id: { in: ["u1"] } })
  })

  it("refuse un compte désactivé, supprimé ou sans identifiant", async () => {
    mocks.findMany.mockResolvedValue([{ id: "u1", active: false, role: "ADMIN" }])
    expect(await lireEtatCompte("u1")).toEqual({ actif: false })
    mocks.findMany.mockResolvedValue([])
    expect(await lireEtatCompte("u1")).toEqual({ actif: false })
    expect(await lireEtatCompte("")).toEqual({ actif: false })
  })

  it("une consultation tombe dès que l’administrateur est rétrogradé, désactivé ou supprimé", async () => {
    const cible = { id: "u1", active: true, role: "USER" }
    mocks.findMany.mockResolvedValue([cible, { id: "a1", active: true, role: "ADMIN" }])
    expect(await lireEtatCompte("u1", "a1")).toEqual({ actif: true, role: "USER" })
    mocks.findMany.mockResolvedValue([cible, { id: "a1", active: true, role: "USER" }])
    expect(await lireEtatCompte("u1", "a1")).toEqual({ actif: false })
    mocks.findMany.mockResolvedValue([cible, { id: "a1", active: false, role: "ADMIN" }])
    expect(await lireEtatCompte("u1", "a1")).toEqual({ actif: false })
    mocks.findMany.mockResolvedValue([cible])
    expect(await lireEtatCompte("u1", "a1")).toEqual({ actif: false })
  })

  it("une panne de lecture n’accorde rien", async () => {
    mocks.findMany.mockImplementation(() => Promise.reject(new Error("base injoignable")))
    const issue = await lireEtatCompte("u1").then(() => "accordé", (e: Error) => e.message)
    expect(issue).toBe("base injoignable")
  })
})
