import { z } from 'zod'

export const MODES_REGLEMENT = ['Espèces', 'Chèque', 'Virement', 'CB', 'Prélèvement', 'À crédit'] as const
export const modeReglementSchema = z.enum(MODES_REGLEMENT).nullable().optional()

export function modePaiementDepuisReglement(mode: string | null | undefined): string | null {
  return ({ Espèces: 'especes', Chèque: 'cheque', Virement: 'virement', CB: 'cb', Prélèvement: 'prelevement' } as Record<string, string>)[mode ?? ''] ?? null
}
