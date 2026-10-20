import { describe, expect, it } from 'vitest'
import { masquerReferentielsEmbarques } from '@/lib/referentiel-embarque'
import { PROPRIETAIRE_COMMUNAUTE, origineReferentiel } from '@/lib/referentiel-communaute'
import { AUTRE, MOI, jeuReferentiel } from './fixtures/referentiel-memoire'

/**
 * Revue 2026-10-20 (suite du sweep e1bd648) — les routes métier embarquent la
 * ligne complète d'un référentiel (espèce, variété, ITP, espèce animale,
 * race, porte-greffe). L'id de l'auteur d'une entrée partagée par un autre
 * compte ne doit jamais sortir ; tout le reste de la réponse reste intact.
 */

const especes = jeuReferentiel((id, nom) => ({ id, nom, rendement: 2, uniteRendement: 'kg_m2' }))
const varietes = jeuReferentiel((id, nom) => ({ id: `v-${id}`, nom: `Variété ${nom}` }))
const itps = jeuReferentiel((id, nom) => ({ id: `i-${id}`, nom: `Itinéraire ${nom}` }))

describe('masquerReferentielsEmbarques', () => {
  it("une culture : l'espèce, la variété et l'ITP d'un autre compte prennent le marqueur ; le reste est intact", () => {
    const famille = { id: 'Solanacées', couleur: '#f00' }
    const culture = {
      id: 1174,
      userId: MOI,
      dateSemis: new Date('2026-10-09T22:00:00.000Z'),
      espece: { ...especes.partagee, famille },
      variete: varietes.privee,
      itp: itps.moi,
      planche: { id: 'p1', userId: MOI, nom: 'B1' },
      recoltes: [{ id: 1, userId: MOI, quantite: 2 }],
    }

    const sortie = masquerReferentielsEmbarques(culture, MOI)

    expect(sortie.espece.userId).toBe(PROPRIETAIRE_COMMUNAUTE)
    expect(sortie.variete.userId).toBe(PROPRIETAIRE_COMMUNAUTE)
    expect(sortie.itp.userId).toBe(MOI)
    expect(sortie.espece.nom).toBe('Entrée partagée')
    expect(sortie.espece.rendement).toBe(2)
    expect(sortie.espece.famille).toBe(famille)
    // Objets du compte et dates : rendus par référence, jamais réécrits.
    expect(sortie.userId).toBe(MOI)
    expect(sortie.planche).toBe(culture.planche)
    expect(sortie.recoltes).toBe(culture.recoltes)
    expect(sortie.dateSemis).toBe(culture.dateSemis)
    expect(JSON.stringify(sortie)).not.toContain(AUTRE)
    // L'origine lue par les écrans ne change pas.
    for (const cle of ['espece', 'variete', 'itp'] as const) {
      expect(origineReferentiel(sortie[cle], MOI)).toBe(origineReferentiel(culture[cle], MOI))
    }
  })

  it('relations imbriquées et listes : étapes de rotation, cultures de planche, variétés d’une espèce', () => {
    const planche = {
      id: 'p1',
      userId: MOI,
      rotation: {
        details: [
          { annee: 1, itp: { ...itps.partagee, espece: especes.partagee } },
          { annee: 2, itp: { ...itps.gleba, espece: { ...especes.gleba, varietes: [varietes.gleba, varietes.partagee] } } },
        ],
      },
      cultures: [{ id: 1, espece: especes.gleba, variete: varietes.partagee }],
    }

    const sortie = masquerReferentielsEmbarques(planche, MOI)

    expect(sortie.rotation.details[0].itp.userId).toBe(PROPRIETAIRE_COMMUNAUTE)
    expect(sortie.rotation.details[0].itp.espece.userId).toBe(PROPRIETAIRE_COMMUNAUTE)
    expect(sortie.rotation.details[1].itp.userId).toBeNull()
    expect(sortie.rotation.details[1].itp.espece.varietes.map((v) => v.userId)).toEqual([null, PROPRIETAIRE_COMMUNAUTE])
    expect(sortie.cultures[0].espece.userId).toBeNull()
    expect(sortie.cultures[0].variete.userId).toBe(PROPRIETAIRE_COMMUNAUTE)
    expect(JSON.stringify(sortie)).not.toContain(AUTRE)
  })

  it('un tableau de réponses (liste) est traité ligne par ligne', () => {
    const lignes = [
      { id: 1, espece: especes.partagee },
      { id: 2, espece: especes.moi },
      { id: 3, espece: null },
    ]
    const sortie = masquerReferentielsEmbarques(lignes, MOI)
    expect(sortie.map((l) => l.espece?.userId ?? null)).toEqual([PROPRIETAIRE_COMMUNAUTE, MOI, null])
    expect(sortie[2]).toBe(lignes[2])
  })

  it('une clé de référentiel qui porte un libellé, null ou une ligne sans userId reste telle quelle', () => {
    const carnet = { espece: 'Tomate', variete: null, itp: { id: 'i-1', nom: 'Sans auteur sélectionné' } }
    const sortie = masquerReferentielsEmbarques(carnet, MOI)
    expect(sortie).toBe(carnet)
  })

  it('sans référentiel embarqué, la valeur est rendue par référence', () => {
    const objet = { id: 1, userId: AUTRE, lot: { id: 2, userId: AUTRE }, dates: [new Date()] }
    expect(masquerReferentielsEmbarques(objet, MOI)).toBe(objet)
    expect(masquerReferentielsEmbarques(null, MOI)).toBeNull()
    expect(masquerReferentielsEmbarques('texte', MOI)).toBe('texte')
  })
})
