import { describe, expect, it } from "vitest"
import { joindreVersion, lireConflitVersion, versionDe } from "./use-version-fiche"

describe("versionDe", () => {
  it("lit la version d'une fiche, « aucune » sans fiche, rien si le serveur n'en porte pas", () => {
    expect(versionDe({ id: 1, version: 4 })).toBe(4)
    expect(versionDe({ id: 1, version: 0 })).toBe(0)
    expect(versionDe(null)).toBe("aucune")
    expect(versionDe({ id: 1 })).toBeNull()
    expect(versionDe({ id: 1, version: "4" })).toBeNull()
  })
})

describe("joindreVersion", () => {
  it("joint la version lue et ne renvoie jamais la colonne version", () => {
    expect(joindreVersion({ nom: "A", version: 9 }, 4)).toEqual({ nom: "A", versionLue: 4 })
    expect(joindreVersion({ nom: "A" }, "aucune")).toEqual({ nom: "A", versionLue: "aucune" })
    expect(joindreVersion({ nom: "A", version: 9 }, null)).toEqual({ nom: "A" })
  })
})

describe("lireConflitVersion", () => {
  it("reconnaît le refus « modifiée ailleurs » et laisse le corps lisible", async () => {
    const reponse = Response.json({ error: "Modifiée.", code: "MODIFIE_AILLEURS", versionActuelle: 5 }, { status: 409 })
    expect(await lireConflitVersion(reponse)).toEqual({ message: "Modifiée.", versionActuelle: 5 })
    expect((await reponse.json()).code).toBe("MODIFIE_AILLEURS")
  })

  it("ignore un autre 409 (confirmation métier) et les autres statuts", async () => {
    expect(await lireConflitVersion(Response.json({ code: "IDENTIFIANT_DEJA_UTILISE" }, { status: 409 }))).toBeNull()
    expect(await lireConflitVersion(Response.json({ ok: true }))).toBeNull()
  })
})
