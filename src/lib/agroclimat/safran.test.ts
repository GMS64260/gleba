import { describe, expect, it } from "vitest"
import { CASES_ANNEE, caseDuJour } from "./calendrier"
import { DISTANCE_MAX_KM, centreMaille, cleMaille, mailleLaPlusProche } from "./grille-safran"
import { ABSENT, anneeVide, creerLecteurSafran, fusionnerSerie, urlAnneeSafran, versDegres } from "./safran"

const ENTETE =
  "LAMBX;LAMBY;DATE;PRENEI;PRELIQ;T;FF;Q;DLI;SSI;HU;EVAP;ETP;PE;SWI;SSWI_10J;DRAINC;RUNC;RESR_NEIGE;RESR_NEIGE6;HTEURNEIGE;HTEURNEIGE6;HTEURNEIGEX;SNOW_FRAC;ECOULEMENT;WG_RACINE;WGI_RACINE;TINF_H;TSUP_H"

/** Ligne réelle du fichier 2005, maille 3640;18090, dont on fait varier la date et les extrêmes. */
function ligne(cle: string, date: string, tmin: string, tmax: string): string {
  return `${cle};${date};0.0;18.2;8.3;3.0;6.121;2934.5;67.1;88.0;0.6;0.9;17.6;0.996;-0.361;1.3;3.4;0.0;0.0;0.0;0.0;0.0;0.0;0.0;0.376;0.0;${tmin};${tmax}`
}

describe("grille SAFRAN", () => {
  it("trouve la maille d'un point de la métropole", () => {
    // Pau : la maille voisine est centrée en 43,3212 N, 0,3709 O.
    const maille = mailleLaPlusProche(43.3, -0.37)
    expect(maille).toMatchObject({ lambx: 3800, lamby: 18170, lat: 43.3212, lng: -0.3709 })
    expect(maille!.distanceKm).toBeLessThan(5.7)
  })

  it("couvre la Corse", () => {
    expect(mailleLaPlusProche(42.15, 9.1)).not.toBeNull()
  })

  it("écarte un point hors de la grille", () => {
    expect(mailleLaPlusProche(-22.27, 166.45)).toBeNull() // Nouméa
    expect(mailleLaPlusProche(16.25, -61.55)).toBeNull() // Guadeloupe
    expect(mailleLaPlusProche(52.52, 13.4)).toBeNull() // Berlin
    expect(mailleLaPlusProche(46.0, -8.0)).toBeNull() // Atlantique
    expect(mailleLaPlusProche(Number.NaN, 2)).toBeNull()
    expect(DISTANCE_MAX_KM).toBeGreaterThan(5.7)
  })

  it("retrouve le centre d'une maille par sa clé", () => {
    expect(centreMaille(3800, 18170)).toEqual({ lat: 43.3212, lng: -0.3709 })
    expect(centreMaille(1, 2)).toBeNull()
    expect(cleMaille(3800, 18170)).toBe("3800;18170")
  })
})

describe("lecture d'un fichier SAFRAN", () => {
  it("ne garde que les mailles demandées, en dixièmes de degré", () => {
    const lecteur = creerLecteurSafran(new Set(["3640;18090"]))
    lecteur.ligne(ENTETE)
    lecteur.ligne(ligne("3640;18090", "20051231", "6.5", "12.2"))
    lecteur.ligne(ligne("3640;18090", "20050301", "-3.4", "4.0"))
    lecteur.ligne(ligne("3640;18170", "20051231", "1.0", "2.0"))
    lecteur.ligne(ligne("640;18090", "20051231", "1.0", "2.0"))

    const serie = lecteur.series.get("3640;18090")!.get(2005)!
    expect(serie.tmin).toHaveLength(CASES_ANNEE)
    expect(serie.tmin[caseDuJour(12, 31)]).toBe(65)
    expect(serie.tmax[caseDuJour(12, 31)]).toBe(122)
    expect(serie.tmin[caseDuJour(3, 1)]).toBe(-34)
    expect(serie.tmin[caseDuJour(1, 1)]).toBe(ABSENT)
    expect([...lecteur.series.keys()]).toEqual(["3640;18090"])
    expect(lecteur.bilan()).toEqual({ enteteLue: true, lignesLues: 4, lignesGardees: 2 })
  })

  it("range chaque année à part", () => {
    const lecteur = creerLecteurSafran(new Set(["3640;18090"]))
    lecteur.ligne(ENTETE)
    lecteur.ligne(ligne("3640;18090", "20251231", "1.0", "5.0"))
    lecteur.ligne(ligne("3640;18090", "20260101", "-1.0", "3.0"))
    const parAnnee = lecteur.series.get("3640;18090")!
    expect([...parAnnee.keys()]).toEqual([2025, 2026])
    expect(parAnnee.get(2026)!.tmin[0]).toBe(-10)
  })

  it("repère les colonnes par leur nom", () => {
    const lecteur = creerLecteurSafran(new Set(["3640;18090"]))
    lecteur.ligne("LAMBX;LAMBY;TSUP_H;DATE;NOUVEAU;TINF_H")
    lecteur.ligne("3640;18090;12.2;20051231;x;6.5")
    const serie = lecteur.series.get("3640;18090")!.get(2005)!
    expect(serie.tmin[caseDuJour(12, 31)]).toBe(65)
    expect(serie.tmax[caseDuJour(12, 31)]).toBe(122)
  })

  it("refuse un fichier dont l'en-tête n'est pas celui attendu", () => {
    expect(() => creerLecteurSafran(new Set()).ligne("<html>Erreur</html>")).toThrow(/LAMBX;LAMBY/)
    expect(() => creerLecteurSafran(new Set()).ligne("LAMBX;LAMBY;DATE;T")).toThrow(/TINF_H/)
  })

  it("laisse absent un jour sans valeur ou une date illisible", () => {
    const lecteur = creerLecteurSafran(new Set(["3640;18090"]))
    lecteur.ligne(ENTETE)
    lecteur.ligne(ligne("3640;18090", "20050105", "", "4.0"))
    lecteur.ligne(ligne("3640;18090", "2005", "1.0", "4.0"))
    lecteur.ligne("")
    const serie = lecteur.series.get("3640;18090")!.get(2005)!
    expect(serie.tmin[caseDuJour(1, 5)]).toBe(ABSENT)
    expect(serie.tmax[caseDuJour(1, 5)]).toBe(40)
    expect(lecteur.bilan().lignesGardees).toBe(1)
  })
})

describe("séries stockées", () => {
  it("convertit les dixièmes en degrés", () => {
    expect(versDegres([65, -34, ABSENT, 0])).toEqual([6.5, -3.4, null, 0])
  })

  it("complète une année sans effacer ce qui est déjà là", () => {
    const ancienne = { tmin: anneeVide(), tmax: anneeVide() }
    ancienne.tmin[0] = 10
    ancienne.tmin[1] = 20
    const recente = { tmin: anneeVide(), tmax: anneeVide() }
    recente.tmin[1] = 25
    recente.tmin[2] = 30
    const fusion = fusionnerSerie(ancienne, recente)
    expect(fusion.tmin.slice(0, 4)).toEqual([10, 25, 30, ABSENT])
    expect(fusion.tmin).toHaveLength(CASES_ANNEE)
    expect(fusionnerSerie(null, recente).tmin[2]).toBe(30)
  })

  it("construit l'adresse du fichier d'une année", () => {
    expect(urlAnneeSafran(2005)).toBe(
      "https://meteofrance.s3.sbg.io.cloud.ovh.net/data/REF_CC/SIM/QUOT_SIM2_2005.csv.gz"
    )
  })
})
