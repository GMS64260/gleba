/**
 * `getOrFetch` — recul après échec et coalescence des appels d'origine.
 *
 * Régression couverte (2026-09-09) : 293 échecs Open-Meteo en cinq jours, en
 * hausse continue (5 le 05/09 puis 43, 92, 103, 73) et un `429` sur l'endpoint
 * archive. Le TTL de 30 min bornait déjà le volume nominal ; ce qui manquait
 * était le RECUL — `expiresAt` n'étant pas repoussé en cas d'échec (à raison,
 * la grâce de 24 h se calcule dessus), la clé restait périmée et chaque requête
 * suivante rappelait une origine connue en panne.
 *
 * Ces tests fixent les quatre propriétés qui comptent : on ne rappelle pas une
 * origine en recul, deux appels concurrents n'en font qu'un, la grâce de 24 h
 * garde sa borne, et une origine rétablie est bien rappelée après le recul.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
  deleteMany: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  default: {
    genericCache: {
      findUnique: mocks.findUnique,
      upsert: mocks.upsert,
      deleteMany: mocks.deleteMany,
    },
  },
}))

import { __resetEtatsMemoire, getOrFetch, purgeExpired } from "../cache-helper"

const TTL = 30 * 60_000
const HEURE = 60 * 60_000

/** Laisse les microtâches en attente (findUnique mocké) se dérouler. */
function flushMicrotaches(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0))
}

/** Ligne de cache périmée depuis `perimeDepuisMs`. */
function lignePerimee(perimeDepuisMs: number, data: unknown = { valeur: "périmée" }) {
  return { key: "k", data, expiresAt: new Date(Date.now() - perimeDepuisMs) }
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.useRealTimers()
  __resetEtatsMemoire()
  mocks.upsert.mockResolvedValue({})
  mocks.deleteMany.mockResolvedValue({ count: 0 })
})

describe("getOrFetch — cache frais", () => {
  it("ne touche pas à l'origine quand la valeur n'est pas périmée", async () => {
    mocks.findUnique.mockResolvedValue({
      key: "k",
      data: { valeur: "fraîche" },
      expiresAt: new Date(Date.now() + TTL),
    })
    const origine = vi.fn()

    await expect(getOrFetch("k", origine, TTL)).resolves.toEqual({ valeur: "fraîche" })
    expect(origine).not.toHaveBeenCalled()
  })
})

describe("getOrFetch — recul après échec", () => {
  it("sert le périmé et NE RAPPELLE PAS l'origine au second appel", async () => {
    mocks.findUnique.mockResolvedValue(lignePerimee(5 * 60_000))
    const origine = vi.fn().mockRejectedValue(new Error("503 Service Unavailable"))
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    await expect(getOrFetch("k", origine, TTL)).resolves.toEqual({ valeur: "périmée" })
    await expect(getOrFetch("k", origine, TTL)).resolves.toEqual({ valeur: "périmée" })
    await expect(getOrFetch("k", origine, TTL)).resolves.toEqual({ valeur: "périmée" })

    // C'est tout le correctif : trois requêtes, un seul appel d'origine.
    expect(origine).toHaveBeenCalledTimes(1)
    // Et une seule ligne de journal, non 293.
    expect(warn).toHaveBeenCalledTimes(1)
    expect(warn.mock.calls[0][0]).toContain("503 Service Unavailable")
    warn.mockRestore()
  })

  it("échoue vite, sans rappeler l'origine, quand aucun périmé n'est servable", async () => {
    // Périmé depuis plus de 24 h : hors grâce, donc rien à servir.
    mocks.findUnique.mockResolvedValue(lignePerimee(25 * HEURE))
    const origine = vi.fn().mockRejectedValue(new Error("503 Service Unavailable"))

    await expect(getOrFetch("k", origine, TTL)).rejects.toThrow("503 Service Unavailable")
    await expect(getOrFetch("k", origine, TTL)).rejects.toThrow("503 Service Unavailable")

    expect(origine).toHaveBeenCalledTimes(1)
  })

  it("rappelle l'origine une fois le recul écoulé, et repart si elle est rétablie", async () => {
    mocks.findUnique.mockResolvedValue(lignePerimee(5 * 60_000))
    const origine = vi
      .fn()
      .mockRejectedValueOnce(new Error("503 Service Unavailable"))
      .mockResolvedValueOnce({ valeur: "rétablie" })
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    await expect(getOrFetch("k", origine, TTL)).resolves.toEqual({ valeur: "périmée" })

    // Le recul est de 5 min : on le franchit.
    vi.useFakeTimers()
    vi.advanceTimersByTime(6 * 60_000)

    await expect(getOrFetch("k", origine, TTL)).resolves.toEqual({ valeur: "rétablie" })
    expect(origine).toHaveBeenCalledTimes(2)
    expect(mocks.upsert).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })
})

