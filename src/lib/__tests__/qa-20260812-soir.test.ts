/**
 * Régressions de la campagne QA du 2026-08-12 (soir).
 *
 * Un test par défaut réellement observé en production, avec les chiffres du
 * signalement — pour qu'une régression échoue sur la valeur qui avait été
 * montrée à l'utilisateur, pas sur une approximation.
 */

import { describe, expect, it, vi } from 'vitest'

import { arrondiQuantiteStock } from '@/lib/stocks/agregation'
import { construireImpayees } from '@/lib/comptabilite/impayees'
import { consommationHebdoTotale } from '@/lib/irrigation/consommation'
import { formatRendement } from '@/lib/validations/espece'
import { peutAjouterCulture, calculerLargeurOccupee } from '@/lib/planche-validation'
import { alertesAssociations } from '@/lib/associations-alertes'

describe('cmsqlr6jb — quantité de stock arrondie', () => {
  it('rend 10,8 kg pour les quatre récoltes de tomate de la démo', () => {
    // 4.8 + 4.8 + 0.5 + 0.7 vaut 10.799999999999999 en flottant.
    expect(arrondiQuantiteStock(4.8 + 4.8 + 0.5 + 0.7)).toBe(10.8)
  })

  it('ne déforme pas les valeurs déjà propres et neutralise NaN', () => {
    expect(arrondiQuantiteStock(0.1 + 0.2)).toBe(0.3)
    expect(arrondiQuantiteStock(15)).toBe(15)
    expect(arrondiQuantiteStock(5_559)).toBe(5_559)
    expect(arrondiQuantiteStock(NaN)).toBe(0)
  })

  it('garde le gramme : on arrondit l’affichage, on ne tronque pas la donnée', () => {
    expect(arrondiQuantiteStock(0.125)).toBe(0.125)
  })
})

describe('cmsqlqcuq / cmsqmbfxs — créances impayées', () => {
  // Jeu de données réel du compte de démonstration au 2026-08-12.
  const factures = [
    { id: 21, type: 'facture', statut: 'emise', date: '2026-07-26', numero: 'F-2026-0001', clientNom: 'Restaurant La Table du Bocage', totalTTC: 1111.24 },
    { id: 22, type: 'facture', statut: 'emise', date: '2026-07-26', numero: 'F-2026-0002', clientNom: 'AMAP', totalTTC: 143 },
    { id: 27, type: 'avoir', statut: 'emise', date: '2026-08-11', numero: 'AV-2026-0001', totalTTC: 14.3, factureOrigineId: 22 },
    { id: 31, type: 'avoir', statut: 'emise', date: '2026-08-12', numero: 'AV-2026-0002', totalTTC: 16.5, factureOrigineId: 21 },
  ]
  const ventes = [
    { id: 98, date: '2026-07-26', type: 'fromage', description: 'Tomme de chèvre', prixTotal: 1111.24, factureId: 21 },
  ]

  it('déduit les avoirs et ne compte pas deux fois une vente déjà facturée', () => {
    const { items, total } = construireImpayees({ factures, ventes })

    // L'écran affichait 2 365,48 € là où le Bilan affichait 1 223,44 €.
    expect(total).toBe(1223.44)
    expect(items).toHaveLength(2)
    expect(items.map((i) => i.montant)).toEqual([1094.74, 128.7])
    expect(items.some((i) => i.source === 'VenteProduit')).toBe(false)
  })

  it('garde une vente impayée qui n’est portée par aucune facture', () => {
    const { items, total } = construireImpayees({
      factures: [],
      ventes: [{ id: 99, date: '2026-08-01', type: 'oeufs', prixTotal: 86.4, factureId: null }],
    })
    expect(items).toHaveLength(1)
    expect(total).toBe(86.4)
  })

  it('retire une facture intégralement soldée par un avoir', () => {
    const { items, total } = construireImpayees({
      factures: [
        { id: 1, type: 'facture', statut: 'emise', date: '2026-01-01', totalTTC: 100 },
        { id: 2, type: 'avoir', statut: 'emise', date: '2026-01-02', totalTTC: 100, factureOrigineId: 1 },
      ],
    })
    expect(items).toHaveLength(0)
    expect(total).toBe(0)
  })
})

describe('cmsqlstoi — consommation d’irrigation dédoublonnée par planche', () => {
  it('compte une planche multiculture une seule fois, au besoin le plus exigeant', () => {
    const cultures = [
      { id: 1, plancheId: 'A1', consommationEauSemaine: 473.8 },
      { id: 2, plancheId: 'A1', consommationEauSemaine: 300 },
      { id: 3, plancheId: 'A2', consommationEauSemaine: 503.4 },
    ]
    // Somme brute = 1 277,2 L ; règle de la planche = 473,8 + 503,4 = 977,2 L.
    expect(consommationHebdoTotale(cultures)).toBe(977)
  })

  it('compte une culture hors planche pour elle-même', () => {
    expect(
      consommationHebdoTotale([
        { id: 7, plancheId: null, consommationEauSemaine: 120 },
        { id: 8, plancheId: null, consommationEauSemaine: 80 },
      ]),
    ).toBe(200)
  })

  it('rend 0 sur un ensemble vide', () => {
    expect(consommationHebdoTotale([])).toBe(0)
  })
})

