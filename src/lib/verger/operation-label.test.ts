import { describe, expect, it } from "vitest"
import { libelleOperationArbre } from "./operation-label"

describe("libelleOperationArbre", () => {
  it("humanise les codes persistants sans perdre les accents", () => {
    expect(libelleOperationArbre("recolte")).toBe("Récolte")
    expect(libelleOperationArbre("fertilisation")).toBe("Fertilisation")
  })

  it("préserve un libellé inconnu", () => {
    expect(libelleOperationArbre("Éclaircissage")).toBe("Éclaircissage")
  })
})
