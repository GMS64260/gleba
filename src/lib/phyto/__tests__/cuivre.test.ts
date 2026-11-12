import { describe, it, expect } from 'vitest'
import {
  isProduitCuivre,
  evaluerDoseCuivre,
  cumuleParParcelle,
  PLAFOND_CU_KG_HA_AN,
  PLAFOND_CU_KG_HA_7ANS,
  type TraitementCuivreInput,
} from '../cuivre'

/** kg de cuivre métal, null quand l'apport ne se calcule pas. */
const doseCuivreMetalKg = (t: TraitementCuivreInput) => evaluerDoseCuivre(t).kg

describe('isProduitCuivre', () => {
  it('détecte le flag explicite contientCuivre', () => {
    expect(isProduitCuivre({ contientCuivre: true })).toBe(true)
  })

  it('détecte par classification Chimique cuivré', () => {
    expect(isProduitCuivre({ classification: 'Chimique cuivré' })).toBe(true)
  })

  it('détecte Bouillie bordelaise par le nom', () => {
    expect(isProduitCuivre({ nomCommercial: 'Bouillie bordelaise RSR' })).toBe(true)
  })

  it('détecte par substance active "Hydroxyde de cuivre"', () => {
    expect(isProduitCuivre({ substanceActive: 'Hydroxyde de cuivre 30%' })).toBe(true)
  })

  it('refuse un produit non cuivré', () => {
    expect(isProduitCuivre({ nomCommercial: 'Savon noir', classification: 'Biocontrôle' })).toBe(false)
    expect(isProduitCuivre(null)).toBe(false)
    expect(isProduitCuivre(undefined)).toBe(false)
  })
})

