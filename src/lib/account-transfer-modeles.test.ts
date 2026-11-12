import { describe, expect, it } from "vitest"
import { Prisma } from "@prisma/client"
import { MODELES_FERME_SAISIE } from "./account-transfer"

// Le comptage d'une ferme déjà saisie filtre chaque modèle par `userId`. Les
// tests d'import utilisent des doubles de Prisma, qui acceptent n'importe quel
// champ : seul le schéma réel peut prouver que le filtre existe.
describe("modèles comptés avant un import de compte", () => {
  const modeles = new Map(Prisma.dmmf.datamodel.models.map((m) => [m.name.charAt(0).toLowerCase() + m.name.slice(1), m]))

  it.each([...MODELES_FERME_SAISIE])("%s existe et porte userId", (modele) => {
    const definition = modeles.get(modele)
    expect(definition, `modèle Prisma ${modele}`).toBeDefined()
    expect(definition!.fields.some((champ) => champ.name === "userId")).toBe(true)
  })
})
