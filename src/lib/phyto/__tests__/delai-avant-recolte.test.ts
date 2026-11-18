/**
 * Contre-revue CR-DAR-01 (2026-11-12) : classer un traitement « sans AMM »
 * faisait taire tout avertissement quand son délai avant récolte était
 * inconnu. Or la dispense d'AMM d'une substance de base ne dispense pas des
 * conditions de son approbation (règlement (CE) 1107/2009, art. 23 ; pour la
 * prêle, règlement d'exécution (UE) 462/2014 et son rapport d'examen
 * SANCO/12386/2013, qui fixe un délai pour certains usages).
 *
 * Quatre situations distinctes, sans jamais opposer les 3 jours de l'arrêté
 * du 4 mai 2017 à un produit qui ne relève pas d'une AMM :
 *   - geste sans produit : aucun avertissement ;
 *   - substance de base ou PNPP dont le délai est inconnu : rappel de vérifier
 *     les conditions d'approbation ;
 *   - délai connu : appliqué tel quel ;
 *   - délai déclaré nul (non applicable, cas d'un biostimulant) : rien.
 */
import { describe, expect, it } from 'vitest'
import { avertissementsDarLot, type TraitementDar } from '@/lib/recolte/dar'
import {
  agregerVerdictsDar, avertissementDar, darIndicatifApresCorrection, darIntervention, HORIZON_DAR_INCONNU_JOURS, lireDelaiEtNatureDeclares, natureInterventionDar, natureObservationDar, natureOperationDar, resoudreDar, verdictDar,
  type ApplicationDar, type CalendrierDar,
} from '../delai-avant-recolte'

const MS_JOUR = 86_400_000
const cal: CalendrierDar = {
  ajouterJours: (jour, n) => jour + n * MS_JOUR,
  formater: (jour) => new Date(jour).toISOString().slice(0, 10),
  iso: (jour) => new Date(jour).toISOString().slice(0, 10),
}
const t0 = Date.UTC(2026, 5, 1)
const application = (nature: 'amm' | 'sans_amm', dar: ReturnType<typeof resoudreDar>, joursApres: number) =>
  avertissementDar({ jourTraitement: t0, jourRecolte: t0 + joursApres * MS_JOUR, dar, produit: 'Décoction de prêle', nature }, cal)

const PRELE = { darJours: null, nomCommercial: 'Décoction de prêle', classification: 'Substance de base / PNPP' }
const j = (jour: string) => new Date(`${jour}T00:00:00Z`)
const lot = { id: 1, cultureId: 10, plancheId: 'p1', parcelleId: 'parc1', date: j('2026-06-02') }
const traitement = (t: Partial<TraitementDar>): TraitementDar => ({
  cultureId: 10, plancheId: 'p1', date: j('2026-06-01'), dar: null, produitPhyto: null, produitPhytoRef: null, ...t,
})

