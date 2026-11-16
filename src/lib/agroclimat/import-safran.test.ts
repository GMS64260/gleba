import { describe, expect, it } from "vitest"
import { caseDuJour } from "./calendrier"
import { importAgroclimatActif, lignesDuFlux, lireFichierSafran } from "./import-safran"
import { libelleCase } from "./libelles"

async function* morceaux(...parts: string[]) {
  for (const p of parts) yield Buffer.from(p, "utf8")
}

async function toutes(flux: AsyncIterable<string>): Promise<string[]> {
  const lignes: string[] = []
  for await (const l of flux) lignes.push(l)
  return lignes
}

describe("découpage d'un flux en lignes", () => {
  it("recolle une ligne coupée entre deux morceaux", async () => {
    expect(await toutes(lignesDuFlux(morceaux("a;b\nc;", "d\ne", ";f\n")))).toEqual(["a;b", "c;d", "e;f"])
  })

  it("rend la dernière ligne sans retour final et retire les retours chariot", async () => {
    expect(await toutes(lignesDuFlux(morceaux("a\r\nb\r", "\nc")))).toEqual(["a", "b", "c"])
  })

  it("ne rend rien d'un flux vide", async () => {
    expect(await toutes(lignesDuFlux(morceaux()))).toEqual([])
  })
})

describe("lecture d'un fichier SAFRAN distant", () => {
  const fichier = async function* () {
    yield "LAMBX;LAMBY;DATE;TINF_H;TSUP_H"
    yield "3800;18170;20250412;-1.5;9.0"
    yield "600;24010;20250412;4.0;11.0"
  }

  it("rend les séries des mailles demandées", async () => {
    const series = await lireFichierSafran("https://exemple.test/2025", new Set(["3800;18170"]), async () => fichier())
    expect(series!.get("3800;18170")!.get(2025)!.tmin[caseDuJour(4, 12)]).toBe(-15)
    expect(series!.has("600;24010")).toBe(false)
  })

  it("rend null pour un fichier absent", async () => {
    expect(await lireFichierSafran("https://exemple.test/2099", new Set(), async () => null)).toBeNull()
  })

  it("refuse un fichier vide", async () => {
    const vide = async function* (): AsyncGenerator<string> {}
    await expect(lireFichierSafran("https://exemple.test/vide", new Set(), async () => vide())).rejects.toThrow(/vide/)
  })
})

describe("réglage et libellés", () => {
  it("se coupe par la variable d'environnement", () => {
    expect(importAgroclimatActif({} as NodeJS.ProcessEnv)).toBe(true)
    expect(importAgroclimatActif({ GLEBA_AGROCLIMAT_IMPORT: "false" } as unknown as NodeJS.ProcessEnv)).toBe(false)
  })

  it("écrit une date de l'année en clair", () => {
    expect(libelleCase(caseDuJour(4, 12))).toBe("12 avril")
    expect(libelleCase(caseDuJour(5, 1))).toBe("1er mai")
    expect(libelleCase(caseDuJour(2, 29))).toBe("29 février")
  })
})
