import { beforeEach, describe, expect, it, vi } from "vitest"

import { resoudreIdPlanche } from "@/lib/planches/resolution"

/** Faux client Prisma minimal : ne répond qu'à `planche.findFirst`. */
function fauxTx(planches: { id: string; nom: string; userId: string }[]) {
  const findFirst = vi.fn(async ({ where }: { where: Record<string, unknown> }) => {
    const trouve = planches.find(
      (p) =>
        p.userId === where.userId &&
        (where.id === undefined || p.id === where.id) &&
        (where.nom === undefined || p.nom === where.nom)
    )
    return trouve ? { id: trouve.id } : null
  })
  return { tx: { planche: { findFirst } } as never, findFirst }
}

const PLANCHES = [
  { id: "cme000000000000000000001", nom: "A1", userId: "u1" },
  { id: "cme000000000000000000002", nom: "4 (2)", userId: "u1" },
  { id: "cme000000000000000000003", nom: "A1", userId: "u2" },
]

describe("resoudreIdPlanche", () => {
  beforeEach(() => vi.clearAllMocks())

  it("résout par identifiant", async () => {
    const { tx } = fauxTx(PLANCHES)
    await expect(resoudreIdPlanche(tx, "cme000000000000000000001", "u1")).resolves.toBe(
      "cme000000000000000000001"
    )
  })

  it("ne fait qu'une requête quand l'identifiant suffit", async () => {
    const { tx, findFirst } = fauxTx(PLANCHES)
    await resoudreIdPlanche(tx, "cme000000000000000000001", "u1")
    expect(findFirst).toHaveBeenCalledTimes(1)
  })

  it("retombe sur le nom pour les liens et favoris antérieurs", async () => {
    const { tx, findFirst } = fauxTx(PLANCHES)
    await expect(resoudreIdPlanche(tx, "A1", "u1")).resolves.toBe("cme000000000000000000001")
    expect(findFirst).toHaveBeenCalledTimes(2)
  })

  it("accepte un nom contenant des espaces et des parenthèses", async () => {
    const { tx } = fauxTx(PLANCHES)
    await expect(resoudreIdPlanche(tx, "4 (2)", "u1")).resolves.toBe("cme000000000000000000002")
  })

  it("reste borné au propriétaire", async () => {
    const { tx } = fauxTx(PLANCHES)
    // « A1 » existe pour u1 et pour u2 : chacun ne voit que la sienne.
    await expect(resoudreIdPlanche(tx, "A1", "u2")).resolves.toBe("cme000000000000000000003")
    await expect(
      resoudreIdPlanche(tx, "cme000000000000000000001", "u2")
    ).resolves.toBeNull()
  })

  it("renvoie null quand rien ne correspond", async () => {
    const { tx } = fauxTx(PLANCHES)
    await expect(resoudreIdPlanche(tx, "inexistante", "u1")).resolves.toBeNull()
  })

  it("privilégie l'identifiant sur un nom homonyme", async () => {
    // Une planche nommée comme l'identifiant d'une autre ne doit pas la masquer.
    const planches = [
      { id: "cme000000000000000000009", nom: "Serre", userId: "u1" },
      { id: "cme00000000000000000000a", nom: "cme000000000000000000009", userId: "u1" },
    ]
    const { tx } = fauxTx(planches)
    await expect(resoudreIdPlanche(tx, "cme000000000000000000009", "u1")).resolves.toBe(
      "cme000000000000000000009"
    )
  })
})