describe('doseCuivreMetalKg', () => {
  it('Bouillie bordelaise 5 kg/ha sur 2 ha → 2 kg Cu métal (20% par défaut)', () => {
    const cu = doseCuivreMetalKg({
      date: new Date('2026-04-08'),
      parcelleId: 'P1',
      surfaceHa: 2,
      doseAppliquee: 5,
      uniteDose: 'kg/ha',
      volumeBouillieLHa: null,
      produit: { nomCommercial: 'Bouillie bordelaise', cuivreMetalPct: 20 },
    })
    // 5 × 2 = 10 kg produit, × 20% = 2 kg Cu
    expect(cu).toBeCloseTo(2, 2)
  })

  it("Hydroxyde de cuivre 30%, 3 kg/ha sur 1 ha → 0.9 kg Cu", () => {
    const cu = doseCuivreMetalKg({
      date: new Date('2026-05-01'),
      parcelleId: 'P1',
      surfaceHa: 1,
      doseAppliquee: 3,
      uniteDose: 'kg/ha',
      volumeBouillieLHa: null,
      produit: { contientCuivre: true, cuivreMetalPct: 30 },
    })
    expect(cu).toBeCloseTo(0.9, 2)
  })

  it("retourne 0 si le produit n'est pas cuivré", () => {
    const cu = doseCuivreMetalKg({
      date: new Date('2026-04-08'),
      parcelleId: 'P1',
      surfaceHa: 2,
      doseAppliquee: 5,
      uniteDose: 'kg/ha',
      volumeBouillieLHa: null,
      produit: { nomCommercial: 'Savon noir' },
    })
    expect(cu).toBe(0)
  })

  // DEV3 audit fix — uniteDose pris en compte
  it("g/L (concentration bouillie) × volumeBouillieLHa convertit en kg produit", () => {
    // 50 g/L de Bouillie 20% Cu dans 500 L/ha de bouillie sur 1 ha :
    // 50 × 500 / 1000 = 25 kg produit × 1 ha = 25 kg produit × 20% = 5 kg Cu
    const cu = doseCuivreMetalKg({
      date: new Date('2026-04-08'),
      parcelleId: 'P1',
      surfaceHa: 1,
      doseAppliquee: 50,
      uniteDose: 'g/L',
      volumeBouillieLHa: 500,
      produit: { contientCuivre: true, cuivreMetalPct: 20 },
    })
    expect(cu).toBeCloseTo(5, 1)
  })

  // Revue réglementaire du 2026-11-12 (C6) : ce test attendait 0, ce qui
  // sommait l'apport comme nul et laissait le statut « OK ». Un apport
  // incalculable n'est pas un apport nul.
  it("g/L sans volume bouillie → incalculable (null), pas 0", () => {
    const cu = doseCuivreMetalKg({
      date: new Date('2026-04-08'),
      parcelleId: 'P1',
      surfaceHa: 1,
      doseAppliquee: 50,
      uniteDose: 'g/L',
      volumeBouillieLHa: null,
      produit: { contientCuivre: true, cuivreMetalPct: 20 },
    })
    expect(cu).toBeNull()
  })

  // C6 : ce test validait « L/ha équivaut à kg/ha » sans le dire. Le calcul
  // reste possible, mais l'hypothèse de densité est désormais nommée.
  it("L/ha avec une teneur massique : calculé avec l'hypothèse de densité nommée", () => {
    const dose = evaluerDoseCuivre({
      date: new Date('2026-04-08'),
      parcelleId: 'P1',
      surfaceHa: 2,
      doseAppliquee: 5,
      uniteDose: 'L/ha',
      volumeBouillieLHa: null,
      produit: { contientCuivre: true, cuivreMetalPct: 20 },
    })
    expect(dose.kg).toBeCloseTo(2, 1)
    expect(dose.hypotheses).toEqual(['densite_supposee'])
  })

  it("L/ha avec une teneur en g de cuivre par litre : exact, sans hypothèse", () => {
    const dose = evaluerDoseCuivre({
      date: new Date('2026-04-08'), parcelleId: 'P1', surfaceHa: 2, doseAppliquee: 5, uniteDose: 'L/ha',
      volumeBouillieLHa: null, produit: { contientCuivre: true, cuivreMetalGParUnite: 200 },
    })
    // 5 L/ha × 2 ha = 10 L × 200 g/L = 2 kg
    expect(dose).toEqual({ kg: 2, hypotheses: [] })
  })

  it("composition non renseignée : 20 % supposés et nommés", () => {
    const dose = evaluerDoseCuivre({
      date: new Date('2026-04-08'), parcelleId: 'P1', surfaceHa: 1, doseAppliquee: 5, uniteDose: 'kg/ha',
      volumeBouillieLHa: null, produit: { nomCommercial: 'Bouillie bordelaise' },
    })
    expect(dose.kg).toBeCloseTo(1, 3)
    expect(dose.hypotheses).toEqual(['composition_supposee'])
  })

  it("unité inconnue ou absente : incalculable, plus jamais lue comme des kg/ha", () => {
    const base = { date: new Date('2026-04-08'), parcelleId: 'P1', surfaceHa: 1, doseAppliquee: 3, volumeBouillieLHa: 500, produit: { contientCuivre: true, cuivreMetalPct: 20 } }
    expect(doseCuivreMetalKg({ ...base, uniteDose: 'pulvérisateurs' })).toBeNull()
    expect(doseCuivreMetalKg({ ...base, uniteDose: '' })).toBeNull()
    expect(doseCuivreMetalKg({ ...base, uniteDose: null })).toBeNull()
  })

  it("g/ha divise par 1000 pour obtenir kg produit", () => {
    const cu = doseCuivreMetalKg({
      date: new Date('2026-04-08'),
      parcelleId: 'P1',
      surfaceHa: 1,
      doseAppliquee: 5000,
      uniteDose: 'g/ha',
      volumeBouillieLHa: null,
      produit: { contientCuivre: true, cuivreMetalPct: 20 },
    })
    // 5000 g/ha × 1 ha / 1000 = 5 kg × 20% = 1 kg Cu
    expect(cu).toBeCloseTo(1, 2)
  })

  // QA cmsogea5w (a) — l'arrondi à 3 décimales PAR LIGNE faisait tomber à 0
  // une intervention réellement dosée sur petite surface (1,5 L/ha × 9,6 m²).
  it("ne tronque plus à 0 une dose faible non nulle (1,5 L/ha × 9,6 m²)", () => {
    const cu = doseCuivreMetalKg({
      date: new Date('2026-04-08'),
      parcelleId: 'P1',
      surfaceHa: 0.00096, // 9,6 m²
      doseAppliquee: 1.5,
      uniteDose: 'L/ha',
      volumeBouillieLHa: null,
      produit: { contientCuivre: true, cuivreMetalPct: 20 },
    })
    // 1,5 × 0,00096 = 0,00144 kg produit × 20% = 0,000288 kg Cu
    expect(cu).toBeGreaterThan(0)
    expect(cu).toBeCloseTo(0.000288, 6)
  })

  // QA cmsogea5w (b) — quantités absolues des opérations d'arbres (« 3 kg »
  // de bouillie sur un arbre) : pas de dose/ha ni de surface.
  it("gère les quantités absolues kg/L/g sans surface (opérations d'arbres)", () => {
    const base = {
      date: new Date('2026-04-08'),
      parcelleId: 'P1',
      surfaceHa: null,
      volumeBouillieLHa: null,
      produit: { nomCommercial: 'Bouillie bordelaise' }, // 20% par défaut
    }
    // 3 kg × 20% = 0.6 kg Cu
    expect(doseCuivreMetalKg({ ...base, doseAppliquee: 3, uniteDose: 'kg' })).toBeCloseTo(0.6, 3)
    // 2 L ≈ 2 kg × 20% = 0.4 kg Cu : deux hypothèses, dites (C6)
    expect(evaluerDoseCuivre({ ...base, doseAppliquee: 2, uniteDose: 'L' })).toEqual({ kg: 0.4, hypotheses: ['composition_supposee', 'densite_supposee'] })
    // 500 g = 0.5 kg × 20% = 0.1 kg Cu
    expect(doseCuivreMetalKg({ ...base, doseAppliquee: 500, uniteDose: 'g' })).toBeCloseTo(0.1, 3)
  })

  // C6 : null (incalculable) au lieu de 0, qui se confondait avec « aucun cuivre ».
  it('retourne null si surface ou dose manquantes', () => {
    expect(
      doseCuivreMetalKg({
        date: new Date(),
        parcelleId: 'P1',
        surfaceHa: null,
        doseAppliquee: 5,
        uniteDose: 'kg/ha',
        volumeBouillieLHa: null,
        produit: { contientCuivre: true },
      })
    ).toBeNull()
    expect(
      doseCuivreMetalKg({
        date: new Date(),
        parcelleId: 'P1',
        surfaceHa: 1,
        doseAppliquee: 0,
        uniteDose: 'kg/ha',
        volumeBouillieLHa: null,
        produit: { contientCuivre: true },
      })
    ).toBeNull()
  })
})

