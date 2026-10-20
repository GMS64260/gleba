/**
 * QA 2026-10-19 — Verger > Santé > Pollinisation : deux variétés personnelles
 * de prunier, floraison S14 à S16, affectées par leur nom à deux pruniers,
 * donnaient « Floraison - » et « À vérifier (groupe de floraison inconnu) ».
 * La matrice ne retrouvait la variété que par son id (un cuid pour une
 * variété personnelle) et ignorait donc ses semaines de floraison.
 */
import { beforeEach, describe, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({
  arbreFindMany: vi.fn(),
  varieteFindMany: vi.fn(),
  pollinisationFindMany: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  default: {
    arbre: { findMany: mocks.arbreFindMany },
    variete: { findMany: mocks.varieteFindMany },
    pollinisationArbre: { findMany: mocks.pollinisationFindMany },
  },
}))

import { computePollinisationVerger } from "../pollinisation-verger"
import { normalizeVarieteName } from "@/lib/normalize"

const USER = "user-1"
const arbre = (id: number, nom: string, variete: string | null, extra: Record<string, unknown> = {}) => ({
  id,
  nom,
  espece: "Prunier",
  especeId: "Prunier",
  variete,
  floraison: null,
  groupePollinisation: null,
  autofertile: false,
  pollinisateursCompat: [],
  pollinisateurDe: [],
  ...extra,
})
const variete = (id: string, nom: string, semaineFloraison: number | null, dureeFloraison: number | null) => ({
  id,
  nom,
  nomNormalise: normalizeVarieteName(nom),
  especeId: "Prunier",
  userId: USER,
  ploidie: null,
  groupePollinisation: null,
  semaineFloraison,
  dureeFloraison,
})

beforeEach(() => {
  vi.clearAllMocks()
  mocks.pollinisationFindMany.mockResolvedValue([])
})