describe('CR-DAR-01 : substance de base dont le délai avant récolte est inconnu', () => {
  it('récolte le lendemain d’une décoction de prêle sans DAR : rappel de vérifier les conditions d’approbation', () => {
    const messages = avertissementsDarLot(lot, [traitement({ produitPhyto: 'Décoction de prêle', produitPhytoRef: PRELE })])
    expect(messages).toHaveLength(1)
    expect(messages[0]).toMatch(/délai inconnu, vérifiez les conditions d’approbation/)
    expect(messages[0]).toContain('Décoction de prêle')
  })

  it('ne lui oppose ni AMM ni les 3 jours de l’arrêté du 4 mai 2017', () => {
    const message = application('sans_amm', { etat: 'inconnu' }, 1)!
    expect(message).not.toMatch(/AMM/)
    expect(message).not.toMatch(/3 jours/)
    expect(message).not.toMatch(/arrêté du 4 mai 2017/)
  })

  it('le rappel dure le même horizon que celui d’un produit sous AMM, puis cesse', () => {
    expect(application('sans_amm', { etat: 'inconnu' }, HORIZON_DAR_INCONNU_JOURS - 1)).not.toBeNull()
    expect(application('sans_amm', { etat: 'inconnu' }, HORIZON_DAR_INCONNU_JOURS)).toBeNull()
    expect(application('sans_amm', { etat: 'inconnu' }, -1)).toBeNull()
  })

  it('délai saisi : il s’applique tel quel ; celui du catalogue n’est qu’une indication', () => {
    const saisi = avertissementsDarLot({ ...lot, date: j('2026-06-10') }, [traitement({ dar: 15, produitPhytoRef: PRELE })])
    expect(saisi).toHaveLength(1)
    expect(saisi[0]).toContain('15 jours')
    expect(saisi[0]).toContain('16/06/2026')
    expect(avertissementsDarLot({ ...lot, date: j('2026-06-16') }, [traitement({ dar: 15, produitPhytoRef: PRELE })])).toEqual([])
    // Le délai du catalogue n'est qu'une indication : cité dans le rappel
    // des conditions d'approbation, jamais opposé comme un délai connu.
    const referentiel = avertissementsDarLot(lot, [traitement({ produitPhytoRef: { ...PRELE, darJours: 15 } })])
    expect(referentiel[0]).toMatch(/vérifiez les conditions d’approbation/)
    expect(referentiel[0]).toContain('Le catalogue Gleba indique 15 jours à titre indicatif')
  })

  it('délai déclaré nul (non applicable, biostimulant) : aucun avertissement, même le lendemain', () => {
    expect(avertissementsDarLot(lot, [traitement({ dar: 0, produitPhytoRef: PRELE })])).toEqual([])
    const savon = { darJours: 0, nomCommercial: 'Savon noir', classification: 'Substance de base / PNPP' }
    expect(avertissementsDarLot(lot, [traitement({ produitPhytoRef: savon })])).toEqual([])
  })

  it('geste sans produit : aucun avertissement', () => {
    const filet = { darJours: null, nomCommercial: 'Filet anti-insectes', classification: 'Mécanique' }
    expect(avertissementsDarLot(lot, [traitement({ produitPhytoRef: filet })])).toEqual([])
    expect(avertissementsDarLot(lot, [traitement({ geste: 'Désherbage manuel' })])).toEqual([])
  })

  it('produit sous AMM sans DAR : le défaut légal de 3 jours reste opposé', () => {
    const messages = avertissementsDarLot(lot, [traitement({ produitPhyto: 'Fongicide X' })])
    expect(messages[0]).toMatch(/3 jours/)
    expect(messages[0]).toMatch(/arrêté du 4 mai 2017/)
  })

  it('natures : la classification du référentiel et la méthode du verger', () => {
    expect(natureInterventionDar({ produitPhyto: null, produitPhytoRef: { classification: 'Substance de base / PNPP' } })).toBe('sans_amm')
    expect(natureInterventionDar({ produitPhyto: null, produitPhytoRef: { classification: 'Mécanique' } })).toBe('sans_produit')
    expect(natureInterventionDar({ produitPhyto: 'Fongicide X', produitPhytoRef: null })).toBe('amm')
    expect(natureObservationDar({ produit: 'Purin d’ortie', methodeTraitement: 'biologique_purin' })).toBe('sans_amm')
    expect(natureObservationDar({ produit: 'Glu', methodeTraitement: 'mecanique_manuel' })).toBe('sans_produit')
  })

  describe('CR-DAR-01, tour 2 : nature déclarée d’un produit saisi librement (aucune fiche au référentiel)', () => {
    const libre = { produitPhyto: 'Décoction de prêle', produitPhytoRef: null }

    it('substance de base déclarée : conditions d’approbation, pas le régime de l’AMM', () => {
      expect(natureInterventionDar({ ...libre, natureProduit: 'substance_base' })).toBe('sans_amm')
    })

    it('biostimulant déclaré : aucun délai avant récolte applicable', () => {
      expect(natureInterventionDar({ produitPhyto: 'Purin d’ortie', produitPhytoRef: null, natureProduit: 'biostimulant' })).toBe('sans_produit')
    })

    it('nature non précisée, inconnue ou « amm » : produit susceptible de relever d’une AMM', () => {
      expect(natureInterventionDar({ ...libre, natureProduit: null })).toBe('amm')
      expect(natureInterventionDar({ ...libre, natureProduit: 'amm' })).toBe('amm')
      expect(natureInterventionDar({ ...libre, natureProduit: 'autre' })).toBe('amm')
    })

    it('le nom libre seul ne classe rien : « prêle » sans nature déclarée reste un produit inconnu', () => {
      expect(natureInterventionDar(libre)).toBe('amm')
    })

    it('un numéro d’AMM saisi contredit la déclaration : régime de l’AMM', () => {
      expect(natureInterventionDar({ ...libre, natureProduit: 'substance_base', numAMM: '2010001' })).toBe('amm')
      expect(natureInterventionDar({ ...libre, natureProduit: 'biostimulant', numAMM: '2010001' })).toBe('amm')
    })

    it('la classification du référentiel prime sur la déclaration', () => {
      expect(natureInterventionDar({ produitPhyto: 'Bouillie', produitPhytoRef: { classification: 'Chimique conventionnel' }, natureProduit: 'biostimulant' })).toBe('amm')
      expect(natureInterventionDar({ produitPhyto: 'Bouillie', produitPhytoRef: { classification: 'Autorisé AB' }, natureProduit: 'substance_base' })).toBe('amm')
      expect(natureInterventionDar({ produitPhyto: null, produitPhytoRef: { classification: 'Substance de base / PNPP' }, natureProduit: 'amm' })).toBe('sans_amm')
    })
  })
})

