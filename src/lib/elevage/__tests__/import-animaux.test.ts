import { describe, expect, it } from 'vitest'
import { isValidIdentifiant } from '@/lib/identification-animal'
import {
  apparierIdentifiantMasque, csvRowToAnimal, csvRowToAnimalUpdate,
  indexerIdentifiantsMasques, normaliserSexe, normaliserTypeIdentifiant,
  parseAnimauxCsv, parseDateCsv, problemesLigne, resoudreEspece, suggererEspece,
  suffixeIdentifiantMasque,
  type AnimalCsvRow,
} from '../import-animaux'

const ligne = (valeurs: Partial<AnimalCsvRow>): AnimalCsvRow => ({
  espece: '', identifiant: '', type_identifiant: '', nom: '', race: '', sexe: '',
  date_naissance: '', date_arrivee: '', provenance: '', orientation: '',
  prix_achat: '', poids_kg: '', notes: '',
  ...valeurs,
})

describe('import CSV animaux', () => {
  it('accepte le CSV français au point-virgule et les champs entre guillemets', () => {
    const { rows } = parseAnimauxCsv('espece;identifiant;nom;prix_achat\nchevre_alpine;FR123456789012;"Neige, la blanche";350,50')
    expect(rows).toHaveLength(1)
    expect(rows[0].nom).toBe('Neige, la blanche')
    expect(csvRowToAnimal(rows[0], 'chevre_alpine')).toMatchObject({
      especeAnimaleId: 'chevre_alpine', prixAchat: 350.5, statut: 'actif',
    })
  })

  it('refuse un fichier sans colonne espece', () => {
    expect(() => parseAnimauxCsv('nom;race\nNeige;Alpine')).toThrow(/espece/)
  })

  // Régression du 2026-08-06 : le modèle public portait ces en-têtes camelCase
  // et l'import vidait silencieusement type, date de naissance et date d'arrivée.
  it("accepte les en-têtes camelCase de l'ancien modèle public sans perdre de colonnes", () => {
    const contenu = 'identifiant;typeIdentifiant;nom;espece;race;sexe;dateNaissance;dateArrivee;provenance;notes\n'
      + 'FR64123461059;IPG Ovin;;brebis_merinos_arles;Merinos;F;2016;16/01/2026;Nans Mingeaud;'
    const { rows, entetesIgnores } = parseAnimauxCsv(contenu)
    expect(entetesIgnores).toEqual([])
    expect(csvRowToAnimal(rows[0], 'brebis_merinos_arles')).toMatchObject({
      identifiant: 'FR64123461059',
      typeIdentifiant: 'IPG ovin',
      sexe: 'femelle',
      dateNaissance: '2016-01-01',
      dateArrivee: '2026-01-16',
      provenance: 'Nans Mingeaud',
    })
  })

  it('remonte les colonnes inconnues au lieu de les ignorer en silence', () => {
    const { entetesIgnores } = parseAnimauxCsv('espece;boucle;couleur_yeux\nbrebis;123;bleu')
    expect(entetesIgnores).toEqual(['boucle', 'couleur_yeux'])
  })

  it('accepte la tabulation comme séparateur (collage depuis un tableur)', () => {
    const { rows } = parseAnimauxCsv('espece\tnom\nbrebis\tNoiraude')
    expect(rows[0]).toMatchObject({ espece: 'brebis', nom: 'Noiraude' })
  })

  it("résout l'espèce malgré ponctuation, casse et accents, et suggère sinon", () => {
    const especes = [{ id: 'brebis_merinos_arles', nom: "Brebis Mérinos d'Arles" }]
    expect(resoudreEspece(especes, 'brebis_merinos_arles.')?.id).toBe('brebis_merinos_arles')
    expect(resoudreEspece(especes, "BREBIS MERINOS D'ARLES")?.id).toBe('brebis_merinos_arles')
    expect(resoudreEspece(especes, 'Merinos')).toBeUndefined()
    expect(suggererEspece(especes, 'Merinos')?.id).toBe('brebis_merinos_arles')
  })

  it('parse les dates ISO, JJ/MM/AAAA et année seule', () => {
    expect(parseDateCsv('2023-02-15')).toBe('2023-02-15')
    expect(parseDateCsv('16/01/2026')).toBe('2026-01-16')
    expect(parseDateCsv('2016')).toBe('2016-01-01')
    expect(parseDateCsv('')).toBeNull()
    expect(parseDateCsv('demain')).toBeUndefined()
  })

  it('normalise sexe et type d’identifiant', () => {
    expect(normaliserSexe('F')).toBe('femelle')
    expect(normaliserSexe('Mâle')).toBe('male')
    expect(normaliserSexe('')).toBeNull()
    expect(normaliserSexe('xy')).toBeUndefined()
    expect(normaliserTypeIdentifiant('IPG Ovin')).toBe('IPG ovin')
    expect(normaliserTypeIdentifiant('ipg ovin')).toBe('IPG ovin')
    expect(normaliserTypeIdentifiant('carte grise')).toBeUndefined()
  })

  it('cite la valeur fautive dans les problèmes de ligne', () => {
    const problemes = problemesLigne(ligne({
      sexe: 'xy', type_identifiant: 'carte grise', date_naissance: '0204', orientation: 'plumes',
    }))
    expect(problemes.join(' ')).toContain('« xy »')
    expect(problemes.join(' ')).toContain('« carte grise »')
    expect(problemes.join(' ')).toContain('« 0204 »')
    expect(problemes.join(' ')).toContain('« plumes »')
  })

  it("contrôle l'identifiant contre son type avant l'envoi", () => {
    const problemes = problemesLigne(ligne({ identifiant: 'XXXXXX61059', type_identifiant: 'IPG ovin' }))
    expect(problemes).toHaveLength(1)
    expect(problemes[0]).toContain('XXXXXX61059')
    expect(problemesLigne(ligne({ identifiant: 'FR64123461059', type_identifiant: 'IPG ovin' }))).toEqual([])
  })

  it('IPG ovin/caprin : FR + 11 chiffres réglementaire accepté, 12 toléré', () => {
    expect(isValidIdentifiant('FR64123461059', 'IPG ovin')).toBe(true)
    expect(isValidIdentifiant('FR123456789012', 'IPG caprin')).toBe(true)
    expect(isValidIdentifiant('64123461059', 'IPG ovin')).toBe(false)
  })

  it("mode mise à jour : les cellules vides n'écrasent rien", () => {
    const payload = csvRowToAnimalUpdate(ligne({ date_naissance: '2016', identifiant: 'FR64123461059' }), 42)
    expect(payload).toEqual({ id: 42, dateNaissance: '2016-01-01' })
  })

  it("l'orientation vient de la colonne, sinon du défaut de la modale", () => {
    expect(csvRowToAnimal(ligne({ espece: 'brebis', orientation: 'Laine' }), 'brebis').orientationProduction).toBe('laine')
    expect(csvRowToAnimal(ligne({ espece: 'brebis' }), 'brebis', { orientationParDefaut: 'viande' }).orientationProduction).toBe('viande')
  })
})