describe('cumuleParParcelle', () => {
  const surfaces = new Map([['P1', 2], ['P2', 1]])
  const bouillie = { contientCuivre: true, cuivreMetalPct: 20 }

  it('cumule sur l\'année courante par parcelle', () => {
    const traitements = [
      {
        date: new Date('2026-04-08'),
        parcelleId: 'P1',
        surfaceHa: 2,
        doseAppliquee: 5,
        uniteDose: 'kg/ha',
        volumeBouillieLHa: null,
        produit: bouillie,
      },
      {
        date: new Date('2026-05-12'),
        parcelleId: 'P1',
        surfaceHa: 2,
        doseAppliquee: 3,
        uniteDose: 'kg/ha',
        volumeBouillieLHa: null,
        produit: bouillie,
      },
      {
        date: new Date('2026-04-15'),
        parcelleId: 'P2',
        surfaceHa: 1,
        doseAppliquee: 2,
        uniteDose: 'kg/ha',
        volumeBouillieLHa: null,
        produit: bouillie,
      },
    ]
    const cumuls = cumuleParParcelle(traitements, surfaces, new Date('2026-06-01'))
    const p1 = cumuls.find((c) => c.parcelleId === 'P1')!
    const p2 = cumuls.find((c) => c.parcelleId === 'P2')!
    // P1 : 5+3 = 8 kg produit × 2 ha × 20% = 3.2 kg Cu => 1.6 kg/ha/an
    expect(p1.cumulAnnuelKg).toBeCloseTo(3.2, 2)
    expect(p1.cuivreKgParHaAn).toBeCloseTo(1.6, 2)
    // P2 : 2 × 1 × 20% = 0.4 kg Cu => 0.4 kg/ha/an
    expect(p2.cumulAnnuelKg).toBeCloseTo(0.4, 2)
    expect(p2.statut).toBe('ok')
  })

  it('alerte warn à 75% du plafond annuel', () => {
    // 4 kg/ha/an × 0.75 = 3 kg/ha → 6 kg sur 2 ha
    const traitements = [
      {
        date: new Date('2026-04-01'),
        parcelleId: 'P1',
        surfaceHa: 2,
        doseAppliquee: 15, // 15 kg × 2 ha × 20% = 6 kg Cu = 3 kg/ha
        uniteDose: 'kg/ha',
        volumeBouillieLHa: null,
        produit: bouillie,
      },
    ]
    const cumuls = cumuleParParcelle(traitements, surfaces, new Date('2026-06-01'))
    const p1 = cumuls.find((c) => c.parcelleId === 'P1')!
    expect(p1.cuivreKgParHaAn).toBeCloseTo(3, 2)
    expect(p1.statut).toBe('warn')
  })

  it('alerte alert à 100% du plafond annuel', () => {
    const traitements = [
      {
        date: new Date('2026-04-01'),
        parcelleId: 'P1',
        surfaceHa: 2,
        doseAppliquee: 20, // 20 × 2 × 20% = 8 kg Cu = 4 kg/ha
        uniteDose: 'kg/ha',
        volumeBouillieLHa: null,
        produit: bouillie,
      },
    ]
    const cumuls = cumuleParParcelle(traitements, surfaces, new Date('2026-06-01'))
    const p1 = cumuls.find((c) => c.parcelleId === 'P1')!
    expect(p1.cuivreKgParHaAn).toBeCloseTo(PLAFOND_CU_KG_HA_AN, 2)
    expect(p1.statut).toBe('alert')
  })

  it("cumul 7 ans glissants : inclut les 7 dernières années jusqu'au jour", () => {
    const traitements = [
      // Vieux 2017 : exclu (>7 ans avant 2026-05-14)
      {
        date: new Date('2017-04-01'),
        parcelleId: 'P1',
        surfaceHa: 2,
        doseAppliquee: 10,
        uniteDose: 'kg/ha',
        volumeBouillieLHa: null,
        produit: bouillie,
      },
      // Inclus
      {
        date: new Date('2020-04-01'),
        parcelleId: 'P1',
        surfaceHa: 2,
        doseAppliquee: 10,
        uniteDose: 'kg/ha',
        volumeBouillieLHa: null,
        produit: bouillie,
      },
      {
        date: new Date('2026-04-01'),
        parcelleId: 'P1',
        surfaceHa: 2,
        doseAppliquee: 5,
        uniteDose: 'kg/ha',
        volumeBouillieLHa: null,
        produit: bouillie,
      },
    ]
    const cumuls = cumuleParParcelle(traitements, surfaces, new Date('2026-05-14'))
    const p1 = cumuls.find((c) => c.parcelleId === 'P1')!
    // 7 ans glissants : 2020 (10×2×0.2 = 4) + 2026 (5×2×0.2 = 2) = 6 kg Cu / 2 ha = 3 kg/ha
    expect(p1.cumul7ansKg).toBeCloseTo(6, 2)
    expect(p1.cuivreKgParHa7ans).toBeCloseTo(3, 2)
    // Plafond 7 ans = 28 kg/ha → 3 kg/ha = OK
    expect(p1.statut).toBe('ok')
  })

  // QA cmsogea5w (a) — une ligne à dose faible non nulle était arrondie à 0
  // par ligne, donc classée à tort « sans dose ni surface ».
  it('somme une dose faible non nulle au lieu de la classer « sans dose »', () => {
    const traitements = [
      {
        date: new Date('2026-04-08'),
        parcelleId: 'P1',
        surfaceHa: 0.00096, // 9,6 m²
        doseAppliquee: 1.5,
        uniteDose: 'L/ha',
        volumeBouillieLHa: null,
        produit: bouillie,
      },
    ]
    const cumuls = cumuleParParcelle(traitements, surfaces, new Date('2026-06-01'))
    const p1 = cumuls.find((c) => c.parcelleId === 'P1')!
    expect(p1.nbTraitementsAn).toBe(1)
    expect(p1.nbTraitements7ans).toBe(1)
    expect(p1.nbTraitementsCuivreSansDose7ans).toBe(0)
  })

  // QA cmsogea5w (b) — une opération d'arbre cuivrée en quantité absolue
  // (« Bouillie bordelaise 3 kg ») doit être comptée dans le cumul.
  it("compte une opération d'arbre cuivrée en quantité absolue", () => {
    const traitements = [
      {
        date: new Date('2026-04-08'),
        parcelleId: 'P1',
        surfaceHa: null,
        doseAppliquee: 3,
        uniteDose: 'kg',
        volumeBouillieLHa: null,
        produit: { nomCommercial: 'Bouillie bordelaise' },
      },
    ]
    const cumuls = cumuleParParcelle(traitements, surfaces, new Date('2026-06-01'))
    const p1 = cumuls.find((c) => c.parcelleId === 'P1')!
    // 3 kg × 20% (défaut) = 0.6 kg Cu sur P1 (2 ha) → 0.3 kg/ha
    expect(p1.cumulAnnuelKg).toBeCloseTo(0.6, 3)
    expect(p1.nbTraitementsAn).toBe(1)
    expect(p1.nbTraitementsCuivreSansDose7ans).toBe(0)
  })

  it('plafond 7 ans (28 kg/ha) dimensionne aussi l\'alerte', () => {
    // 1 traitement énorme 14 kg/ha cette année
    const traitements = [
      {
        date: new Date('2026-04-01'),
        parcelleId: 'P1',
        surfaceHa: 1,
        doseAppliquee: 70, // 70 × 1 × 20% = 14 kg Cu, mais surface 1 ha → 14 kg/ha
        uniteDose: 'kg/ha',
        volumeBouillieLHa: null,
        produit: bouillie,
      },
    ]
    const cumuls = cumuleParParcelle(traitements, new Map([['P1', 1]]), new Date('2026-06-01'))
    const p1 = cumuls.find((c) => c.parcelleId === 'P1')!
    // 14/4 = 350% annuel = alert
    expect(p1.statut).toBe('alert')
    // 14/28 = 50% 7ans
    expect(p1.cuivreKgParHa7ans / PLAFOND_CU_KG_HA_7ANS).toBeCloseTo(0.5, 2)
  })

  it("sans surface connue, du cuivre apporté n'est jamais « OK » (revue du 2026-11-04)", () => {
    const traitements = [
      {
        date: new Date('2026-05-02'),
        parcelleId: '__sans_parcelle__',
        surfaceHa: 0.05,
        doseAppliquee: 60,
        uniteDose: 'kg/ha',
        volumeBouillieLHa: null,
        produit: bouillie,
      },
    ]
    const cumuls = cumuleParParcelle(traitements, new Map(), new Date('2026-06-01'))
    const c = cumuls.find((x) => x.parcelleId === '__sans_parcelle__')!
    // 60 kg/ha × 0,05 ha × 20 % = 0,6 kg de cuivre apporté.
    expect(c.cumulAnnuelKg).toBeCloseTo(0.6, 3)
    expect(c.statut).toBe('inconnu')
  })

  it('une parcelle sans surface et sans cuivre reste « OK »', () => {
    const traitements = [
      {
        date: new Date('2026-05-02'),
        parcelleId: 'P9',
        surfaceHa: 0.05,
        doseAppliquee: 2,
        uniteDose: 'L/ha',
        volumeBouillieLHa: null,
        produit: { nomCommercial: 'Purin d\'ortie' },
      },
    ]
    const cumuls = cumuleParParcelle(traitements, new Map(), new Date('2026-06-01'))
    expect(cumuls.find((x) => x.parcelleId === 'P9')?.statut ?? 'ok').toBe('ok')
  })

  // Revue réglementaire du 2026-11-12 (C6).
  describe('cumul partiel ou estimé', () => {
    const cu = { contientCuivre: true, cuivreMetalPct: 20 }
    const ligne = (t: Partial<TraitementCuivreInput>): TraitementCuivreInput => ({
      date: new Date('2026-04-08'), parcelleId: 'P1', surfaceHa: 1, doseAppliquee: 5, uniteDose: 'kg/ha', volumeBouillieLHa: null, produit: cu, ...t,
    })

    it('un apport en g/L sans volume de bouillie rend le statut indéterminé, pas « OK »', () => {
      const [p] = cumuleParParcelle([ligne({}), ligne({ doseAppliquee: 50, uniteDose: 'g/L' })], new Map([['P1', 1]]), new Date('2026-06-01'))
      expect(p.cumulAnnuelKg).toBeCloseTo(1, 3)
      expect(p.partiel).toBe(true)
      expect(p.nbTraitementsCuivreSansDose7ans).toBe(1)
      expect(p.statut).toBe('indetermine')
    })

    it('un seul apport incalculable : indéterminé, même sans aucun kilo compté', () => {
      const [p] = cumuleParParcelle([ligne({ uniteDose: 'pulvérisateurs' })], new Map([['P1', 1]]), new Date('2026-06-01'))
      expect(p.cumulAnnuelKg).toBe(0)
      expect(p.statut).toBe('indetermine')
    })

    it('un dépassement déjà atteint par le cumul connu reste un dépassement', () => {
      const [p] = cumuleParParcelle([ligne({ doseAppliquee: 25 }), ligne({ doseAppliquee: null })], new Map([['P1', 1]]), new Date('2026-06-01'))
      expect(p.partiel).toBe(true)
      expect(p.statut).toBe('alert')
    })

    it('une hypothèse de calcul donne « estime » au lieu de « ok », et elle est listée', () => {
      const [p] = cumuleParParcelle([ligne({ uniteDose: 'L/ha', produit: { nomCommercial: 'Bouillie bordelaise' } })], new Map([['P1', 1]]), new Date('2026-06-01'))
      expect(p.statut).toBe('estime')
      expect(p.hypotheses).toEqual(['composition_supposee', 'densite_supposee'])
    })

    it('un calcul exact sous les repères reste « ok », sans hypothèse', () => {
      const [p] = cumuleParParcelle([ligne({})], new Map([['P1', 1]]), new Date('2026-06-01'))
      expect(p).toMatchObject({ statut: 'ok', partiel: false, hypotheses: [] })
    })

    it('les traitements non cuivrés ne créent pas de ligne', () => {
      expect(cumuleParParcelle([ligne({ produit: { nomCommercial: 'Savon noir' } })], new Map([['P1', 1]]), new Date('2026-06-01'))).toEqual([])
    })
  })
})
