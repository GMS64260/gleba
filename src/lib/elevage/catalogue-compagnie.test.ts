/**
 * Garde-fous du catalogue compagnie/équin/NAC : ce référentiel est saisi à la
 * main, les erreurs qu'on attrape ici sont celles qui casseraient l'UI
 * (libellé d'espèce manquant → id brut affiché) ou le seed (id/race en double).
 */

import { describe, it, expect } from "vitest"
import {
  ESPECES_COMPAGNIE,
  RACES_COMPAGNIE,
  racesCatalogue,
  totalRacesCatalogue,
} from "@/lib/elevage/catalogue-compagnie"
import { especeBaseId, especeBaseLabel, libellePetit } from "@/lib/elevage/espece-base"
import { isFiliere } from "@/lib/elevage/filiere"

const TYPES = ["volaille", "mammifere_petit", "mammifere_grand", "autre"]

describe("catalogue compagnie/équin/NAC — espèces", () => {
  it("n'a aucun id en double", () => {
    const ids = ESPECES_COMPAGNIE.map((e) => e.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("respecte la convention d'id (minuscules, sans accent ni espace)", () => {
    for (const e of ESPECES_COMPAGNIE) {
      expect(e.id, e.id).toMatch(/^[a-z][a-z0-9_]*$/)
    }
  })

  it("déclare une filière valide, jamais 'rente'", () => {
    for (const e of ESPECES_COMPAGNIE) {
      expect(isFiliere(e.filiere), e.id).toBe(true)
      expect(e.filiere, e.id).not.toBe("rente")
    }
  })

  it("déclare un type d'espèce connu de l'UI", () => {
    for (const e of ESPECES_COMPAGNIE) {
      expect(TYPES, e.id).toContain(e.type)
    }
  })

  it("expose un libellé FR pour chaque espèce de base (sinon l'UI affiche l'id)", () => {
    for (const e of ESPECES_COMPAGNIE) {
      const base = especeBaseId(e.id)
      expect(especeBaseLabel(e.id), `libellé manquant pour « ${base} » dans espece-base.ts`).not.toBe(base)
    }
  })

  it("expose le vocabulaire du petit pour chaque espèce de base", () => {
    for (const e of ESPECES_COMPAGNIE) {
      const { s, p } = libellePetit(e.id)
      expect(s, `libellePetit manquant pour « ${especeBaseId(e.id)} »`).not.toBe("petit")
      expect(p).not.toBe("petits")
    }
  })

  it("renseigne gestation OU couvaison, jamais les deux", () => {
    for (const e of ESPECES_COMPAGNIE) {
      const repro = [e.dureeGestation, e.dureeCouvaison].filter((d) => d != null)
      expect(repro.length, e.id).toBeLessThanOrEqual(1)
    }
  })

  it("donne une gestation aux mammifères et une incubation aux ovipares", () => {
    for (const e of ESPECES_COMPAGNIE) {
      if (e.type.startsWith("mammifere")) {
        expect(e.dureeGestation, e.id).toBeGreaterThan(0)
        expect(e.dureeCouvaison, e.id).toBeUndefined()
      }
    }
  })

  it("utilise une couleur UI au format #RRGGBB", () => {
    for (const e of ESPECES_COMPAGNIE) {
      if (e.couleur) expect(e.couleur, e.id).toMatch(/^#[0-9a-fA-F]{6}$/)
    }
  })

  it("couvre les trois filières optionnelles", () => {
    for (const f of ["compagnie", "equin", "nac"]) {
      expect(ESPECES_COMPAGNIE.some((e) => e.filiere === f), f).toBe(true)
    }
  })
})

describe("catalogue compagnie/équin/NAC — races", () => {
  it("ne rattache des races qu'à des espèces du catalogue", () => {
    const ids = new Set(ESPECES_COMPAGNIE.map((e) => e.id))
    for (const especeId of Object.keys(RACES_COMPAGNIE)) {
      expect(ids.has(especeId), `race rattachée à l'espèce inconnue « ${especeId} »`).toBe(true)
    }
  })

  it("n'a aucun nom de race en double par espèce (contrainte unique en base)", () => {
    for (const [especeId, races] of Object.entries(RACES_COMPAGNIE)) {
      const noms = races.map((r) => r.nom)
      const doublons = noms.filter((n, i) => noms.indexOf(n) !== i)
      expect(doublons, `doublons pour ${especeId}`).toEqual([])
    }
  })

  it("nomme chaque race de façon non vide", () => {
    for (const [especeId, races] of Object.entries(RACES_COMPAGNIE)) {
      for (const race of races) {
        expect(race.nom.trim(), especeId).not.toBe("")
      }
    }
  })

  it("propose des races pour chaque espèce du catalogue", () => {
    for (const e of ESPECES_COMPAGNIE) {
      expect(racesCatalogue(e.id).length, `aucune race pour ${e.id}`).toBeGreaterThan(0)
    }
  })

  it("renvoie une liste vide pour une espèce inconnue", () => {
    expect(racesCatalogue("licorne")).toEqual([])
  })

  it("compte les mêmes associations que la somme des listes", () => {
    const somme = ESPECES_COMPAGNIE.reduce((n, e) => n + racesCatalogue(e.id).length, 0)
    expect(totalRacesCatalogue()).toBe(somme)
  })
})