/**
 * Cas réel du 2026-08-07 : troupeau de 99 ovins dont 66 identifiants masqués
 * (`XXXXXX61010`), éleveur invité à re-verser son fichier complet en mode mise à
 * jour. Sans appariement par suffixe, les 66 lignes repartaient en création.
 */
describe('appariement des identifiants masqués', () => {
  it('extrait le suffixe de chiffres d\'un identifiant masqué', () => {
    expect(suffixeIdentifiantMasque('XXXXXX61010')).toBe('61010')
    expect(suffixeIdentifiantMasque('FR17000561010')).toBeNull() // pas masqué
    expect(suffixeIdentifiantMasque('XXXXXX12')).toBeNull() // suffixe trop court
    expect(suffixeIdentifiantMasque(null)).toBeNull()
  })

  it('rattache un identifiant complet à l\'animal masqué correspondant', () => {
    const masques = indexerIdentifiantsMasques([
      { id: 1, identifiant: 'XXXXXX61010' },
      { id: 2, identifiant: 'XXXXXX61011' },
      { id: 3, identifiant: 'FR17000538006' },
    ])
    expect(masques).toHaveLength(2)
    expect(apparierIdentifiantMasque('FR170005 61010', masques)?.id).toBe(1)
    expect(apparierIdentifiantMasque('FR17000561011', masques)?.id).toBe(2)
    expect(apparierIdentifiantMasque('FR17000599999', masques)).toBeNull()
  })

  it('refuse d\'apparier quand un suffixe désigne deux animaux', () => {
    const masques = indexerIdentifiantsMasques([
      { id: 1, identifiant: 'XXXXXX61010' },
      { id: 2, identifiant: 'XXXXX-61010' },
    ])
    expect(masques).toHaveLength(0)
    expect(apparierIdentifiantMasque('FR17000561010', masques)).toBeNull()
  })

  it('refuse d\'apparier quand plusieurs suffixes conviennent', () => {
    const masques = indexerIdentifiantsMasques([
      { id: 1, identifiant: 'XXXXXX61010' },
      { id: 2, identifiant: 'XXXXXXX1010' },
    ])
    expect(masques).toHaveLength(2)
    expect(apparierIdentifiantMasque('FR17000561010', masques)).toBeNull()
  })

  it('ne réécrit l\'identifiant que sur un rattachement masqué', () => {
    const row = ligne({ espece: 'ovin', identifiant: 'FR17000561010', nom: 'Blanchette' })
    expect(csvRowToAnimalUpdate(row, 7)).not.toHaveProperty('identifiant')
    expect(csvRowToAnimalUpdate(row, 7, { completerIdentifiant: true }).identifiant)
      .toBe('FR17000561010')
  })
})
