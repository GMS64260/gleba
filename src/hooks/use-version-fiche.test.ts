import { describe, expect, it } from "vitest"
import { envoyerFiche, joindreVersion, lireConflitVersion, versionDe } from "./use-version-fiche"

describe("versionDe", () => {
  it("lit la version d'une fiche, « aucune » sans fiche, rien si le serveur n'en porte pas", () => {
    expect(versionDe({ id: 1, version: 4 })).toBe(4)
    expect(versionDe({ id: 1, version: 0 })).toBe(0)
    expect(versionDe(null)).toBe("aucune")
    // Rien de chargé n'est pas « le serveur n'a pas de fiche » : aucune version envoyée.
    expect(versionDe(undefined)).toBeNull()
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

describe("envoyerFiche", () => {
  const conflit = (versionActuelle: number) => Response.json({ error: "Fiche modifiée ailleurs.", code: "MODIFIE_AILLEURS", versionActuelle }, { status: 409 })
  const fiche = (lue: number | null) => {
    let version = lue
    return { joindre: (corps: object) => joindreVersion(corps, version), adopter: (v: number | null) => { version = v } }
  }

  it("rend la réponse telle quelle quand il n'y a pas de conflit, autres 409 compris", async () => {
    const autre = Response.json({ error: "Confirmation demandée" }, { status: 409 })
    const res = await envoyerFiche(fiche(2), { nom: "x" }, async () => autre, async () => { throw new Error("pas de question attendue") })
    expect(res).toBe(autre)
  })

  it("sur un conflit accepté, renvoie avec la version actuelle", async () => {
    const envois: object[] = []
    const res = await envoyerFiche(fiche(2), { nom: "x" }, async (corps) => { envois.push(corps); return envois.length === 1 ? conflit(5) : Response.json({ ok: true }) }, async () => true)
    expect(res?.status).toBe(200)
    expect(envois).toEqual([{ nom: "x", versionLue: 2 }, { nom: "x", versionLue: 5 }])
  })

  it("sur un conflit refusé, n'envoie rien de plus et rend null", async () => {
    let envois = 0
    const res = await envoyerFiche(fiche(2), { nom: "x" }, async () => { envois++; return conflit(5) }, async () => false)
    expect(res).toBeNull()
    expect(envois).toBe(1)
  })
})
