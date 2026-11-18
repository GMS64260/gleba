import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }))
vi.mock("@/lib/prisma", () => ({ default: { user: { findMany: mocks.findMany } } }))

import { lireEtatCompte, lireEtatSession } from "./compte-actif"

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

  it("un mot de passe posé depuis l’émission du jeton coupe la session (MC3)", async () => {
    mocks.findMany.mockResolvedValue([{ id: "u1", active: true, role: "USER", sessionVersion: 2 }])
    expect(await lireEtatCompte("u1", null, 2)).toEqual({ actif: true, role: "USER" })
    expect(await lireEtatCompte("u1", null, 1)).toEqual({ actif: false, motif: "session_revoquee" })
    // Jeton émis avant le déploiement : sans version, il vaut 0.
    expect(await lireEtatCompte("u1")).toEqual({ actif: false, motif: "session_revoquee" })
    mocks.findMany.mockResolvedValue([{ id: "u1", active: true, role: "USER", sessionVersion: 0 }])
    expect(await lireEtatCompte("u1")).toEqual({ actif: true, role: "USER" })
    expect(mocks.findMany.mock.calls[0][0].select).toMatchObject({ sessionVersion: true })
  })

  it("une consultation administrateur suit la version du compte consulté ET celle de l’administrateur (MC3)", async () => {
    mocks.findMany.mockResolvedValue([
      { id: "u1", active: true, role: "USER", sessionVersion: 1 },
      { id: "a1", active: true, role: "ADMIN", sessionVersion: 5 },
    ])
    expect(await lireEtatCompte("u1", "a1", 0, 5)).toEqual({ actif: false, motif: "session_revoquee" })
    expect(await lireEtatCompte("u1", "a1", 1, 5)).toEqual({ actif: true, role: "USER" })
    // Mot de passe de l’administrateur posé depuis l’ouverture de la consultation.
    expect(await lireEtatCompte("u1", "a1", 1, 4)).toEqual({ actif: false, motif: "session_revoquee" })
    // Consultation ouverte avant le déploiement : sans version d’administrateur, elle vaut 0.
    expect(await lireEtatCompte("u1", "a1", 1)).toEqual({ actif: false, motif: "session_revoquee" })
  })

  it("lireEtatSession passe toutes les informations du jeton", async () => {
    mocks.findMany.mockResolvedValue([
      { id: "u1", active: true, role: "USER", sessionVersion: 1 },
      { id: "a1", active: true, role: "ADMIN", sessionVersion: 5 },
    ])
    expect(await lireEtatSession({ id: "u1", impersonatedBy: "a1", sessionVersion: 1, adminSessionVersion: 5 })).toEqual({ actif: true, role: "USER" })
    expect(await lireEtatSession({ id: "u1", impersonatedBy: "a1", sessionVersion: 1, adminSessionVersion: 0 })).toEqual({ actif: false, motif: "session_revoquee" })
    mocks.findMany.mockResolvedValue([{ id: "u1", active: true, role: "USER", sessionVersion: 1 }])
    expect(await lireEtatSession({ id: "u1", sessionVersion: 1 })).toEqual({ actif: true, role: "USER" })
    expect(mocks.findMany.mock.calls.at(-1)![0].where).toEqual({ id: { in: ["u1"] } })
  })

  it("une panne de lecture n’accorde rien", async () => {
    mocks.findMany.mockImplementation(() => Promise.reject(new Error("base injoignable")))
    const issue = await lireEtatCompte("u1").then(() => "accordé", (e: Error) => e.message)
    expect(issue).toBe("base injoignable")
  })
})