/**
 * Décision de Guillaume du 2026-11-13 (« ce qui est dans le cadre légal ») :
 * le verdict distingue ce qui BLOQUE la mise en vente (délai de l'AMM ou de
 * l'approbation renseigné, 3 jours par défaut de l'arrêté du 4 mai 2017,
 * art. 3, I) de ce qui n'est qu'un rappel.
 */
describe('verdict DAR : bloquant, informatif ou rien', () => {
  const verdict = (nature: ApplicationDar['nature'], dar: ReturnType<typeof resoudreDar>, joursApres: number, produit: string | null = 'Bouillie Z') =>
    verdictDar({ jourTraitement: t0, jourRecolte: t0 + joursApres * MS_JOUR, dar, produit, nature }, cal)

  it('produit sous AMM, DAR connu de 7 jours : bloquant à J+5, rien à J+7 révolus', () => {
    const v = verdict('amm', resoudreDar(7, null), 5)
    expect(v).toMatchObject({ niveau: 'bloquant', traitement: { produit: 'Bouillie Z', dateTraitement: '2026-06-01', finDelai: '2026-06-08', origineDelai: 'saisi' } })
    expect(v.niveau === 'bloquant' && v.message).toContain('ne peut pas être mise en vente')
    expect(verdict('amm', resoudreDar(7, null), 6).niveau).toBe('bloquant')
    expect(verdict('amm', resoudreDar(7, null), 7)).toEqual({ niveau: 'rien' })
  })

  /**
   * Revue QA du tour 2 : le catalogue des produits (ProduitPhyto.darJours) est
   * un ordre de grandeur générique, sans AMM précise ni usage. Il ne devient
   * jamais une obligation : le défaut légal de 3 jours s'applique, l'indication
   * reste un rappel.
   */
  it('délai générique du catalogue (21 jours, aucun délai saisi) : bloquant 3 jours au titre du défaut légal, puis simple rappel à J+10', () => {
    const generique = resoudreDar(null, 21)
    expect(generique).toEqual({ etat: 'inconnu', indicatifJours: 21 })
    expect(verdict('amm', generique, 2, 'Bouillie bordelaise')).toMatchObject({ niveau: 'bloquant', traitement: { finDelai: '2026-06-04', origineDelai: 'defaut_legal' } })
    const j10 = verdict('amm', generique, 10, 'Bouillie bordelaise')
    expect(j10.niveau).toBe('informatif')
    expect(j10.niveau === 'informatif' && j10.message).toContain('le catalogue Gleba indique 21 jours à titre indicatif (soit jusqu’au 2026-06-22)')
    expect(j10.niveau === 'informatif' && j10.message).toContain('le délai qui s’impose est celui de l’AMM')
    // Indication dépassée : rappel ordinaire de renseigner le délai, puis rien.
    const j30 = verdict('amm', generique, 30)
    expect(j30.niveau === 'informatif' && j30.message).not.toContain('catalogue')
    expect(verdict('amm', generique, HORIZON_DAR_INCONNU_JOURS)).toEqual({ niveau: 'rien' })
    // Une indication plus longue que l'horizon prolonge le rappel, sans bloquer.
    expect(verdict('amm', resoudreDar(null, 90), 80).niveau).toBe('informatif')
    expect(verdict('amm', resoudreDar(null, 90), 90)).toEqual({ niveau: 'rien' })
    // Le même délai SAISI par l'exploitant (lu sur l'étiquette) bloque.
    expect(verdict('amm', resoudreDar(21, 21), 10)).toMatchObject({ niveau: 'bloquant', traitement: { finDelai: '2026-06-22', origineDelai: 'saisi' } })
  })

  it('catalogue à 0 ou 1 jour sans délai saisi : ce n’est pas une « disposition contraire » de l’AMM, le défaut légal bloque', () => {
    expect(verdict('amm', resoudreDar(null, 0), 1)).toMatchObject({ niveau: 'bloquant', traitement: { origineDelai: 'defaut_legal' } })
    expect(verdict('amm', resoudreDar(null, 1), 2)).toMatchObject({ niveau: 'bloquant', traitement: { origineDelai: 'defaut_legal' } })
  })

  it('substance de base au catalogue : 15 jours indicatifs ne bloquent jamais ; 0 jour au catalogue : rien', () => {
    for (const jours of [0, 2, 10, 14]) {
      const v = verdict('sans_amm', resoudreDar(null, 15), jours, 'Décoction de prêle')
      expect(v.niveau).toBe('informatif')
      expect(v.niveau === 'informatif' && v.message).toContain('Le catalogue Gleba indique 15 jours à titre indicatif')
    }
    expect(verdict('sans_amm', resoudreDar(null, 0), 0, 'Purin d’ortie')).toEqual({ niveau: 'rien' })
  })

  it('ADV221 : correction d’une ligne indicative — même délai renvoyé ou absent : reste indicatif ; changé, effacé ou confirmé : délai de l’exploitant', () => {
    const indicatif = { dar: 21, darIndicatif: true }
    expect(darIndicatifApresCorrection(indicatif, { darPresent: true, dar: 21 })).toBe(true)
    expect(darIndicatifApresCorrection(indicatif, { darPresent: false })).toBe(true)
    expect(darIndicatifApresCorrection(indicatif, { darPresent: true, dar: 21, confirme: false })).toBe(true)
    expect(darIndicatifApresCorrection(indicatif, { darPresent: true, dar: 21, confirme: true })).toBe(false)
    expect(darIndicatifApresCorrection(indicatif, { darPresent: true, dar: 14 })).toBe(false)
    expect(darIndicatifApresCorrection(indicatif, { darPresent: true, dar: null })).toBe(false)
    expect(darIndicatifApresCorrection(indicatif, { darPresent: true, dar: 0 })).toBe(false)
    // Une ligne déjà saisie par l'exploitant ne redevient jamais indicative.
    expect(darIndicatifApresCorrection({ dar: 21, darIndicatif: false }, { darPresent: true, dar: 21 })).toBe(false)
  })

  it('délai ancien recopié du catalogue (darIndicatif) : indication, pas un délai saisi ; corrigé, il redevient opposable', () => {
    const ref = { darJours: 21 }
    expect(darIntervention({ dar: 21, darIndicatif: true, produitPhytoRef: ref })).toEqual({ etat: 'inconnu', indicatifJours: 21 })
    // Fiche du catalogue supprimée depuis : la valeur recopiée reste l'indication.
    expect(darIntervention({ dar: 21, darIndicatif: true, produitPhytoRef: null })).toEqual({ etat: 'inconnu', indicatifJours: 21 })
    expect(darIntervention({ dar: 21, darIndicatif: false, produitPhytoRef: ref })).toEqual({ etat: 'connu', jours: 21, source: 'saisi' })
    expect(darIntervention({ dar: null, produitPhytoRef: ref })).toEqual({ etat: 'inconnu', indicatifJours: 21 })
    expect(darIntervention({ dar: null, produitPhytoRef: null })).toEqual({ etat: 'inconnu' })
  })

  it('opération d’arbre : nature déclarée, sinon produit présumé sous AMM', () => {
    expect(natureOperationDar({})).toBe('amm')
    expect(natureOperationDar({ natureProduit: 'amm' })).toBe('amm')
    expect(natureOperationDar({ natureProduit: 'substance_base' })).toBe('sans_amm')
    expect(natureOperationDar({ natureProduit: 'biostimulant' })).toBe('sans_produit')
  })

  it('délai et nature d’une opération lus du corps : absent inchangé, vide effacé, zéro conservé, valeurs invalides refusées', () => {
    expect(lireDelaiEtNatureDeclares({})).toEqual({ dar: undefined, natureProduit: undefined })
    expect(lireDelaiEtNatureDeclares({ dar: '', natureProduit: '' })).toEqual({ dar: null, natureProduit: null })
    expect(lireDelaiEtNatureDeclares({ dar: 0, natureProduit: 'substance_base' })).toEqual({ dar: 0, natureProduit: 'substance_base' })
    expect(lireDelaiEtNatureDeclares({ dar: '14' })).toMatchObject({ dar: 14 })
    expect(lireDelaiEtNatureDeclares({ dar: -1 })).toMatchObject({ champ: 'dar' })
    expect(lireDelaiEtNatureDeclares({ dar: 1.5 })).toMatchObject({ champ: 'dar' })
    expect(lireDelaiEtNatureDeclares({ dar: 'abc' })).toMatchObject({ champ: 'dar' })
    expect(lireDelaiEtNatureDeclares({ natureProduit: 'prele' })).toMatchObject({ champ: 'natureProduit' })
  })

  it('produit sous AMM sans DAR : bloquant à J+2 (3 jours par défaut), informatif à J+10', () => {
    const v = verdict('amm', resoudreDar(null, null), 2)
    expect(v).toMatchObject({ niveau: 'bloquant', traitement: { dateTraitement: '2026-06-01', finDelai: '2026-06-04', origineDelai: 'defaut_legal' } })
    expect(v.niveau === 'bloquant' && v.message).toContain('arrêté du 4 mai 2017, art. 3, I')
    expect(verdict('amm', resoudreDar(null, null), 3).niveau).toBe('informatif')
    expect(verdict('amm', resoudreDar(null, null), 10).niveau).toBe('informatif')
    expect(verdict('amm', resoudreDar(null, null), HORIZON_DAR_INCONNU_JOURS)).toEqual({ niveau: 'rien' })
  })

  it('délai déclaré inférieur à 3 jours pour un produit sous AMM : rappel, jamais bloquant (l’AMM peut le prévoir)', () => {
    expect(verdict('amm', resoudreDar(1, null), 0).niveau).toBe('bloquant')
    expect(verdict('amm', resoudreDar(1, null), 2).niveau).toBe('informatif')
    expect(verdict('amm', resoudreDar(0, null), 0).niveau).toBe('informatif')
    expect(verdict('amm', resoudreDar(1, null), 3)).toEqual({ niveau: 'rien' })
  })

  it('substance de base : sans délai renseigné informatif jamais bloquant ; délai de 15 jours bloquant à J+10', () => {
    for (const jours of [0, 1, 2, 10, HORIZON_DAR_INCONNU_JOURS - 1]) {
      expect(verdict('sans_amm', resoudreDar(null, null), jours, 'Décoction de prêle').niveau).toBe('informatif')
    }
    expect(verdict('sans_amm', resoudreDar(null, null), HORIZON_DAR_INCONNU_JOURS)).toEqual({ niveau: 'rien' })
    expect(verdict('sans_amm', resoudreDar(15, null), 10, 'Décoction de prêle')).toMatchObject({
      niveau: 'bloquant', traitement: { produit: 'Décoction de prêle', finDelai: '2026-06-16', origineDelai: 'approbation' },
    })
    expect(verdict('sans_amm', resoudreDar(15, null), 15)).toEqual({ niveau: 'rien' })
    // Délai déclaré nul (biostimulant) : rien, et jamais les 3 jours de l'AMM.
    expect(verdict('sans_amm', resoudreDar(0, null), 0)).toEqual({ niveau: 'rien' })
  })

  it('geste sans produit : rien ; un délai que l’exploitant s’y est fixé reste un rappel', () => {
    expect(verdict('sans_produit', resoudreDar(null, null), 0, null)).toEqual({ niveau: 'rien' })
    expect(verdict('sans_produit', resoudreDar(null, null), 2, null)).toEqual({ niveau: 'rien' })
    expect(verdict('sans_produit', resoudreDar(5, null), 2, null).niveau).toBe('informatif')
  })

  it('une récolte antérieure au traitement n’est jamais concernée', () => {
    expect(verdict('amm', resoudreDar(7, null), -1)).toEqual({ niveau: 'rien' })
  })

  it('le verdict d’un lot est bloquant dès qu’un traitement l’est, et garde les rappels à part', () => {
    const lotVerdict = agregerVerdictsDar([
      verdict('sans_amm', resoudreDar(null, null), 2, 'Décoction de prêle'),
      verdict('amm', resoudreDar(7, null), 2),
      verdict('amm', resoudreDar(7, null), 2),
      verdict('sans_produit', resoudreDar(null, null), 2, null),
    ])
    expect(lotVerdict.niveau).toBe('bloquant')
    expect(lotVerdict.blocages).toHaveLength(1)
    expect(lotVerdict.rappels).toHaveLength(1)
    expect(lotVerdict.traitements).toEqual([{ produit: 'Bouillie Z', dateTraitement: '2026-06-01', finDelai: '2026-06-08', origineDelai: 'saisi' }])
    expect(lotVerdict.avertissements).toEqual([...lotVerdict.blocages, ...lotVerdict.rappels])
    expect(agregerVerdictsDar([]).niveau).toBe('rien')
    expect(agregerVerdictsDar([verdict('amm', resoudreDar(null, null), 10)]).niveau).toBe('informatif')
  })
})
