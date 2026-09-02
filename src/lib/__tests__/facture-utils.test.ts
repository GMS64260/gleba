/**
 * Réservation d'un numéro de facture : la séquence se recale sur les numéros
 * déjà pris, même quand sa ligne existe déjà (reset démo, import).
 * Régression du 2026-08-12 : trois 500 d'affilée sur un avoir du compte démo.
 */
import { describe, it, expect, vi } from "vitest"
import { reserverProchainNumeroForEmission } from "@/lib/facture-utils"

function fauxTx(opts: { prochainNum: number; maxExistant: number | null }) {
  const executeRaw = vi.fn().mockResolvedValue(1)
  const queryRaw = vi.fn().mockImplementation(async (sql: string) => {
    if (sql.includes("FOR UPDATE")) {
      return [{ prochain_num: opts.prochainNum, prefixe: "AV-2026-", format: "%04d" }]
    }
    if (sql.includes("MAX(")) return [{ max_num: opts.maxExistant }]
    throw new Error(`SQL inattendu : ${sql}`)
  })
  return {
    tx: { $executeRawUnsafe: executeRaw, $queryRawUnsafe: queryRaw } as never,
    executeRaw,
    queryRaw,
  }
}

const updateCall = (executeRaw: ReturnType<typeof vi.fn>) =>
  executeRaw.mock.calls.find((c) => String(c[0]).includes("UPDATE sequences_facture"))!

describe("reserverProchainNumero", () => {
  it("séquence en retard sur les factures existantes : saute au premier numéro libre", async () => {
    const { tx, executeRaw } = fauxTx({ prochainNum: 1, maxExistant: 4 })
    const { numero } = await reserverProchainNumeroForEmission(tx, "u1", 2026, "AVOIR")
    expect(numero).toBe("AV-2026-0005")
    // et le compteur repart APRÈS ce numéro, pas de l'ancien compteur + 1
    expect(updateCall(executeRaw).slice(1)).toEqual(["u1", 2026, "AVOIR", 6])
  })

  it("séquence en avance (numéros supprimés) : ne recule jamais", async () => {
    const { tx, executeRaw } = fauxTx({ prochainNum: 7, maxExistant: 4 })
    const { numero } = await reserverProchainNumeroForEmission(tx, "u1", 2026, "AVOIR")
    expect(numero).toBe("AV-2026-0007")
    expect(updateCall(executeRaw)[4]).toBe(8)
  })

  it("aucune facture pour ce préfixe : le compteur fait foi", async () => {
    const { tx, executeRaw } = fauxTx({ prochainNum: 3, maxExistant: null })
    const { numero } = await reserverProchainNumeroForEmission(tx, "u1", 2026, "AVOIR")
    expect(numero).toBe("AV-2026-0003")
    expect(updateCall(executeRaw)[4]).toBe(4)
  })

  it("la recherche des numéros pris se fait sur le préfixe DE LA LIGNE, sous le verrou", async () => {
    const { tx, queryRaw } = fauxTx({ prochainNum: 1, maxExistant: 1 })
    await reserverProchainNumeroForEmission(tx, "u1", 2026, "AVOIR")
    const ordre = queryRaw.mock.calls.map((c) => (String(c[0]).includes("FOR UPDATE") ? "lock" : "max"))
    expect(ordre).toEqual(["lock", "max"])
    const maxCall = queryRaw.mock.calls[1]
    expect(maxCall.slice(1)).toEqual(["u1", "AV-2026-"])
  })
})
