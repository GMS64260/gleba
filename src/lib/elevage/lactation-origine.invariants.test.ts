import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { projeterLactation } from "./lactation-origine"

const GRAINE = 0x20261118
const NOMBRE_CAS = 320
const maintenant = new Date("2026-11-18T12:00:00Z")
const avant = (jours: number) => new Date(maintenant.getTime() - jours * 86_400_000)
function generateur() {
  let etat = GRAINE
  return (max: number) => {
    etat = (Math.imul(etat, 1664525) + 1013904223) >>> 0
    return etat % max
  }
}

beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(maintenant) })
afterEach(() => vi.useRealTimers())

describe(`Provenance de lactation — graine 0x${GRAINE.toString(16)}, ${NOMBRE_CAS} cas par propriété`, () => {
  it("sans mise-bas, aucune série observée ne devient un âge certain ni une suggestion", () => {
    const entier = generateur()
    for (let i = 0; i < NOMBRE_CAS; i++) {
      const jours = 14 + entier(292)
      const mesures = entier(15)
      const collectes = [
        { date: avant(jours), quantiteLitres: entier(10000) / 1000 },
        ...Array.from({ length: mesures }, (_, j) => ({ date: avant(mesures - j - 1), quantiteLitres: entier(1000) / 1000 })),
      ]
      const resultat = projeterLactation({ collectes, lactationLongue: entier(2) === 1 })
      expect(resultat, `cas ${i}`).toMatchObject({
        origineLactation: "premiere_collecte", dimEstime: true,
        dateOrigine: avant(jours), dim: jours, suggererTarissement: false,
      })
      expect(resultat.courbe.length).toBeGreaterThan(0)
      expect(resultat.courbe[0].volume).toBe(collectes[0].quantiteLitres)
    }
  })

  it("sans aucune origine, l’horloge et le mode de conduite ne fabriquent pas de date ni d’âge", () => {
    const entier = generateur()
    for (let i = 0; i < NOMBRE_CAS; i++) {
      vi.setSystemTime(avant(entier(2000)))
      const resultat = projeterLactation({ collectes: [], lactationLongue: entier(2) === 1 })
      expect(resultat, `cas ${i}`).toMatchObject({
        origineLactation: "inconnue", dimEstime: false, dim: null, courbe: [], suggererTarissement: false,
      })
      expect(resultat.dateOrigine).toBeUndefined()
    }
  })

  it("sensibilité : retirer la mise-bas supprime une suggestion qui aurait été déclenchée par l’âge", () => {
    // Témoin de sensibilité : les mêmes séries, sans lactation longue, déclenchent
    // réellement chacune des deux branches historiques (>270 j ou >60 j et <0,5 L).
    // Enlever la garde de provenance ferait échouer ce test ; tout mettre à false aussi.
    const entier = generateur()
    for (let i = 0; i < NOMBRE_CAS; i++) {
      const jours = i % 2 === 0 ? 271 + entier(35) : 61 + entier(210)
      const faible = i % 2 === 1
      const collectes = [
        { date: avant(jours), quantiteLitres: 2 },
        ...[2, 1, 0].map((j) => ({ date: avant(j), quantiteLitres: faible ? entier(499) / 1000 : 1 + entier(20) })),
      ]
      const connue = projeterLactation({ derniereMiseBas: avant(jours), collectes, lactationLongue: false })
      const estimee = projeterLactation({ collectes, lactationLongue: false })
      expect(connue, `cas connu ${i}`).toMatchObject({ origineLactation: "mise_bas", dimEstime: false, dim: jours, suggererTarissement: true })
      expect(estimee, `cas estimé ${i}`).toMatchObject({ origineLactation: "premiere_collecte", dimEstime: true, dim: jours, suggererTarissement: false })
      expect(estimee.courbe).toEqual(connue.courbe)
      expect(estimee.moyenne7j).toEqual(connue.moyenne7j)
    }
  })
})
