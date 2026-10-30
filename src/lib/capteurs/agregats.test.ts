/**
 * Agrégation et purge nocturnes, sans base : découpage par connecteur et SQL
 * produit. Le comportement sur PostgreSQL est vérifié par
 * `postgres.integration.test.ts`.
 */
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"
import type { Prisma } from "@prisma/client"

const mocks = vi.hoisted(() => ({
  connecteursFindMany: vi.fn(),
  transaction: vi.fn(),
  executeRaw: vi.fn(),
  queryRaw: vi.fn(),
}))

vi.mock("@/lib/prisma", () => ({
  default: {
    connecteurCapteurs: { findMany: mocks.connecteursFindMany },
    $transaction: mocks.transaction,
    $executeRaw: mocks.executeRaw,
  },
}))

import { agregerEtPurgerMesures, agregerMesuresRecentes, LOT_SUPPRESSION_MESURES, supprimerMesuresBrutesDuCompte } from "./agregats"

const requetes = () => mocks.queryRaw.mock.calls.map(([sql]) => sql as Prisma.Sql)

describe("agrégation et purge nocturnes", () => {
  const journal = vi.spyOn(console, "error").mockImplementation(() => {})

  beforeEach(() => {
    vi.clearAllMocks()
    mocks.connecteursFindMany.mockResolvedValue([{ id: "conn-a" }, { id: "conn-b" }, { id: "conn-c" }])
    mocks.transaction.mockImplementation((action: (tx: unknown) => Promise<unknown>) =>
      action({ $executeRaw: mocks.executeRaw, $queryRaw: mocks.queryRaw }),
    )
    mocks.executeRaw.mockResolvedValue(1)
    mocks.queryRaw.mockImplementation(async (sql: Prisma.Sql) => {
      // Fuseau importé d'une sauvegarde, rejeté par `AT TIME ZONE`.
      if (sql.values.includes("conn-b")) throw new Error('time zone "Mars/Olympus" not recognized')
      return [{ agregats: 2, purgees: 3 }]
    })
  })

  afterAll(() => journal.mockRestore())

  it("traite chaque connecteur dans sa transaction et sous le verrou : l'échec de l'un n'arrête pas les autres", async () => {
    expect(await agregerEtPurgerMesures()).toEqual({ agregats: 4, purgees: 6, echecs: 1 })

    expect(mocks.transaction).toHaveBeenCalledTimes(3)
    expect(mocks.transaction.mock.calls.every(([, options]) => options?.timeout === 120_000)).toBe(true)
    // Verrou consultatif pris dans chaque transaction, avant sa requête.
    expect(mocks.executeRaw).toHaveBeenCalledTimes(3)
    expect(mocks.executeRaw.mock.calls[0][0].join("?")).toContain("pg_advisory_xact_lock(hashtext('gleba:capteurs:agregats'))")
    mocks.queryRaw.mock.invocationCallOrder.forEach((ordre, i) => expect(mocks.executeRaw.mock.invocationCallOrder[i]).toBeLessThan(ordre))
    // L'identifiant est un paramètre lié, jamais du SQL.
    expect(requetes().map((sql) => sql.values.filter((v) => typeof v === "string"))).toEqual([["conn-a", "conn-a"], ["conn-b", "conn-b"], ["conn-c", "conn-c"]])
    expect(journal).toHaveBeenCalledOnce()
    expect(String(journal.mock.calls[0][0])).toContain("conn-b")
  })

  it("agrège et purge un connecteur en UNE requête : même instantané, purge des seules journées calculées", () =>
    agregerEtPurgerMesures().then(() => {
      const { sql } = requetes()[0]
      expect(sql).toContain('INSERT INTO "mesures_capteurs_jours"')
      expect(sql).toContain('DELETE FROM "mesures_capteurs" m')
      expect(sql).toMatch(/EXISTS \(\s*SELECT 1 FROM calcul k/)
      expect(sql).toContain('c."id" = ?')
    }))

  it("ne consomme pas la séquence SERIAL pour une journée déjà agrégée et inchangée", async () => {
    await agregerEtPurgerMesures()
    const { sql } = requetes()[0]
    expect(sql).not.toContain("ON CONFLICT")
    // Journées existantes : mises à jour seulement si elles diffèrent.
    expect(sql).toMatch(/UPDATE "mesures_capteurs_jours" a[\s\S]*IS DISTINCT FROM/)
    // Insertion des seules journées absentes.
    expect(sql).toMatch(/INSERT INTO "mesures_capteurs_jours"[\s\S]*WHERE NOT EXISTS/)
  })

  it("le rattrapage sans purge suit le même découpage par connecteur", async () => {
    expect(await agregerMesuresRecentes()).toBe(4)
    expect(mocks.transaction).toHaveBeenCalledTimes(3)
    expect(requetes().every(({ sql }) => !sql.includes("DELETE"))).toBe(true)
  })

  it("ne lit que les connecteurs qui ont des capteurs", async () => {
    await agregerEtPurgerMesures()
    expect(mocks.connecteursFindMany).toHaveBeenCalledWith(expect.objectContaining({ where: { capteurs: { some: {} } } }))
  })
})

describe("suppression du brut d'un compte (« Vider mes données »)", () => {
  beforeEach(() => vi.clearAllMocks())

  it("supprime par lots, chacun validé seul, jusqu'au premier lot incomplet", async () => {
    mocks.executeRaw.mockResolvedValueOnce(LOT_SUPPRESSION_MESURES).mockResolvedValueOnce(LOT_SUPPRESSION_MESURES).mockResolvedValueOnce(12)
    expect(await supprimerMesuresBrutesDuCompte("u1")).toBe(2 * LOT_SUPPRESSION_MESURES + 12)
    expect(mocks.executeRaw).toHaveBeenCalledTimes(3)
    expect(mocks.transaction).not.toHaveBeenCalled()
    const [morceaux, ...valeurs] = mocks.executeRaw.mock.calls[0]
    expect(morceaux.join("?")).toMatch(/DELETE FROM "mesures_capteurs"[\s\S]*cap\."user_id" = \?[\s\S]*LIMIT \?::int/)
    expect(valeurs).toEqual(["u1", LOT_SUPPRESSION_MESURES])
  })
})
