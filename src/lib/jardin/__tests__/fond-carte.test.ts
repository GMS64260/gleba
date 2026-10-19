import { describe, expect, it } from "vitest"

import {
  CLE_CALQUES_CARTE,
  CLE_FOND_CARTE,
  calquesCarte,
  choixAffiche,
  coucheCarte,
  enregistrerChoixCalques,
  fondCarte,
  lireChoixCalques,
  memesCalques,
  type ChoixCalques,
  type StockageCalques,
} from "@/lib/jardin/fond-carte"

/** Double de localStorage qui trace les écritures. */
function stockage(initial: Record<string, string> = {}) {
  const valeurs = new Map(Object.entries(initial))
  const ecritures: Array<[string, string]> = []
  const s: StockageCalques = {
    getItem: (cle) => valeurs.get(cle) ?? null,
    setItem: (cle, valeur) => {
      ecritures.push([cle, valeur])
      valeurs.set(cle, String(valeur))
    },
  }
  return { s, valeurs, ecritures }
}

/** Stockage plein ou refusé : toute écriture lève, comme QuotaExceededError. */
const stockagePlein: StockageCalques = {
  getItem: () => null,
  setItem: () => {
    throw new Error("QuotaExceededError")
  },
}

/** Lecture refusée (SecurityError d'un navigateur qui bloque le stockage). */
const stockageRefuse: StockageCalques = {
  getItem: () => {
    throw new Error("SecurityError")
  },
  setItem: () => {
    throw new Error("SecurityError")
  },
}

const OSM_CADASTRE: ChoixCalques = { fond: "OpenStreetMap", calques: ["Cadastre IGN"] }

describe("lecture du choix de fond", () => {
  it("restaure le fond et les calques enregistrés", () => {
    const { s } = stockage({ [CLE_FOND_CARTE]: "Satellite IGN", [CLE_CALQUES_CARTE]: '["Cadastre IGN"]' })
    expect(lireChoixCalques(s)).toEqual({ fond: "Satellite IGN", calques: ["Cadastre IGN"] })
  })

  it("lit un libellé avec ses espaces de bord, tel que le contrôle l'écrivait", () => {
    const { s } = stockage({ [CLE_FOND_CARTE]: " Plan IGN " })
    expect(lireChoixCalques(s).fond).toBe("Plan IGN")
  })

  it("replie sur OpenStreetMap pour un fond inconnu, absent ou mal cassé", () => {
    expect(lireChoixCalques(stockage({ [CLE_FOND_CARTE]: "Google Satellite" }).s).fond).toBe("OpenStreetMap")
    expect(lireChoixCalques(stockage({ [CLE_FOND_CARTE]: "satellite ign" }).s).fond).toBe("OpenStreetMap")
    expect(lireChoixCalques(stockage().s).fond).toBe("OpenStreetMap")
  })

  it("écarte les calques inconnus, les doublons et un JSON illisible", () => {
    expect(lireChoixCalques(stockage({ [CLE_CALQUES_CARTE]: '["Cadastre IGN","Cadastre IGN","Routes"]' }).s).calques).toEqual([
      "Cadastre IGN",
    ])
    expect(lireChoixCalques(stockage({ [CLE_CALQUES_CARTE]: "{pas du json" }).s).calques).toEqual([])
    expect(lireChoixCalques(stockage({ [CLE_CALQUES_CARTE]: '"Cadastre IGN"' }).s).calques).toEqual([])
  })

  it("replie sur le défaut sans stockage ou si la lecture est refusée", () => {
    expect(lireChoixCalques(null)).toEqual({ fond: "OpenStreetMap", calques: [] })
    expect(lireChoixCalques(stockageRefuse)).toEqual({ fond: "OpenStreetMap", calques: [] })
  })
})

describe("catalogue des couches", () => {
  it("reconnaît fonds et calques par leur nom exact, rien d'autre", () => {
    expect(fondCarte("Satellite IGN")).toBe("Satellite IGN")
    expect(fondCarte("Cadastre IGN")).toBeNull()
    expect(fondCarte(42)).toBeNull()
    expect(coucheCarte(" Cadastre IGN")).toBe("Cadastre IGN")
    expect(coucheCarte("Inconnu")).toBeNull()
    expect(calquesCarte(null)).toEqual([])
    expect(memesCalques(["Cadastre IGN"], ["Cadastre IGN"])).toBe(true)
    expect(memesCalques([], ["Cadastre IGN"])).toBe(false)
  })
})

