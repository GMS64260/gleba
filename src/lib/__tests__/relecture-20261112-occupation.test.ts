/**
 * Relecture du 2026-11-12 — « bout à bout » prudent. La position des cultures
 * sur la planche n'est pas enregistrée : seule une nouvelle culture partielle
 * qui tient dans la longueur restante est sûre de ne prendre aucune largeur.
 */
import { describe, expect, it } from 'vitest'

import { evaluerModificationOccupation, evaluerOccupationPlanche } from '../planche-validation'

const PLANCHE = { largeur: 0.8, longueur: 20 }
const enPlace = (id: number, nbRangs: number, longueur: number | null) => ({
  id,
  espece: { id: `e${id}`, vivace: false },
  dateSemis: null,
  datePlantation: null,
  dateRecolte: null,
  finRecolte: null,
  nbRangs,
  longueur,
  itp: { espacementRangs: 25 },
})
const verdict = (cultures: ReturnType<typeof enPlace>[], nbRangs: number, longueur: number | null) =>
  evaluerOccupationPlanche({
    planche: PLANCHE,
    culturesEnPlace: cultures,
    espacementRangs: 25,
    nbRangs,
    longueur,
    debut: null,
    fin: null,
  })

describe('occupation bout à bout', () => {
  it('refuse une culture pleine longueur à côté de deux partielles peut-être côte à côte', () => {
    // Deux fois 0,25 m sur 10 m, peut-être sur les mêmes 10 m : il ne reste
    // que 0,10 m de sûr pour les 0,25 m demandés.
    const v = verdict([enPlace(1, 2, 10), enPlace(2, 2, 10)], 2, 20)
    expect(v.possible).toBe(false)
    expect(v.verifie && v.largeurOccupee).toBeCloseTo(0.5)
  })

  it('refuse de même une culture trop longue pour le reste de la planche', () => {
    expect(verdict([enPlace(1, 2, 5), enPlace(2, 2, 5)], 2, 12).possible).toBe(false)
    expect(verdict([enPlace(1, 3, 10)], 3, 10.5).possible).toBe(false)
  })

  it('accepte une culture partielle qui tient dans la longueur restante', () => {
    const v = verdict([enPlace(1, 3, 10)], 3, 10)
    expect(v.possible).toBe(true)
    expect(v.verifie && v.largeurOccupee).toBe(0)
    expect(verdict([enPlace(1, 2, 5), enPlace(2, 2, 5)], 3, 10).possible).toBe(true)
  })

  it('compte toujours les cultures en place sur toute la longueur', () => {
    // 0,50 m pris sur toute la longueur : la partielle de 10 m n'y change rien.
    expect(verdict([enPlace(1, 3, null), enPlace(2, 2, 10)], 2, 10).possible).toBe(false)
    expect(verdict([enPlace(1, 2, null), enPlace(2, 2, 10)], 2, 10).possible).toBe(true)
  })
})

describe('modification d’une culture en place (PUT)', () => {
  const etat = (nbRangs: number, longueur: number | null, espacementRangs: number | null = 25) => ({
    espacementRangs,
    nbRangs,
    longueur,
    debut: null,
    fin: null,
  })
  const modifier = (
    autres: ReturnType<typeof enPlace>[],
    avant: ReturnType<typeof etat> | null,
    apres: ReturnType<typeof etat>
  ) => evaluerModificationOccupation({ planche: PLANCHE, autresCultures: autres, avant, apres })

  it('refuse la modification qui fait déborder la planche', () => {
    // 1 m en 4 rangs logée à la suite d'une partielle, puis étendue à 20 m.
    const refus = modifier([enPlace(1, 3, 19)], etat(3, 1), etat(3, 20))
    expect(refus).toMatchObject({ verifie: true, possible: false })
    // Un rang de plus à côté d'une culture pleine longueur.
    expect(modifier([enPlace(1, 2, null)], etat(2, null), etat(3, null))).not.toBeNull()
  })

  it('accepte ce qui tient', () => {
    expect(modifier([enPlace(1, 2, null)], etat(1, null), etat(2, null))).toBeNull()
    expect(modifier([], etat(2, 10), etat(3, 20))).toBeNull()
  })

  it('ne bloque pas une culture déjà en dépassement quand la modification ne l’aggrave pas', () => {
    const voisines = [enPlace(1, 3, null)]
    // Mêmes rangs, autres dates ou autre longueur : rien de plus qu'avant.
    expect(modifier(voisines, etat(3, null), etat(3, null))).toBeNull()
    expect(modifier(voisines, etat(3, null), etat(3, 12))).toBeNull()
    // Moins de rangs, même si cela ne suffit pas encore.
    expect(modifier(voisines, etat(4, null), etat(3, null))).toBeNull()
    // Plus de rangs : aggravée, refusée.
    expect(modifier(voisines, etat(3, null), etat(4, null))).not.toBeNull()
  })

  it('refuse l’arrivée sur une planche où elle ne tient pas', () => {
    expect(modifier([enPlace(1, 3, null)], null, etat(3, null))).not.toBeNull()
    expect(modifier([enPlace(1, 1, null)], null, etat(2, null))).toBeNull()
  })

  it('ne refuse rien sans espacement entre rangs, ni pour une longueur excédentaire', () => {
    expect(modifier([enPlace(1, 3, null)], etat(1, null, null), etat(6, null, null))).toBeNull()
    // Longueur supérieure à la planche : avertie ailleurs, pas refusée ici.
    expect(modifier([], etat(2, 10), etat(2, 30))).toBeNull()
  })
})
