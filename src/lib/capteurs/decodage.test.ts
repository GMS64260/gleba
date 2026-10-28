import { describe, expect, it } from "vitest"
import { aplatir, CLES_MAX, extrairePosition, LONGUEUR_CLE_MAX, lireCorrespondances, regleDe, resoudreMesures } from "./decodage"

describe("aplatir", () => {
  it("joint les clés imbriquées et lit les nombres écrits en texte", () => {
    expect(aplatir({ a: 1, b: { c: "2.5", d: { e: -3 } } })).toEqual([
      ["a", 1],
      ["b.c", 2.5],
      ["b.d.e", -3],
    ])
  })

  it("laisse de côté textes non numériques, booléens, tableaux et null", () => {
    expect(aplatir({ Distance: "1234 mm", ok: true, l: [1, 2], n: null, s: "Temperature Sensor", v: Number.NaN })).toEqual([])
  })

  it("ne lit rien d'une charge absente", () => {
    expect(aplatir(undefined)).toEqual([])
    expect(aplatir("texte")).toEqual([])
  })

  it(`borne la charge : ${CLES_MAX} clés au plus, clés de ${LONGUEUR_CLE_MAX} caractères au plus`, () => {
    const grosse = Object.fromEntries(Array.from({ length: 100 }, (_, i) => [`k${i}`, i]))
    expect(aplatir(grosse)).toHaveLength(CLES_MAX)
    expect(aplatir({ ["x".repeat(LONGUEUR_CLE_MAX + 1)]: 1, court: 2 })).toEqual([["court", 2]])
  })
})

describe("extrairePosition", () => {
  it("lit latitude et longitude d'un traceur", () => {
    expect(extrairePosition({ latitude: 43.1, longitude: -0.4 })).toEqual({ lat: 43.1, lng: -0.4 })
    expect(extrairePosition({ lat: "43.1", lon: "-0.4" })).toEqual({ lat: 43.1, lng: -0.4 })
  })

  it("refuse 0,0 (pas de fix) et les coordonnées impossibles", () => {
    expect(extrairePosition({ latitude: 0, longitude: 0 })).toBeNull()
    expect(extrairePosition({ latitude: 95, longitude: 2 })).toBeNull()
    expect(extrairePosition({ latitude: 43.1 })).toBeNull()
  })
})

describe("resoudreMesures", () => {
  it("applique le profil du modèle : la `temperature` d'une sonde de sol est celle du sol", () => {
    const r = resoudreMesures([["temperature", 14.2], ["moisture", 31.5]], { modele: "milesight-iot/em500-smtc" })
    expect(r.mesures.map((m) => [m.grandeur, m.valeur, m.unite])).toEqual([
      ["temperature_sol", 14.2, "°C"],
      ["humidite_sol", 31.5, "%"],
    ])
    expect(r.inconnues).toEqual([])
  })

  it("sans profil, une clé ambiguë n'est pas devinée : `temperature`, `battery`, `weight` attendent", () => {
    const r = resoudreMesures([["temperature", 14.2], ["battery", 3.6], ["weight", 5000]], { modele: null })
    expect(r.mesures).toEqual([])
    expect(r.inconnues).toEqual(["temperature", "battery", "weight"])
  })

  it("le dictionnaire commun ne lit que des noms au sens et à l'unité explicites", () => {
    const r = resoudreMesures([["relative_humidity", 64], ["soil_temperature", 11], ["BatV", 3.6]], {})
    expect(r.mesures.map((m) => m.grandeur)).toEqual(["humidite_air", "temperature_sol", "tension_batterie"])
  })

  it("la correspondance saisie prime sur le profil, et null fait ignorer la clé", () => {
    const r = resoudreMesures([["temperature", 14.2], ["moisture", 31.5]], {
      modele: "milesight-iot/em500-smtc",
      correspondances: { temperature: "temperature_air", moisture: null },
    })
    expect(r.mesures.map((m) => m.grandeur)).toEqual(["temperature_air"])
    expect(r.inconnues).toEqual([])
  })

  it("accepte une grandeur Gleba nommée telle quelle pour le format générique seulement", () => {
    const r = resoudreMesures([["tension_sol", 35]], { nomsGleba: true })
    expect(r.mesures).toEqual([{ cle: "tension_sol", grandeur: "tension_sol", valeur: 35, unite: "kPa" }])
    // Un décodeur TTN qui rendrait `distance` en cm n'a pas signé l'unité de Gleba.
    expect(resoudreMesures([["distance", 82]], {}).inconnues).toEqual(["distance"])
  })

  it("rend inconnue une clé qu'aucune règle ne reconnaît, sans la deviner", () => {
    const r = resoudreMesures([["TempC_DS", 21], ["Bat_status", 3]], { modele: "dragino/lht65n" })
    expect(r.mesures).toEqual([])
    expect(r.inconnues).toEqual(["TempC_DS", "Bat_status"])
  })

  it("refuse une valeur hors bornes au lieu de la corriger (pression en Pa prise pour des hPa)", () => {
    const r = resoudreMesures([["barometric_pressure", 101325]], {})
    expect(r.mesures).toEqual([])
    expect(r.refus).toEqual([{ cle: "barometric_pressure", valeur: 101325, raison: "hors bornes (300 à 1100 hPa)" }])
  })

  it("une grandeur fournie deux fois dans la trame garde la première clé", () => {
    const r = resoudreMesures([["relative_humidity", 60], ["humidite_air", 61]], { nomsGleba: true })
    expect(r.mesures.map((m) => [m.cle, m.valeur])).toEqual([["relative_humidity", 60]])
    expect(r.refus[0].cle).toBe("humidite_air")
  })

  it("les clés du prototype ne sont pas des règles", () => {
    const r = resoudreMesures([["constructor", 1], ["toString", 2]], { modele: "toString", correspondances: {} })
    expect(r.inconnues).toEqual(["constructor", "toString"])
  })

  it("les clés de position ne sont ni des mesures ni des inconnues", () => {
    const r = resoudreMesures([["latitude", 43.1], ["longitude", -0.4]], {})
    expect(r).toEqual({ mesures: [], inconnues: [], refus: [] })
  })
})

describe("regleDe", () => {
  it("dit d'où vient la règle, pour que l'écran la montre", () => {
    expect(regleDe("moisture", "milesight-iot/em500-smtc", {})).toMatchObject({ grandeur: "humidite_sol", source: "profil" })
    expect(regleDe("moisture", "milesight-iot/em500-smtc", { moisture: "humidite_air" })).toMatchObject({ source: "manuelle" })
    expect(regleDe("soil_moisture", null, {})).toMatchObject({ source: "dictionnaire" })
    expect(regleDe("tension_sol", null, {}, true)).toMatchObject({ source: "grandeur" })
    expect(regleDe("tension_sol", null, {})).toBeUndefined()
    expect(regleDe("moisture", null, { moisture: null })).toBeNull()
    expect(regleDe("moisture", null, {})).toBeUndefined()
  })
})

describe("lireCorrespondances", () => {
  it("ne garde que les grandeurs connues et les null", () => {
    expect(lireCorrespondances({ a: "humidite_sol", b: null, c: "inventee", d: 3 })).toEqual({ a: "humidite_sol", b: null })
    expect(lireCorrespondances(null)).toEqual({})
    expect(lireCorrespondances(["a"])).toEqual({})
  })
})
