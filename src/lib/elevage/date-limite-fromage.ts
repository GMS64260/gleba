import { jourCivilStocke } from '@/lib/jour-civil'

const fr = (jour: string) => jour.split('-').reverse().join('/')
const memeInstant = (a: Date | null | undefined, b: Date | null | undefined) => (a?.getTime() ?? null) === (b?.getTime() ?? null)

/**
 * Refus d'une date limite (DLC ou DLUO) antérieure à la fabrication du lot,
 * à la modification (équipe debug, D247 : la création le refusait déjà, pas
 * `PATCH /api/elevage/affinage`). Seule une date qui CHANGE est contrôlée :
 * un lot ancien déjà incohérent reste modifiable sur ses autres champs.
 */
export function refusDateLimiteFromage(
  lot: { dateFabrication: Date; dlc: Date | null; dluo: Date | null },
  modifications: { dlc?: Date | null; dluo?: Date | null },
): { error: string; champ: 'dlc' | 'dluo' } | null {
  const fabrication = jourCivilStocke(lot.dateFabrication)
  if (!fabrication) return null
  for (const champ of ['dlc', 'dluo'] as const) {
    const nouvelle = modifications[champ]
    if (nouvelle === undefined || nouvelle === null || memeInstant(nouvelle, lot[champ])) continue
    const limite = jourCivilStocke(nouvelle)
    if (limite && limite < fabrication) {
      return { error: `${champ.toUpperCase()} du ${fr(limite)} : cette date précède la fabrication du ${fr(fabrication)}. Corrigez la date.`, champ }
    }
  }
  return null
}