describe('cmsqlu3os — rendement affiché avec son unité', () => {
  it('étiquette les fruitiers en kg/arbre', () => {
    expect(formatRendement(150, 'kg_arbre')).toBe('150,0 kg/arbre')
    expect(formatRendement(80, 'kg_arbre')).toBe('80,0 kg/arbre')
  })

  it('garde kg/m² pour le maraîchage et pour les lignes sans unité', () => {
    expect(formatRendement(3.5, 'kg_m2')).toBe('3,5 kg/m²')
    expect(formatRendement(4, null)).toBe('4,0 kg/m²')
  })

  it('gère les engrais verts et l’absence de valeur', () => {
    expect(formatRendement(2.5, 'biomasse_t_ha')).toBe('2,5 t/ha')
    expect(formatRendement(null, 'kg_arbre')).toBe('-')
  })
})

describe('cmsqla9c2 — occupation de planche sans espacement inventé', () => {
  const planche = { largeur: 0.8, longueur: 10 }

  it('accepte 4 rangs quand l’espacement réel de l’itinéraire technique le permet', () => {
    // 16 cm entre rangs : (4-1) × 0,16 = 0,48 m ≤ 0,60 m disponible.
    const res = peutAjouterCulture(planche, [], { nbRangs: 4, espacementRangs: 16, longueur: 10 })
    expect(res.possible).toBe(true)
  })

  it('refuse toujours quand l’espacement connu ne tient pas', () => {
    // 30 cm entre rangs : (4-1) × 0,30 = 0,90 m > 0,60 m disponible.
    const res = peutAjouterCulture(planche, [], { nbRangs: 4, espacementRangs: 30, longueur: 10 })
    expect(res.possible).toBe(false)
    expect(res.message).toContain('Largeur insuffisante')
  })

  it('ne gonfle pas l’occupation d’une culture voisine d’espacement inconnu', () => {
    // Auparavant comptée à 30 cm inventés : (4-1) × 0,30 = 0,90 m d'emprise.
    expect(calculerLargeurOccupee({ nbRangs: 4, espacementRangs: null })).toBe(0.1)
  })
})

describe('cmsqlhv0c — justification des associations', () => {
  /** Entrée en étoile : une espèce pivot (`requise`) et ses compagnes. */
  const association = {
    id: 'cml1gbc6g001e2vbmbo7wx13z',
    nom: 'Chou brocoli +',
    type: 'favorable',
    description: null,
    notes: null,
    details: [
      { especeId: 'Chou brocoli', requise: true },
      { especeId: 'Concombre', requise: false },
      { especeId: 'Oignon', requise: false },
    ],
  }
  const tx = (associations: unknown[]) =>
    ({ association: { findMany: vi.fn().mockResolvedValue(associations) } }) as never

  it('n’affirme rien sur un couple de deux compagnes', async () => {
    // « Chou brocoli + » ne dit rien du couple concombre ↔ oignon.
    await expect(alertesAssociations(tx([association]), ['Concombre', 'Oignon'])).resolves.toEqual([])
  })

  it('affirme bien le couple qui contient le pivot', async () => {
    const res = await alertesAssociations(tx([association]), ['Chou brocoli', 'Concombre'])
    expect(res).toHaveLength(1)
    expect(res[0].type).toBe('favorable')
    expect(res[0].especes.sort()).toEqual(['chou brocoli', 'concombre'])
  })

  it('n’invente pas d’incompatibilité entre deux compagnes d’un antagoniste', async () => {
    // « Fenouil ! » est incompatible avec l'épinard ET le concombre ; il ne dit
    // rien du couple épinard ↔ concombre.
    const fenouil = {
      ...association,
      id: 'cml1gbcgr00252vbmmo94nbeg',
      nom: 'Fenouil !',
      type: 'incompatible',
      details: [
        { especeId: 'Fenouil', requise: true },
        { especeId: 'Épinard', requise: false },
        { especeId: 'Concombre', requise: false },
      ],
    }
    await expect(alertesAssociations(tx([fenouil]), ['Épinard', 'Concombre'])).resolves.toEqual([])
  })

  it('conserve le comportement des entrées sans pivot (vrais couples à deux)', async () => {
    const couple = {
      ...association,
      id: 'asso-ail-carotte',
      nom: 'Ail Carotte +',
      details: [
        { especeId: 'Ail', requise: false },
        { especeId: 'Carotte', requise: false },
      ],
    }
    const res = await alertesAssociations(tx([couple]), ['Ail', 'Carotte'])
    expect(res).toHaveLength(1)
  })
})
