import { describe, expect, it, vi } from "vitest"

import { preserverTracesPhytoArbre } from "../preserver-traces-phyto"

/**
 * QA cmswxinhf — un traitement complet (AMM, dose, DAR, ZNT) saisi depuis
 * Verger > Santé & Phyto disparaissait du registre phytosanitaire à la
 * suppression de l'arbre : `observations_sante.arbre_id` est obligatoire et en
 * cascade. Le registre est une obligation de conservation : la trace doit
 * survivre, détachée de l'arbre.
 */
const observation = {
  id: 7,
  date: new Date("2026-08-17T08:00:00Z"),
  produit: "Bouillie QA",
  numAMM: "AMM-QA-2026-V7B",
  diagnostic: "Tavelure",
  symptome: null,
  traitement: "Traitement de rattrapage",
  doseAppliquee: 0.5,
  uniteDose: "L/ha",
  dar: 7,
  zntDistanceM: 20,
  zntRespectee: true,
  surfaceTraiteeHa: 0.12,
  volumeBouillieLHa: 300,
  volumeBouillieLTotal: 36,
  temperatureC: 21,
  ventKmh: 8,
  hygrometriePct: 60,
  pluie24h: false,
  pluie24hMm: 0,
  epiPortes: ["gants", "combinaison"],
  parcelleId: "parc-1",
  operateurId: "op-1",
  certiphytoNum: "CERT-1",
  notes: "note d'origine",
}

const faireTx = (observations: unknown[], operations: unknown[]) => {
  const creations: any[] = []
  return {
    creations,
    tx: {
      observationSante: { findMany: vi.fn().mockResolvedValue(observations) },
      operationArbre: { findMany: vi.fn().mockResolvedValue(operations) },
      intervention: {
        create: vi.fn(async ({ data }: any) => {
          creations.push(data)
          return { id: creations.length }
        }),
      },
    } as any,
  }
}

describe("preserverTracesPhytoArbre", () => {
  it("verse l'observation phyto au registre, détachée et snapshotée", async () => {
    const { tx, creations } = faireTx([observation], [])
    const bilan = await preserverTracesPhytoArbre(tx, "u1", {
      id: 42,
      nom: "Pommier QA",
      espece: "Pommier",
    })

    expect(bilan).toEqual({ observations: 1, operations: 0 })
    expect(creations).toHaveLength(1)
    const trace = creations[0]
    expect(trace.type).toBe("traitement_phyto")
    expect(trace.arbreId).toBeNull()
    expect(trace.fait).toBe(true)
    // Champs réglementaires conservés à l'identique.
    expect(trace.numAMM).toBe("AMM-QA-2026-V7B")
    expect(trace.doseAppliquee).toBe(0.5)
    expect(trace.dar).toBe(7)
    expect(trace.zntDistanceM).toBe(20)
    expect(trace.epiPortes).toEqual(["gants", "combinaison"])
    expect(trace.certiphytoNum).toBe("CERT-1")
    // Surface : hectares d'origine + conversion en m² pour le total du registre.
    expect(trace.surfaceTraiteeHa).toBe(0.12)
    expect(trace.surfaceTraitee).toBe(1200)
    // Identité de l'arbre lisible au registre après suppression.
    expect(trace.notes).toBe("[Arbre supprimé : Pommier QA (Pommier)]\nnote d'origine")
  })

  it("verse aussi les opérations de type traitement, sans inventer d'AMM", async () => {
    const operation = {
      id: 3,
      date: new Date("2026-05-02T07:00:00Z"),
      produit: "Bouillie bordelaise",
      description: "Traitement de printemps",
      quantite: 3,
      unite: "kg",
      cout: 12,
      dureeMinutes: 45,
      nbPersonnes: 1,
      temperatureC: 14,
      ventKmh: 5,
      hygrometriePct: 70,
      pluie24h: null,
      pluie24hMm: null,
      operateurId: null,
      notes: null,
    }
    const { tx, creations } = faireTx([], [operation])
    const bilan = await preserverTracesPhytoArbre(tx, "u1", {
      id: 42,
      nom: "Poirier 12",
      espece: null,
    })

    expect(bilan).toEqual({ observations: 0, operations: 1 })
    expect(creations[0].produitPhyto).toBe("Bouillie bordelaise")
    expect(creations[0].numAMM).toBeUndefined()
    expect(creations[0].doseAppliquee).toBe(3)
    expect(creations[0].notes).toBe("[Arbre supprimé : Poirier 12]")
  })

  it("ne crée rien quand l'arbre n'a aucune trace phyto", async () => {
    const { tx, creations } = faireTx([], [])
    const bilan = await preserverTracesPhytoArbre(tx, "u1", { id: 1, nom: "X", espece: null })
    expect(bilan).toEqual({ observations: 0, operations: 0 })
    expect(creations).toHaveLength(0)
  })
})
