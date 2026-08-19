import { describe, expect, it } from "vitest"

import {
  isAvisFiltre,
  retenuParAvis,
  SEUIL_RECOMMANDEE,
  whereZoneCultivable,
} from "@/lib/especes/filtres"
import { adequationEspece } from "@/lib/adequation-zone"
import { ZONES_CLIMAT, type ZoneClimat } from "@/lib/terroir"

/**
 * Évalue la condition Prisma produite par `whereZoneCultivable` sur une espèce,
 * en n'implémentant que les opérateurs réellement utilisés. Permet de vérifier
 * que le filtre SQL et le badge d'adéquation disent la même chose.
 */
type Espece = { zonesAdaptees: string | null; besoinFroid: string | null }

/** Sous-ensemble de conditions Prisma que ce test sait interpréter. */
type Condition = {
  OR?: Condition[]
  AND?: Condition[]
  zonesAdaptees?: string | null | { startsWith?: string; endsWith?: string; contains?: string }
  besoinFroid?: string | null | { notIn?: string[] }
}

function evalue(cond: Condition, espece: Espece): boolean {
  if (cond.OR) return cond.OR.some((c) => evalue(c, espece))
  if (cond.AND) return cond.AND.every((c) => evalue(c, espece))

  if ("zonesAdaptees" in cond) {
    const v = espece.zonesAdaptees
    const c = cond.zonesAdaptees
    if (c === null) return v === null
    if (typeof c === "string") return v === c
    if (c.startsWith !== undefined) return v != null && v.startsWith(c.startsWith)
    if (c.endsWith !== undefined) return v != null && v.endsWith(c.endsWith)
    if (c.contains !== undefined) return v != null && v.includes(c.contains)
  }
  if ("besoinFroid" in cond) {
    const v = espece.besoinFroid
    const c = cond.besoinFroid
    if (c === null) return v === null
    if (c.notIn) return v == null || !c.notIn.includes(v)
  }
  throw new Error(`Opérateur non géré : ${JSON.stringify(cond)}`)
}

describe("whereZoneCultivable", () => {
  it("garde les espèces sans liste blanche en métropole", () => {
    const cond = whereZoneCultivable("oceanique")
    expect(evalue(cond, { zonesAdaptees: null, besoinFroid: null })).toBe(true)
    expect(evalue(cond, { zonesAdaptees: null, besoinFroid: "eleve" })).toBe(true)
  })

  it("écarte les espèces réservées à d'autres zones", () => {
    const cond = whereZoneCultivable("oceanique")
    expect(evalue(cond, { zonesAdaptees: "equatorial,tropical_antilles", besoinFroid: null })).toBe(false)
  })

  it("ne confond pas une zone avec une zone de nom plus long", () => {
    // « oceanique » ne doit pas matcher « oceanique_altere » et inversement.
    const oceanique = whereZoneCultivable("oceanique")
    expect(evalue(oceanique, { zonesAdaptees: "oceanique_altere", besoinFroid: null })).toBe(false)
    const altere = whereZoneCultivable("oceanique_altere")
    expect(evalue(altere, { zonesAdaptees: "oceanique_altere", besoinFroid: null })).toBe(true)
    expect(evalue(altere, { zonesAdaptees: "oceanique", besoinFroid: null })).toBe(false)
  })

  it("reconnaît un jeton en tête, en fin et au milieu du CSV", () => {
    const cond = whereZoneCultivable("tropical_austral")
    expect(evalue(cond, { zonesAdaptees: "tropical_austral,equatorial", besoinFroid: null })).toBe(true)
    expect(evalue(cond, { zonesAdaptees: "equatorial,tropical_austral", besoinFroid: null })).toBe(true)
    expect(evalue(cond, { zonesAdaptees: "equatorial,tropical_austral,tropical_antilles", besoinFroid: null })).toBe(true)
    expect(evalue(cond, { zonesAdaptees: "tropical_austral", besoinFroid: null })).toBe(true)
  })

  it("écarte sous les tropiques les espèces exigeant du froid hivernal", () => {
    const cond = whereZoneCultivable("equatorial")
    expect(evalue(cond, { zonesAdaptees: null, besoinFroid: "eleve" })).toBe(false)
    expect(evalue(cond, { zonesAdaptees: null, besoinFroid: "modere" })).toBe(false)
    expect(evalue(cond, { zonesAdaptees: null, besoinFroid: "faible" })).toBe(true)
    expect(evalue(cond, { zonesAdaptees: null, besoinFroid: null })).toBe(true)
    // Une liste blanche explicite prime sur le besoin de froid.
    expect(evalue(cond, { zonesAdaptees: "equatorial", besoinFroid: "eleve" })).toBe(true)
  })

  it("dit exactement la même chose que le badge d'adéquation", () => {
    const especes: Espece[] = [
      { zonesAdaptees: null, besoinFroid: null },
      { zonesAdaptees: null, besoinFroid: "eleve" },
      { zonesAdaptees: null, besoinFroid: "faible" },
      { zonesAdaptees: "oceanique", besoinFroid: null },
      { zonesAdaptees: "equatorial,tropical_austral", besoinFroid: null },
      { zonesAdaptees: "oceanique_altere,montagnard", besoinFroid: "modere" },
    ]
    for (const zone of ZONES_CLIMAT as readonly ZoneClimat[]) {
      const cond = whereZoneCultivable(zone)
      for (const espece of especes) {
        const badge = adequationEspece({ ...espece, userZone: zone })
        expect(evalue(cond, espece)).toBe(badge.statut !== "peu_adaptee")
      }
    }
  })
})