describe("getOrFetch — grâce de 24 h", () => {
  it("sert un périmé de 23 h mais lève à 25 h (la borne reste calculée sur expiresAt)", async () => {
    const origine = vi.fn().mockRejectedValue(new Error("timeout"))
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    mocks.findUnique.mockResolvedValue(lignePerimee(23 * HEURE))
    await expect(getOrFetch("k", origine, TTL)).resolves.toEqual({ valeur: "périmée" })

    __resetEtatsMemoire()
    mocks.findUnique.mockResolvedValue(lignePerimee(25 * HEURE))
    await expect(getOrFetch("k", origine, TTL)).rejects.toThrow("timeout")
    warn.mockRestore()
  })
})

describe("purgeExpired — ne mange pas la fenêtre de grâce", () => {
  it("ne purge que ce qui est périmé de plus de 24 h", async () => {
    // Sans cette borne, la purge nocturne branchée le 2026-09-09 supprimerait
    // les lignes tout juste périmées, c'est-à-dire exactement celles dont le
    // stale-while-error a besoin : une panne d'origine redeviendrait une erreur.
    mocks.deleteMany.mockResolvedValue({ count: 3 })
    const avant = Date.now()

    await expect(purgeExpired()).resolves.toBe(3)

    const where = mocks.deleteMany.mock.calls[0][0].where
    const limite = (where.expiresAt.lt as Date).getTime()
    expect(avant - limite).toBeGreaterThanOrEqual(24 * HEURE)
    expect(avant - limite).toBeLessThan(24 * HEURE + 5_000)
  })
})

describe("getOrFetch — coalescence", () => {
  it("ne lance qu'un appel d'origine pour deux requêtes concurrentes", async () => {
    mocks.findUnique.mockResolvedValue(lignePerimee(5 * 60_000))
    // Promesse créée AVANT l'appel : `getOrFetch` attend d'abord le
    // `findUnique` mocké, donc résoudre trop tôt laisserait le second appel
    // repartir sur une carte d'appels en vol déjà nettoyée.
    let resoudre!: (v: unknown) => void
    const attente = new Promise<unknown>((r) => {
      resoudre = r
    })
    const origine = vi.fn().mockReturnValue(attente)

    const a = getOrFetch("k", origine, TTL)
    const b = getOrFetch("k", origine, TTL)
    await flushMicrotaches()
    expect(origine).toHaveBeenCalledTimes(1)
    resoudre({ valeur: "neuve" })

    await expect(a).resolves.toEqual({ valeur: "neuve" })
    await expect(b).resolves.toEqual({ valeur: "neuve" })
    expect(origine).toHaveBeenCalledTimes(1)
    // Une seule persistance : deux upserts concurrents sur la même clé sont
    // exactement ce que la coalescence évite.
    expect(mocks.upsert).toHaveBeenCalledTimes(1)
  })

  it("ne journalise qu'une fois quand l'appel partagé échoue", async () => {
    mocks.findUnique.mockResolvedValue(lignePerimee(5 * 60_000))
    let rejeter!: (e: unknown) => void
    const attente = new Promise<unknown>((_, r) => {
      rejeter = r
    })
    // Le rejet est déjà « armé » : sans consommateur immédiat, Node signalerait
    // un rejet non traité avant que les appelants ne l'attendent.
    attente.catch(() => {})
    const origine = vi.fn().mockReturnValue(attente)
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})

    const a = getOrFetch("k", origine, TTL)
    const b = getOrFetch("k", origine, TTL)
    await flushMicrotaches()
    expect(origine).toHaveBeenCalledTimes(1)
    rejeter(new Error("503 Service Unavailable"))

    await expect(a).resolves.toEqual({ valeur: "périmée" })
    await expect(b).resolves.toEqual({ valeur: "périmée" })
    expect(origine).toHaveBeenCalledTimes(1)
    expect(warn).toHaveBeenCalledTimes(1)
    warn.mockRestore()
  })
})
