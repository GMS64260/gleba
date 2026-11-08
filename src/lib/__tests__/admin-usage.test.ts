import { describe, expect, it } from "vitest"
import {
  GROUPES_USAGE,
  SOURCES_USAGE,
  buildBuckets,
  classerSegment,
  lireModulesActifs,
  sqlSaisies,
  startOfBucket,
} from "@/lib/admin-usage"
import { MODULE_IDS } from "@/lib/modules"

describe("classerSegment", () => {
  const base = { inscritDepuisJours: 100, joursActifsTotal: 20, semainesActives4: 0, joursDepuisDerniere: 10 }

  it("un compte de 14 jours ou moins est nouveau, quoi qu'il fasse", () => {
    expect(classerSegment({ ...base, inscritDepuisJours: 14, semainesActives4: 4 })).toBe("nouveau")
    expect(classerSegment({ ...base, inscritDepuisJours: 3, joursActifsTotal: 0, joursDepuisDerniere: null })).toBe("nouveau")
  })

  it("régulier dès 3 semaines actives sur les 4 dernières", () => {
    expect(classerSegment({ ...base, semainesActives4: 3 })).toBe("regulier")
    expect(classerSegment({ ...base, semainesActives4: 2 })).toBe("occasionnel")
  })

  it("un seul jour d'activité, ou aucun : jamais revenu", () => {
    expect(classerSegment({ ...base, joursActifsTotal: 1, joursDepuisDerniere: 90 })).toBe("jamais_revenu")
    expect(classerSegment({ ...base, joursActifsTotal: 0, joursDepuisDerniere: null })).toBe("jamais_revenu")
  })

  it("revenu puis absent plus de 30 jours : décroché", () => {
    expect(classerSegment({ ...base, joursDepuisDerniere: 30 })).toBe("occasionnel")
    expect(classerSegment({ ...base, joursDepuisDerniere: 31 })).toBe("decroche")
  })
})

describe("lireModulesActifs", () => {
  it("préférence absente, illisible ou vide = tous les modules (comme l'app)", () => {
    expect(lireModulesActifs(null)).toEqual(MODULE_IDS)
    expect(lireModulesActifs("pas du json")).toEqual(MODULE_IDS)
    expect(lireModulesActifs("[]")).toEqual(MODULE_IDS)
    expect(lireModulesActifs('{"a":1}')).toEqual(MODULE_IDS)
  })

  it("garde les seuls identifiants connus", () => {
    expect(lireModulesActifs('["verger","inconnu","elevage"]')).toEqual(["verger", "elevage"])
  })
})

describe("sources d'usage", () => {
  it("chaque source appartient à un groupe connu et chaque table n'apparaît qu'une fois", () => {
    const groupes = new Set(GROUPES_USAGE.map((g) => g.id))
    for (const s of SOURCES_USAGE) expect(groupes.has(s.groupe)).toBe(true)
    const tables = SOURCES_USAGE.map((s) => s.table)
    expect(new Set(tables).size).toBe(tables.length)
  })

  it("chaque module métier a au moins une source", () => {
    for (const m of MODULE_IDS) expect(SOURCES_USAGE.some((s) => s.groupe === m)).toBe(true)
  })

  it("le SQL lie les identifiants en paramètres et écarte miroirs comptables et données d'exemple", () => {
    const q = sqlSaisies(["u1", "u2"])
    expect(q.text).not.toContain("u1")
    expect(q.values.every((v) => Array.isArray(v) && v.join() === "u1,u2")).toBe(true)
    expect(q.text).toContain("FROM ventes_manuelles WHERE user_id = ANY($")
    expect(q.text).toMatch(/FROM ventes_manuelles WHERE user_id = ANY\(\$\d+\) AND auto = false/)
    expect(q.text).toMatch(/FROM depenses_manuelles WHERE user_id = ANY\(\$\d+\) AND auto = false/)
    expect(q.text).toContain("nom NOT IN ('Planche A', 'Planche B')")
    expect(q.text).toContain("'Pommier Golden', 'Cerisier Burlat'")
    expect(q.text).not.toContain("operations_bancaires")
  })
})

describe("périodes", () => {
  it("la semaine commence le lundi (ISO), en UTC", () => {
    // dimanche 8 novembre 2026 → lundi 2 novembre
    expect(startOfBucket(new Date("2026-11-08T22:00:00Z"), "week").toISOString().slice(0, 10)).toBe("2026-11-02")
    expect(startOfBucket(new Date("2026-11-08T22:00:00Z"), "month").toISOString().slice(0, 10)).toBe("2026-11-01")
  })

  it("liste continue de buckets, bornes incluses", () => {
    const b = buildBuckets(new Date("2026-10-01T00:00:00Z"), new Date("2026-11-08T00:00:00Z"), "month")
    expect(b).toEqual(["2026-10-01", "2026-11-01"])
    expect(buildBuckets(new Date("2026-11-02T00:00:00Z"), new Date("2026-11-08T00:00:00Z"), "week")).toEqual(["2026-11-02"])
  })
})