describe("ce qui est coché l'emporte sur ce que la carte montre", () => {
  it("retient le fond coché même si Leaflet ne l'a pas appliqué (coche posée sans événement)", () => {
    const coche = { fond: "Satellite IGN" as const, calques: ["Cadastre IGN" as const] }
    const carte = { fond: "OpenStreetMap" as const, calques: ["Cadastre IGN" as const] }
    expect(choixAffiche(coche, carte)).toEqual(coche)
  })

  it("garde le fond de la carte quand aucun fond n'est coché ou que le contrôle est absent", () => {
    const carte = { fond: "Plan IGN" as const, calques: [] }
    expect(choixAffiche({ fond: null, calques: ["Cadastre IGN"] }, carte)).toEqual({ fond: "Plan IGN", calques: ["Cadastre IGN"] })
    expect(choixAffiche(null, carte)).toEqual(carte)
  })
})

describe("enregistrement du choix", () => {
  it("écrit le fond changé, sans réécrire des calques inchangés", () => {
    const { s, ecritures } = stockage()
    const r = enregistrerChoixCalques(s, { fond: "Satellite IGN", calques: ["Cadastre IGN"] }, OSM_CADASTRE)
    expect(ecritures).toEqual([[CLE_FOND_CARTE, "Satellite IGN"]])
    expect(r).toEqual({ connu: { fond: "Satellite IGN", calques: ["Cadastre IGN"] }, ecrits: ["fond"], echec: false })
  })

  it("un clic sur le Cadastre ne réécrit pas le fond choisi dans un autre onglet", () => {
    const { s, valeurs } = stockage({ [CLE_FOND_CARTE]: "Satellite IGN" })
    // Cet onglet a restauré OSM + Cadastre ; un autre a depuis enregistré Satellite.
    const r = enregistrerChoixCalques(s, { fond: "OpenStreetMap", calques: [] }, OSM_CADASTRE)
    expect(valeurs.get(CLE_FOND_CARTE)).toBe("Satellite IGN")
    expect(valeurs.get(CLE_CALQUES_CARTE)).toBe("[]")
    expect(r.ecrits).toEqual(["calques"])
  })

  it("n'écrit rien quand rien n'a changé (onglet resté ouvert, sortie de page)", () => {
    const { s, ecritures } = stockage()
    const r = enregistrerChoixCalques(s, { fond: "OpenStreetMap", calques: ["Cadastre IGN"] }, OSM_CADASTRE)
    expect(ecritures).toEqual([])
    expect(r.ecrits).toEqual([])
    expect(r.echec).toBe(false)
  })

  it("n'écrit rien pour une carte sans fond (démontage en cours)", () => {
    const { s, ecritures } = stockage()
    const r = enregistrerChoixCalques(s, { fond: null, calques: [] }, OSM_CADASTRE)
    expect(ecritures).toEqual([])
    expect(r.connu).toEqual(OSM_CADASTRE)
  })

  it("normalise les calques écrits (ordre du catalogue, sans inconnu)", () => {
    const { s, valeurs } = stockage()
    enregistrerChoixCalques(
      s,
      { fond: "OpenStreetMap", calques: ["Cadastre IGN", "Cadastre IGN"] },
      { fond: "OpenStreetMap", calques: [] },
    )
    expect(valeurs.get(CLE_CALQUES_CARTE)).toBe('["Cadastre IGN"]')
  })

  it("signale l'échec d'un stockage plein et garde l'ancien choix connu pour réessayer", () => {
    const r = enregistrerChoixCalques(stockagePlein, { fond: "Satellite IGN", calques: ["Cadastre IGN"] }, OSM_CADASTRE)
    expect(r.echec).toBe(true)
    expect(r.ecrits).toEqual([])
    expect(r.connu).toEqual(OSM_CADASTRE)
    expect(enregistrerChoixCalques(null, { fond: "Plan IGN", calques: [] }, OSM_CADASTRE).echec).toBe(true)
  })

  it("aller-retour : ce qui est enregistré est relu à l'identique", () => {
    const { s } = stockage()
    for (const fond of ["Satellite IGN", "Plan IGN", "OpenStreetMap"] as const) {
      const r = enregistrerChoixCalques(s, { fond, calques: [] }, lireChoixCalques(s))
      expect(r.echec).toBe(false)
      expect(lireChoixCalques(s)).toEqual({ fond, calques: [] })
    }
  })

  it("ne modifie pas le choix connu passé en argument", () => {
    const connu: ChoixCalques = { fond: "OpenStreetMap", calques: ["Cadastre IGN"] }
    enregistrerChoixCalques(stockage().s, { fond: "Plan IGN", calques: [] }, connu)
    expect(connu).toEqual({ fond: "OpenStreetMap", calques: ["Cadastre IGN"] })
  })
})
