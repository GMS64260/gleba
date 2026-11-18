import { describe, expect, it } from 'vitest'
import { totauxParTaux } from '@/lib/facture-utils'
import { calculerDocument, contenuDocumentSchema, type ContenuDocument } from './regles'

const GRAINE = 20261117
const NOMBRE_CAS = 384
const TAUX = [0, 2.1, 5.5, 10, 20] as const
const ZERO = BigInt(0)
const CENT = BigInt(100)
const MILLE = BigInt(1000)
type Ligne = ContenuDocument['lignes'][number]
type Montants = { ht: bigint; tva: bigint; ttc: bigint }

function generateur(graine: number) {
  let etat = graine >>> 0
  return (borne: number) => {
    etat = (Math.imul(etat, 1664525) + 1013904223) >>> 0
    return Math.floor(etat / 2 ** 32 * borne)
  }
}

// Division entière positive, demi-unité vers le haut. Aucun flottant ni
// appel à arrondir/calculerDocument dans l'oracle des montants attendus.
function arrondiRationnel(numerateur: bigint, denominateur: bigint) {
  return (numerateur * BigInt(2) + denominateur) / (denominateur * BigInt(2))
}

function oracle(ligne: Ligne, sansTaxe = false): Montants {
  // Les entrées sont construites en millièmes ; on retrouve leurs entiers
  // d'origine sans arrondir de montant monétaire intermédiaire.
  const quantite = BigInt(Math.round(ligne.quantite * 1000))
  const prix = BigInt(Math.round(ligne.prixUnitaire * 1000))
  const ht = arrondiRationnel(quantite * prix * CENT, MILLE * MILLE)
  const tauxDixiemes = sansTaxe ? ZERO : BigInt(Math.round(ligne.tauxTVA * 10))
  const tva = arrondiRationnel(ht * tauxDixiemes, MILLE)
  return { ht, tva, ttc: ht + tva }
}

const vide = (): Montants => ({ ht: ZERO, tva: ZERO, ttc: ZERO })
const additionner = (a: Montants, b: Montants): Montants => ({ ht: a.ht + b.ht, tva: a.tva + b.tva, ttc: a.ttc + b.ttc })
const sommer = (montants: Montants[]) => montants.reduce(additionner, vide())

function verifierMontant(recu: number, centimes: bigint, contexte?: string) {
  expect(recu, contexte).toBe(Number(centimes) / 100)
  expect(BigInt(Math.round(recu * 100)), contexte).toBe(centimes)
}

function verifierTotaux(document: ReturnType<typeof calculerDocument>, attendus: Montants) {
  verifierMontant(document.totalHT, attendus.ht)
  verifierMontant(document.totalTVA, attendus.tva)
  verifierMontant(document.totalTTC, attendus.ttc)
  expect(BigInt(Math.round(document.totalTTC * 100))).toBe(
    BigInt(Math.round(document.totalHT * 100)) + BigInt(Math.round(document.totalTVA * 100)),
  )
}

// Cette conversion ne sert qu'à observer les sorties déjà arrondies, pour
// tester la ventilation indépendamment de la justesse du calcul de ligne.
function observer(ligne: { montantHT: number; montantTVA: number; montantTTC: number }): Montants {
  return {
    ht: BigInt(Math.round(ligne.montantHT * 100)),
    tva: BigInt(Math.round(ligne.montantTVA * 100)),
    ttc: BigInt(Math.round(ligne.montantTTC * 100)),
  }
}

const SCENARIOS = ['fractionnaires', 'demi-centimes HT', 'demi-centimes TVA', 'taux mixtes', 'autour du demi-centime', 'cent lignes'] as const

function construireCas() {
  const entier = generateur(GRAINE)
  return Array.from({ length: NOMBRE_CAS }, (_, index) => {
    const scenario = SCENARIOS[index % SCENARIOS.length]
    const nombre = scenario === 'cent lignes' ? 100 : [1, 2, 5, 17][entier(4)]
    const lignes = Array.from({ length: nombre }, (_, j): Ligne => {
      const tauxTVA = TAUX[(index + j) % TAUX.length]
      let quantiteMilli = 1 + entier(1_000_000)
      let prixMilli = entier(1_000_001)
      if (scenario === 'demi-centimes HT') {
        quantiteMilli = 1000
        prixMilli = 10 * entier(100_000) + 5
      } else if (scenario === 'demi-centimes TVA') {
        quantiteMilli = 1000
        const k = entier(100)
        // TVA en centimes : (500+1000k)*21/1000, (100+200k)*55/1000,
        // (5+10k)*100/1000. Le taux 20 % n'a pas de demi-centime
        // sur une base HT déjà arrondie au centime.
        const htCentimes = tauxTVA === 2.1 ? 500 + 1000 * k
          : tauxTVA === 5.5 ? 100 + 200 * k : tauxTVA === 10 ? 5 + 10 * k : 1 + k
        prixMilli = htCentimes * 10
      } else if (scenario === 'autour du demi-centime') {
        quantiteMilli = 1000
        prixMilli = 10 * entier(100_000) + 4 + j % 3
      } else if (scenario === 'taux mixtes') {
        quantiteMilli = [1, 125, 333, 500, 1000, 3250][entier(6)]
        prixMilli = [0, 10, 40, 1005, 1750, 2300, 999990][entier(7)]
      }
      return { description: `Ligne fictive ${j}`, quantite: quantiteMilli / 1000, prixUnitaire: prixMilli / 1000, unite: 'kg', tauxTVA }
    })
    // Vérification du domaine réel accepté, y compris les limites de lignes.
    const contenu = contenuDocumentSchema.parse({
      type: 'devis', clientId: 1, date: '2026-11-17', dateValidite: '2026-12-17',
      dateLivraison: null, objet: 'Devis fictif généré', lignes,
    })
    const permutation = [...contenu.lignes]
    for (let j = permutation.length - 1; j > 0; j--) {
      const k = entier(j + 1)
      ;[permutation[j], permutation[k]] = [permutation[k], permutation[j]]
    }
    return { index, scenario, lignes: contenu.lignes, permutation }
  })
}

