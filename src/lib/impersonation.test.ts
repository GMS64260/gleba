import { describe, expect, it } from "vitest"
import {
  consommerJetonImpersonation,
  genererJetonImpersonation,
  hashJeton,
} from "./impersonation"

describe("jetons de consultation admin", () => {
  it("génère un jeton aléatoire hexadécimal et ne conserve qu'un hash stable", async () => {
    const jeton = genererJetonImpersonation()
    expect(jeton).toMatch(/^[0-9a-f]{64}$/)
    expect(await hashJeton("test")).toBe(
      "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08",
    )
  })

  it("n'autorise qu'une consommation concurrente", async () => {
    let consomme = false
    const client = {
      impersonationGrant: {
        updateMany: async () => {
          await Promise.resolve()
          if (consomme) return { count: 0 }
          consomme = true
          return { count: 1 }
        },
      },
    }

    const resultats = await Promise.all([
      consommerJetonImpersonation(client, "grant-1"),
      consommerJetonImpersonation(client, "grant-1"),
    ])

    expect(resultats.filter(Boolean)).toHaveLength(1)
  })
})
