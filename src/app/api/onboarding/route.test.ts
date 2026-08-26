/**
 * GET /api/onboarding — la question « faut-il montrer le wizard ? ».
 *
 * Régression couverte : un compte qui a saisi de la donnée sans jamais valider
 * le wizard était renvoyé sur `/onboarding` à chaque chargement complet, sans
 * fin. Ces tests fixent l'ordre des trois questions (drapeau, wizard en cours,
 * données réelles) et vérifient que le drapeau est scellé une seule fois.
 */

import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  requireAuthApi: vi.fn(),
  prefFindMany: vi.fn(),
  prefUpsert: vi.fn(),
  plancheFindFirst: vi.fn(),
  parcelleFindFirst: vi.fn(),
  cultureFindFirst: vi.fn(),
  recolteFindFirst: vi.fn(),
  arbreFindFirst: vi.fn(),
  animalFindFirst: vi.fn(),
  objetFindFirst: vi.fn(),
  noteFindFirst: vi.fn(),
}))

vi.mock("@/lib/auth-utils", () => ({ requireAuthApi: mocks.requireAuthApi }))
vi.mock("@/lib/prisma", () => ({
  default: {
    userPreference: { findMany: mocks.prefFindMany, upsert: mocks.prefUpsert },
    planche: { findFirst: mocks.plancheFindFirst },
    parcelleGeo: { findFirst: mocks.parcelleFindFirst },
    culture: { findFirst: mocks.cultureFindFirst },
    recolte: { findFirst: mocks.recolteFindFirst },
    arbre: { findFirst: mocks.arbreFindFirst },
    animal: { findFirst: mocks.animalFindFirst },
    objetJardin: { findFirst: mocks.objetFindFirst },
    note: { findFirst: mocks.noteFindFirst },
  },
}))

import { GET } from "./route"

const LECTEURS_DE_DONNEES = [
  mocks.plancheFindFirst,
  mocks.parcelleFindFirst,
  mocks.cultureFindFirst,
  mocks.recolteFindFirst,
  mocks.arbreFindFirst,
  mocks.animalFindFirst,
  mocks.objetFindFirst,
  mocks.noteFindFirst,
]

function session(extra: Record<string, unknown> = {}) {
  mocks.requireAuthApi.mockResolvedValue({
    error: null,
    session: {
      user: {
        id: "u1",
        acteurId: "u1",
        peutEcrireExploitation: true,
        ...extra,
      },
    },
  })
}

/** Aucune donnée saisie sur le compte. */
function compteVide() {
  LECTEURS_DE_DONNEES.forEach((m) => m.mockResolvedValue(null))
}

beforeEach(() => {
  vi.clearAllMocks()
  session()
  compteVide()
  mocks.prefFindMany.mockResolvedValue([])
  mocks.prefUpsert.mockResolvedValue({})
})

describe("GET /api/onboarding", () => {
  it("répond « terminé » sur le drapeau seul, sans interroger les données", async () => {
    mocks.prefFindMany.mockResolvedValue([{ key: "onboarding_completed", value: "true" }])

    const res = await GET()

    expect(await res.json()).toEqual({ completed: true })
    LECTEURS_DE_DONNEES.forEach((m) => expect(m).not.toHaveBeenCalled())
    expect(mocks.prefUpsert).not.toHaveBeenCalled()
  })

  it("laisse le wizard reprendre la main quand il a été commencé", async () => {
    mocks.prefFindMany.mockResolvedValue([{ key: "onboardingEtape", value: "modules" }])
    mocks.plancheFindFirst.mockResolvedValue({ id: "p1" })

    const res = await GET()

    // Des planches existent, mais l'étape persistée prouve un engagement
    // explicite dans le parcours : on ne scelle pas à sa place.
    expect(await res.json()).toEqual({ completed: false })
    expect(mocks.prefUpsert).not.toHaveBeenCalled()
  })

  it("scelle le drapeau dès qu'une saisie réelle existe hors wizard", async () => {
    mocks.plancheFindFirst.mockResolvedValue({ id: "p1" })

    const res = await GET()

    expect(await res.json()).toEqual({ completed: true })
    expect(mocks.prefUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_key: { userId: "u1", key: "onboarding_completed" } },
        create: { userId: "u1", key: "onboarding_completed", value: "true" },
        update: { value: "true" },
      }),
    )
  })

  it("reconnaît une saisie dans n'importe quel module", async () => {
    for (const lecteur of LECTEURS_DE_DONNEES) {
      vi.clearAllMocks()
      session()
      compteVide()
      mocks.prefFindMany.mockResolvedValue([])
      lecteur.mockResolvedValue({ id: "x" })

      const res = await GET()
      expect(await res.json()).toEqual({ completed: true })
    }
  })

  it("montre le parcours à un compte neuf", async () => {
    const res = await GET()

    expect(await res.json()).toEqual({ completed: false })
    expect(mocks.prefUpsert).not.toHaveBeenCalled()
  })

  it("n'écrit rien pendant une consultation admin", async () => {
    session({ impersonatedBy: "admin1" })
    mocks.parcelleFindFirst.mockResolvedValue({ id: "pg1" })

    const res = await GET()

    expect(await res.json()).toEqual({ completed: true })
    expect(mocks.prefUpsert).not.toHaveBeenCalled()
  })

  it("n'écrit rien pour un membre en lecture seule", async () => {
    session({ peutEcrireExploitation: false })
    mocks.animalFindFirst.mockResolvedValue({ id: "a1" })

    const res = await GET()

    expect(await res.json()).toEqual({ completed: true })
    expect(mocks.prefUpsert).not.toHaveBeenCalled()
  })
})
