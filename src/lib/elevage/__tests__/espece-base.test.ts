import { describe, it, expect } from "vitest"
import { cleFiltreEspece, especeBaseId, especeBaseLabel, libelleEspeceAnimale, listEspecesBasePresentes, naitParEclosion } from "../espece-base"

describe("especeBaseId", () => {
  it("extrait l'espèce avant '_'", () => {
    expect(especeBaseId("poule_marans")).toBe("poule")
    expect(especeBaseId("brebis_lacaune")).toBe("brebis")
    expect(especeBaseId("vache_charolaise")).toBe("vache")
    expect(especeBaseId("cochon_culnoir_limousin")).toBe("cochon")
  })

  it("retombe sur l'id si pas de séparateur", () => {
    expect(especeBaseId("abeille")).toBe("abeille")
  })
})

describe("especeBaseLabel", () => {
  it("retourne le libellé FR", () => {
    expect(especeBaseLabel("poule_sussex")).toBe("Poule")
    expect(especeBaseLabel("chevre_alpine")).toBe("Chèvre")
    expect(especeBaseLabel("vache_normande")).toBe("Vache")
  })

  it("fallback sur la base brute si inconnu", () => {
    expect(especeBaseLabel("yak_himalaya")).toBe("yak")
  })
})

describe("listEspecesBasePresentes", () => {
  it("Bug #9 : ne renvoie pas les races (Lacaune, Sussex…), seulement les espèces de base", () => {
    const animaux = [
      { especeAnimaleId: "poule_marans" },
      { especeAnimaleId: "poule_sussex" },
      { especeAnimaleId: "brebis_lacaune" },
      { especeAnimaleId: "brebis_solognote" },
      { especeAnimaleId: "vache_charolaise" },
      { especeAnimaleId: "cochon_gascon" },
    ]
    const result = listEspecesBasePresentes(animaux)
    expect(result.map((r) => r.id)).toEqual(["brebis", "cochon", "poule", "vache"])
    expect(result.map((r) => r.label)).toEqual(["Brebis", "Cochon", "Poule", "Vache"])
  })

  it("liste vide si aucun animal", () => {
    expect(listEspecesBasePresentes([])).toEqual([])
  })

  it("dédoublonne", () => {
    const result = listEspecesBasePresentes([
      { especeAnimaleId: "poule_marans" },
      { especeAnimaleId: "poule_marans" },
      { especeAnimaleId: "poule_sussex" },
    ])
    expect(result).toHaveLength(1)
    expect(result[0].label).toBe("Poule")
  })

  it("trié par libellé FR (Brebis < Chèvre < Poule)", () => {
    const result = listEspecesBasePresentes([
      { especeAnimaleId: "poule_marans" },
      { especeAnimaleId: "chevre_alpine" },
      { especeAnimaleId: "brebis_solognote" },
    ])
    expect(result.map((r) => r.label)).toEqual(["Brebis", "Chèvre", "Poule"])
  })
})

describe("naitParEclosion (ticket cmv292a85)", () => {
  it("un lot de poules pondeuses, sans durée de couvaison transmise, éclot", () => {
    expect(naitParEclosion({ id: "poule_pondeuse" })).toBe(true)
    expect(naitParEclosion({ id: "Poule" })).toBe(true)
    expect(naitParEclosion({ id: "canard_coureur" })).toBe(true)
  })

  it("une durée de couvaison suffit, quelle que soit l'espèce", () => {
    expect(naitParEclosion({ id: "autre_oiseau", dureeCouvaison: 21 })).toBe(true)
  })

  it("les mammifères mettent bas", () => {
    expect(naitParEclosion({ id: "brebis_solognote", dureeCouvaison: null })).toBe(false)
    expect(naitParEclosion({ id: "chevre" })).toBe(false)
  })

  it("sans espèce, pas d'éclosion", () => {
    expect(naitParEclosion(null)).toBe(false)
    expect(naitParEclosion(undefined)).toBe(false)
  })
})

// Ticket cmvnookz7 (QA 2026-10-25) — profil perso « v8-Julien canard 25 octobre »
// (Volaille, Mixte), id `v8_julien_canard_25_octobre` : la colonne Espèce de
// la liste des lots affichait « v8 » (premier segment de l'id), le formulaire
// de ponte le nom complet.
describe("libelleEspeceAnimale (ticket cmvnookz7)", () => {
  const profilJulien = { id: "v8_julien_canard_25_octobre", nom: "v8-Julien canard 25 octobre" }

  it("un profil perso hors catalogue s'affiche sous son nom complet", () => {
    expect(libelleEspeceAnimale(profilJulien)).toBe("v8-Julien canard 25 octobre")
    expect(libelleEspeceAnimale({ id: "yak_himalaya", nom: "Yak de l'Himalaya" })).toBe("Yak de l'Himalaya")
  })

  it("une espèce du catalogue garde son espèce de base (la race a sa colonne)", () => {
    expect(libelleEspeceAnimale({ id: "poule_sussex", nom: "Poule Sussex" })).toBe("Poule")
    expect(libelleEspeceAnimale({ id: "chevre_alpine", nom: "Chèvre Alpine" })).toBe("Chèvre")
    expect(libelleEspeceAnimale({ id: "canard_barbarie_maison", nom: "Canard de Barbarie maison" })).toBe("Canard")
  })

  it("sans nom, retombe sur le premier segment de l'id", () => {
    expect(libelleEspeceAnimale({ id: "yak_himalaya" })).toBe("yak")
    expect(libelleEspeceAnimale({ id: "yak_himalaya", nom: "  " })).toBe("yak")
  })

  it("le filtre Espèce libelle le profil perso par son nom complet", () => {
    const result = listEspecesBasePresentes([
      { especeAnimaleId: profilJulien.id, especeNom: profilJulien.nom },
      { especeAnimaleId: "poule_marans", especeNom: "Poule Marans" },
    ])
    expect(result).toEqual([
      { id: "poule", label: "Poule" },
      { id: "v8_julien_canard_25_octobre", label: "v8-Julien canard 25 octobre" },
    ])
  })

  // Revue du ticket : deux profils perso au même premier mot fusionnaient
  // sous la base « mes » et le libellé ne nommait que le premier.
  it("deux profils perso au même premier mot restent deux entrées du filtre", () => {
    const result = listEspecesBasePresentes([
      { especeAnimaleId: "mes_poules", especeNom: "Mes poules" },
      { especeAnimaleId: "mes_canards", especeNom: "Mes canards" },
      { especeAnimaleId: "mes_poules", especeNom: "Mes poules" },
    ])
    expect(result).toEqual([
      { id: "mes_canards", label: "Mes canards" },
      { id: "mes_poules", label: "Mes poules" },
    ])
  })

  it("la clé du filtre (option et ligne) : espèce de base connue, sinon id complet du profil", () => {
    expect(cleFiltreEspece("poule_sussex")).toBe("poule")
    expect(cleFiltreEspece("poule_marans")).toBe("poule")
    expect(cleFiltreEspece("mes_poules")).toBe("mes_poules")
    expect(cleFiltreEspece("mes_canards")).toBe("mes_canards")
    expect(cleFiltreEspece("constructor_x")).toBe("constructor_x")
    expect(libelleEspeceAnimale({ id: "constructor_x", nom: "Profil x" })).toBe("Profil x")
  })
})
