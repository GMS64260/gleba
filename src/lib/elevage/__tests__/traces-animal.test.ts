import { describe, expect, it, vi } from 'vitest'
import {
  MOTIF_AFFECTATION_INITIALE,
  aDesTracesAnimal,
  compterTracesAnimal,
  decrireTracesAnimal,
  messageSuppressionAnimalRefusee,
  type TracesAnimal,
} from '@/lib/elevage/traces-animal'

const AUCUNE: TracesAnimal = {
  soins: 0,
  mouvements: 0,
  productions: 0,
  naissances: 0,
  descendants: 0,
  saillies: 0,
  ventes: 0,
  abattages: 0,
  consommations: 0,
  pesees: 0,
  testsSante: 0,
  statutsSanitaires: 0,
  justificatifsEquarrissage: 0,
}

/** Base factice : chaque table répond le compte demandé (0 par défaut). */
function baseFactice(comptes: Partial<Record<string, number>> = {}, mouvementsInitiaux = 0) {
  const table = (nom: string) => ({ count: vi.fn().mockResolvedValue(comptes[nom] ?? 0) })
  const mouvementCheptel = {
    count: vi.fn(async ({ where }: { where: { motif?: string } }) =>
      where.motif === MOTIF_AFFECTATION_INITIALE ? mouvementsInitiaux : (comptes.mouvementCheptel ?? 0)
    ),
  }
  return {
    soinAnimal: table('soinAnimal'),
    mouvementCheptel,
    productionOeuf: table('productionOeuf'),
    productionRuche: table('productionRuche'),
    collecteLait: table('collecteLait'),
    naissanceAnimale: table('naissanceAnimale'),
    animal: table('animal'),
    saillie: table('saillie'),
    venteProduit: table('venteProduit'),
    abattage: table('abattage'),
    consommationAliment: table('consommationAliment'),
    pesee: table('pesee'),
    testSanteElevage: table('testSanteElevage'),
    statutSanitaireElevage: table('statutSanitaireElevage'),
    justificatifEquarrissageAnimal: table('justificatifEquarrissageAnimal'),
  }
}

describe('compterTracesAnimal', () => {
  it('un animal sans aucune saisie n’a aucune trace', async () => {
    const traces = await compterTracesAnimal(baseFactice() as never, 7, 'user-1')
    expect(traces).toEqual(AUCUNE)
    expect(aDesTracesAnimal(traces)).toBe(false)
  })

  it('ne compte pas l’affectation initiale que la création écrit seule', async () => {
    const traces = await compterTracesAnimal(
      baseFactice({ mouvementCheptel: 1 }, 1) as never,
      7,
      'user-1'
    )
    expect(traces.mouvements).toBe(0)
    expect(aDesTracesAnimal(traces)).toBe(false)
  })

  it('compte tout autre mouvement, en plus de l’affectation initiale', async () => {
    const traces = await compterTracesAnimal(
      baseFactice({ mouvementCheptel: 3 }, 1) as never,
      7,
      'user-1'
    )
    expect(traces.mouvements).toBe(2)
  })

  it('additionne ponte, miel et lait en productions, et borne chaque table au compte', async () => {
    const db = baseFactice({ productionOeuf: 4, productionRuche: 1, collecteLait: 2, soinAnimal: 3, animal: 2 })
    const traces = await compterTracesAnimal(db as never, 7, 'user-1')

    expect(traces.productions).toBe(7)
    expect(traces.soins).toBe(3)
    expect(traces.descendants).toBe(2)
    expect(db.soinAnimal.count).toHaveBeenCalledWith({ where: { userId: 'user-1', animalId: 7 } })
    expect(db.animal.count).toHaveBeenCalledWith({
      where: { userId: 'user-1', OR: [{ mereId: 7 }, { pereId: 7 }] },
    })
    expect(db.justificatifEquarrissageAnimal.count).toHaveBeenCalledWith({
      where: { animalId: 7, justificatif: { userId: 'user-1' } },
    })
  })
})

describe('messageSuppressionAnimalRefusee', () => {
  it('nomme ce qui retient l’animal et le geste à faire à la place', () => {
    const traces = { ...AUCUNE, soins: 3, mouvements: 1, naissances: 2 }
    expect(decrireTracesAnimal(traces)).toBe('3 soins, 1 mouvement de cheptel et 2 naissances')
    expect(
      messageSuppressionAnimalRefusee({ id: 7, nom: 'Noisette', identifiant: null, statut: 'actif' }, traces)
    ).toBe(
      "L'animal « Noisette » porte encore 3 soins, 1 mouvement de cheptel et 2 naissances : ces saisies restent au registre d'élevage, il ne peut pas être supprimé. S'il a quitté l'exploitation, déclarez plutôt sa sortie depuis la liste des animaux (Vendre, Abattage ou Décès) : sa fiche et son historique sont conservés."
    )
  })

  it('pour un animal déjà sorti, dit qu’il n’y a rien d’autre à faire', () => {
    const message = messageSuppressionAnimalRefusee(
      { id: 7, nom: null, identifiant: 'FR123', statut: 'vendu' },
      { ...AUCUNE, ventes: 1 }
    )
    expect(message).toContain('« FR123 » porte encore 1 vente')
    expect(message).toContain('déjà sorti du cheptel')
    expect(message).not.toContain('—')
  })
})
