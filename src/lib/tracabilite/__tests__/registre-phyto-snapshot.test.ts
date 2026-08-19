import { describe, expect, it } from "vitest"

/**
 * QA cmswxinhf — un traitement conservé après la suppression de son arbre doit
 * rester identifiable au registre. L'identité vit dans les notes ; la colonne
 * « Culture / arbre » la relit au lieu d'afficher « Non renseigné ».
 *
 * La fonction n'est pas exportée (détail interne du générateur) : on verrouille
 * ici le format du snapshot, qui est le contrat entre l'écriture
 * (src/lib/verger/preserver-traces-phyto.ts, src/app/api/arbres/[id]/route.ts)
 * et la lecture (src/lib/tracabilite/registre-phyto.ts).
 */
const MOTIF = /\[Arbre supprimé\s*:\s*([^\]]+)\]/

describe("snapshot d'arbre supprimé", () => {
  it("relit l'identité avec espèce", () => {
    expect("[Arbre supprimé : Pommier du fond (Pommier)]".match(MOTIF)?.[1]).toBe(
      "Pommier du fond (Pommier)",
    )
  })

  it("relit l'identité sans espèce", () => {
    expect("[Arbre supprimé : Poirier 12]\nnote".match(MOTIF)?.[1]).toBe("Poirier 12")
  })

  it("ignore une note ordinaire", () => {
    expect("Vent faible, 8 km/h".match(MOTIF)).toBeNull()
  })
})
