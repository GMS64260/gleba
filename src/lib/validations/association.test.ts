import { describe, expect, it } from "vitest"
import { typeAssociationImporte } from "./association"

describe("typeAssociationImporte", () => {
  it("garde le type du fichier quand il est connu", () => {
    expect(typeAssociationImporte("incompatible")).toBe("incompatible")
    expect(typeAssociationImporte("neutre")).toBe("neutre")
    expect(typeAssociationImporte("favorable")).toBe("favorable")
  })

  it("ne force rien pour un fichier ancien ou une valeur inconnue", () => {
    for (const valeur of [undefined, null, "", "Incompatible", 3]) {
      expect(typeAssociationImporte(valeur)).toBeUndefined()
    }
  })
})