describe("computePollinisationVerger — floraisons des variétés personnelles", () => {
  it("lit la floraison d'une variété personnelle affectée par son nom et en déduit une compatibilité vérifiée", async () => {
    mocks.arbreFindMany.mockResolvedValue([
      arbre(1, "Prunier un", "prune-a"),
      arbre(2, "Prunier deux", "Prune B"),
    ])
    mocks.varieteFindMany.mockResolvedValue([
      variete("ckpersoa", "prune-a", 14, 3),
      variete("ckpersob", "Prune B", 14, 3),
    ])

    const resultat = await computePollinisationVerger(USER)

    // Les lianes fruitières sont des types d'arbre qui produisent des fruits.
    expect(mocks.arbreFindMany.mock.calls[0][0].where.type).toEqual({ in: ["fruitier", "petit_fruit", "liane"] })
    const [a1, a2] = resultat.arbres
    expect(a1.periodeFloraison).toEqual({ debut: 14, duree: 3 })
    expect(a2.periodeFloraison).toEqual({ debut: 14, duree: 3 })
    expect(a1.varieteId).toBe("ckpersoa")
    expect(a1.hasPollinisateurDerive).toBe(true)
    expect(a1.pollinisateurDeriveCertitude).toBe("verifiee")
    expect(resultat.compatibilitesDerivees[1][0].raison).toContain("floraisons simultanées")
    expect(resultat.stats.sansPollinisateur).toBe(0)
  })

  it("deux floraisons sans semaine commune : pas de pollinisateur, l'alerte reste", async () => {
    mocks.arbreFindMany.mockResolvedValue([
      arbre(1, "Prunier précoce", "Précoce"),
      arbre(2, "Prunier tardif", "Tardive"),
    ])
    mocks.varieteFindMany.mockResolvedValue([
      variete("ckprecoce", "Précoce", 10, 2),
      variete("cktardive", "Tardive", 17, 2),
    ])

    const resultat = await computePollinisationVerger(USER)

    expect(resultat.arbres[0].hasPollinisateurDerive).toBe(false)
    expect(resultat.stats.sansPollinisateur).toBe(2)
  })

  it("QA cmvgee5s9 — association enregistrée puis démentie par les floraisons (S14-S16 / S23-S25) : signalée et non comptée", async () => {
    const association = (id: number, pollinisateurId: number) => ({
      id,
      arbrePollinisateurId: pollinisateurId,
      arbrePollinisateur: { id: pollinisateurId, nom: `Prunier ${pollinisateurId}`, espece: "Prunier", variete: null },
    })
    mocks.arbreFindMany.mockResolvedValue([
      arbre(835, "Prunier A", "Prune A", { pollinisateursCompat: [association(25, 836)] }),
      arbre(836, "Prunier B", "Prune B"),
    ])
    mocks.varieteFindMany.mockResolvedValue([
      variete("ckpersoa", "Prune A", 14, 3),
      variete("ckpersob", "Prune B", 23, 3),
    ])

    const resultat = await computePollinisationVerger(USER)
    const a835 = resultat.arbres.find((a) => a.id === 835)!

    expect(a835.nombrePollinisateursValides).toBe(0)
    expect(a835.pollinisateursCompat[0].floraisonIncompatible).toContain("sans semaine commune")
    expect(resultat.alertes.map((a) => a.id)).toContain(835)
  })

  it("association entre groupes hors de l'échelle A-E (« précoce » / « mi-saison ») : rien n'est vérifié, elle compte", async () => {
    mocks.arbreFindMany.mockResolvedValue([
      arbre(835, "Prunier A", "Prune A", {
        groupePollinisation: "précoce",
        pollinisateursCompat: [{ id: 25, arbrePollinisateurId: 836, arbrePollinisateur: { id: 836, nom: "Prunier B", espece: "Prunier", variete: null } }],
      }),
      arbre(836, "Prunier B", "Prune B", { groupePollinisation: "mi-saison" }),
    ])
    mocks.varieteFindMany.mockResolvedValue([
      variete("ckpersoa", "Prune A", null, null),
      variete("ckpersob", "Prune B", null, null),
    ])

    const resultat = await computePollinisationVerger(USER)
    const a835 = resultat.arbres.find((a) => a.id === 835)!

    expect(a835.nombrePollinisateursValides).toBe(1)
    expect(a835.pollinisateursCompat[0].floraisonIncompatible).toBeNull()
    expect(resultat.alertes.map((a) => a.id)).not.toContain(835)
  })

  it("association dont les floraisons se recouvrent : comptée, sans motif", async () => {
    mocks.arbreFindMany.mockResolvedValue([
      arbre(835, "Prunier A", "Prune A", {
        pollinisateursCompat: [{ id: 25, arbrePollinisateurId: 836, arbrePollinisateur: { id: 836, nom: "Prunier B", espece: "Prunier", variete: null } }],
      }),
      arbre(836, "Prunier B", "Prune B"),
    ])
    mocks.varieteFindMany.mockResolvedValue([
      variete("ckpersoa", "Prune A", 14, 3),
      variete("ckpersob", "Prune B", 14, 3),
    ])

    const resultat = await computePollinisationVerger(USER)
    const a835 = resultat.arbres.find((a) => a.id === 835)!

    expect(a835.nombrePollinisateursValides).toBe(1)
    expect(a835.pollinisateursCompat[0].floraisonIncompatible).toBeNull()
    expect(resultat.alertes.map((a) => a.id)).not.toContain(835)
  })

  it("une seule floraison connue : compatibilité présumée, jamais affirmée", async () => {
    mocks.arbreFindMany.mockResolvedValue([
      arbre(1, "Prunier un", "Avec floraison"),
      arbre(2, "Prunier deux", "Sans floraison"),
    ])
    mocks.varieteFindMany.mockResolvedValue([
      variete("ckavec", "Avec floraison", 14, 3),
      variete("cksans", "Sans floraison", null, null),
    ])

    const resultat = await computePollinisationVerger(USER)

    expect(resultat.arbres[0].pollinisateurDeriveCertitude).toBe("presumee")
    expect(resultat.arbres[1].periodeFloraison).toBeNull()
  })

  it("deux arbres de la même variété personnelle, saisie avec une casse différente, sont des clones", async () => {
    mocks.arbreFindMany.mockResolvedValue([
      arbre(1, "Prunier un", "Prune A"),
      arbre(2, "Prunier deux", "prune a"),
    ])
    mocks.varieteFindMany.mockResolvedValue([variete("ckpersoa", "Prune A", 14, 3)])

    const resultat = await computePollinisationVerger(USER)

    expect(resultat.arbres[0].hasPollinisateurDerive).toBe(false)
  })
})
