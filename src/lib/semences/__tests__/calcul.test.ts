import { describe, it, expect } from 'vitest'
import { calculerBesoin } from '../calcul'

describe('calculerBesoin', () => {
  describe('mode graine_directe', () => {
    it("calcule besoin_g = surface × dose × (1 + marge)", () => {
      const r = calculerBesoin({
        mode: 'graine_directe',
        surfaceM2: 10,
        nbPlants: 0,
        doseGParM2: 6, // épinard
        margeSecuritePct: 15,
        stockGrammes: 0,
      })
      expect(r.besoinGrammes).toBe(69) // 10 × 6 × 1.15
      expect(r.besoinCaieux).toBe(0)
      expect(r.statut).toBe('MISSING') // stock 0, besoin > 0
    })

    it("retourne IGNORE si dose ou surface manquent (besoin = 0)", () => {
      const r = calculerBesoin({
        mode: 'graine_directe',
        surfaceM2: 0,
        nbPlants: 0,
        doseGParM2: 6,
        margeSecuritePct: 15,
      })
      expect(r.besoinGrammes).toBe(0)
      expect(r.statut).toBe('IGNORE') // pas d'ail-à-0g-stock-300-OK
    })

    it("retourne LOW si stock < besoin", () => {
      const r = calculerBesoin({
        mode: 'graine_directe',
        surfaceM2: 10,
        nbPlants: 0,
        doseGParM2: 6,
        stockGrammes: 50,
      })
      expect(r.besoinGrammes).toBeGreaterThan(50)
      expect(r.statut).toBe('LOW')
    })
  })

  describe('mode plant_repique', () => {
    it("calcule besoin_g = nb_plants / graines_par_g × (1 + marge)", () => {
      const r = calculerBesoin({
        mode: 'plant_repique',
        surfaceM2: 5,
        nbPlants: 100,
        grainesParGramme: 325, // tomate
        margeSecuritePct: 15,
        stockGrammes: 0,
      })
      // 100 / 325 × 1.15 ≈ 0.3538
      expect(r.besoinGrammes).toBeCloseTo(0.35, 1)
      expect(r.statut).toBe('MISSING')
    })

    it("retourne IGNORE si aucun plant n'est demandé même avec stock énorme", () => {
      // Cas tomate audit : 0 plants requis mais 300 g en stock → ne doit
      // JAMAIS être marquée OK, doit être IGNORE (ligne masquée).
      const r = calculerBesoin({
        mode: 'plant_repique',
        surfaceM2: 0,
        nbPlants: 0,
        grainesParGramme: 325,
        stockGrammes: 300,
      })
      expect(r.besoinGrammes).toBe(0)
      expect(r.statut).toBe('IGNORE')
    })

    it("retourne OK si stock ≥ besoin", () => {
      const r = calculerBesoin({
        mode: 'plant_repique',
        surfaceM2: 5,
        nbPlants: 100,
        grainesParGramme: 325,
        stockGrammes: 5,
      })
      expect(r.statut).toBe('OK')
    })
  })

  describe('mode bulbe_caieu', () => {
    it("ne calcule pas en grammes — retourne un besoin en caieux", () => {
      // Cas ail audit : 200 plants demandés sur 16 m², "Graines/g = -",
      // "Graines nécessaires = 0 g, OK" → faux.
      // Désormais : 200 plants → 230 caieux (200 × 1.15).
      const r = calculerBesoin({
        mode: 'bulbe_caieu',
        surfaceM2: 16,
        nbPlants: 200,
        grainesParGramme: null,
        margeSecuritePct: 15,
        stockUnites: 0,
      })
      expect(r.besoinGrammes).toBe(0)
      expect(r.besoinCaieux).toBe(230)
      expect(r.statut).toBe('MISSING')
    })

    it("retourne OK quand le stock de caieux couvre le besoin", () => {
      const r = calculerBesoin({
        mode: 'bulbe_caieu',
        surfaceM2: 16,
        nbPlants: 200,
        stockUnites: 250,
      })
      expect(r.statut).toBe('OK')
      expect(r.manqueCaieux).toBe(0)
    })

    it("ne renvoie pas MISSING quand 0 plants demandés", () => {
      const r = calculerBesoin({
        mode: 'bulbe_caieu',
        surfaceM2: 0,
        nbPlants: 0,
        stockUnites: 0,
      })
      expect(r.statut).toBe('IGNORE')
    })
  })

  describe('robustesse', () => {
    it("ne plante pas si mode est null (fallback graine_directe)", () => {
      const r = calculerBesoin({
        mode: null,
        surfaceM2: 5,
        nbPlants: 0,
        doseGParM2: 1,
      })
      expect(r.mode).toBe('graine_directe')
      expect(r.besoinGrammes).toBeGreaterThan(0)
    })

    it("clamp les valeurs négatives à 0 (jamais de besoin négatif)", () => {
      const r = calculerBesoin({
        mode: 'graine_directe',
        surfaceM2: -5,
        nbPlants: -3,
        doseGParM2: 6,
        stockGrammes: -10,
      })
      expect(r.besoinGrammes).toBe(0)
      expect(r.stockGrammes).toBe(0)
      expect(r.statut).toBe('IGNORE')
    })
  })
})