const CAS = construireCas()

// Les noms affichent graine, scénario et index, y compris en cas d'échec.
// Périmètre : devis/BL positifs ; ni avoirs ni conversion de devises.
describe(`Documents commerciaux — graine ${GRAINE}, ${NOMBRE_CAS} entrées par propriété`, () => {
  it.each(CAS)('lignes et sommes HT/TVA/TTC exactes : $scenario [$index]', ({ lignes }) => {
    const document = calculerDocument(lignes)
    expect(document.lignes).toHaveLength(lignes.length)
    const attendues = lignes.map((ligne) => oracle(ligne))
    document.lignes.forEach((ligne, index) => {
      expect(ligne.ordre).toBe(index)
      expect(ligne.tauxTVA).toBe(lignes[index].tauxTVA)
      const contexte = JSON.stringify(lignes[index])
      verifierMontant(ligne.montantHT, attendues[index].ht, `HT ${contexte}`)
      verifierMontant(ligne.montantTVA, attendues[index].tva, `TVA ${contexte}`)
      verifierMontant(ligne.montantTTC, attendues[index].ttc, `TTC ${contexte}`)
    })
    verifierTotaux(document, sommer(attendues))
    verifierTotaux(document, sommer(document.lignes.map(observer)))
  })

  it.each(CAS)('ventilation exclusive par taux et conservation des sommes : $scenario [$index]', ({ lignes }) => {
    const document = calculerDocument(lignes)
    const groupes = totauxParTaux(document.lignes)
    const attendus = new Map<string, Montants>()
    // Oracle de regroupement : les lignes de chaque taux sont sélectionnées
    // séparément, sans réutiliser la boucle d'accumulation du helper testé.
    for (const taux of TAUX) {
      const selection = document.lignes.filter((ligne) => ligne.tauxTVA === taux)
      if (selection.length) attendus.set(String(taux), sommer(selection.map(observer)))
    }
    expect(Object.keys(groupes).sort()).toEqual([...attendus.keys()].sort())
    for (const [taux, montants] of attendus) {
      verifierMontant(groupes[taux].ht, montants.ht)
      verifierMontant(groupes[taux].tva, montants.tva)
      verifierMontant(groupes[taux].ttc, montants.ttc)
    }
    verifierTotaux(document, sommer(Object.values(groupes).map((g) => observer({ montantHT: g.ht, montantTVA: g.tva, montantTTC: g.ttc }))))
  })

  it.each(CAS)('sansTaxe neutralise toute TVA et conserve le HT : $scenario [$index]', ({ lignes }) => {
    const document = calculerDocument(lignes, true)
    const attendus = sommer(lignes.map((ligne) => oracle(ligne, true)))
    document.lignes.forEach((ligne, index) => {
      expect(ligne.tauxTVA).toBe(0)
      verifierMontant(ligne.montantTVA, ZERO)
      verifierMontant(ligne.montantHT, oracle(lignes[index], true).ht, `HT sansTaxe ${JSON.stringify(lignes[index])}`)
      expect(ligne.montantTTC).toBe(ligne.montantHT)
    })
    verifierTotaux(document, attendus)
    const groupes = totauxParTaux(document.lignes)
    expect(Object.keys(groupes)).toEqual(['0'])
    verifierMontant(groupes['0'].ht, attendus.ht)
    verifierMontant(groupes['0'].tva, ZERO)
    verifierMontant(groupes['0'].ttc, attendus.ht)
  })

  it.each(CAS)('permuter préserve les totaux et ventilations, taxés ou exonérés : $scenario [$index]', ({ lignes, permutation }) => {
    for (const sansTaxe of [false, true]) {
      const avant = calculerDocument(lignes, sansTaxe)
      const apres = calculerDocument(permutation, sansTaxe)
      expect([apres.totalHT, apres.totalTVA, apres.totalTTC]).toEqual([avant.totalHT, avant.totalTVA, avant.totalTTC])
      expect(totauxParTaux(apres.lignes)).toEqual(totauxParTaux(avant.lignes))
      // L'ordre technique change, les montants attachés à chaque ligne restent.
      const parDescription = (document: typeof avant) => Object.fromEntries(document.lignes.map((ligne) => [ligne.description, observer(ligne)]))
      expect(parDescription(apres)).toEqual(parDescription(avant))
    }
  })
})