describe("retenuParAvis", () => {
  const stats = (o: Partial<{ nbAvis: number; noteMoyenne: number | null; tauxReprise: number | null }>) => ({
    nbAvis: o.nbAvis ?? 1,
    noteMoyenne: o.noteMoyenne ?? null,
    tauxReprise: o.tauxReprise ?? null,
    scoreCommunautaire: null,
    badgeTerrain: false,
  })

  it("écarte une espèce sans aucun avis", () => {
    expect(retenuParAvis(undefined, "avec")).toBe(false)
    expect(retenuParAvis(stats({ nbAvis: 0 }), "avec")).toBe(false)
    expect(retenuParAvis(stats({ nbAvis: 0, noteMoyenne: 5 }), "note4")).toBe(false)
  })

  it("retient toute espèce notée pour « avec »", () => {
    expect(retenuParAvis(stats({ nbAvis: 1 }), "avec")).toBe(true)
  })

  it("applique les seuils de note", () => {
    expect(retenuParAvis(stats({ noteMoyenne: 3 }), "note3")).toBe(true)
    expect(retenuParAvis(stats({ noteMoyenne: 2.9 }), "note3")).toBe(false)
    expect(retenuParAvis(stats({ noteMoyenne: 4 }), "note4")).toBe(true)
    expect(retenuParAvis(stats({ noteMoyenne: 3.9 }), "note4")).toBe(false)
    // Une espèce notée uniquement via « je la replante » n'a pas de moyenne.
    expect(retenuParAvis(stats({ noteMoyenne: null }), "note4")).toBe(false)
  })

  it("applique le seuil de recommandation", () => {
    expect(retenuParAvis(stats({ tauxReprise: SEUIL_RECOMMANDEE }), "recommandees")).toBe(true)
    expect(retenuParAvis(stats({ tauxReprise: 0.5 }), "recommandees")).toBe(false)
    expect(retenuParAvis(stats({ tauxReprise: null }), "recommandees")).toBe(false)
  })
})

describe("isAvisFiltre", () => {
  it("valide les seules valeurs connues", () => {
    expect(isAvisFiltre("note4")).toBe(true)
    expect(isAvisFiltre("tous")).toBe(false)
    expect(isAvisFiltre(null)).toBe(false)
  })
})
