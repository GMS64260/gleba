import { ErreurElevage } from './erreurs'

/** Une correction de traite ne peut pas réutiliser du lait déjà transformé. */
export function protegerCollecteAffectee(
  collecte: { lotFromageId: string | null; quantiteLitres: unknown; date: Date; traite: string },
  updates: { lotFromageId?: string | null; quantiteLitres?: number; date?: Date; traite?: string },
) {
  if (!collecte.lotFromageId) return
  if (
    (updates.lotFromageId !== undefined && updates.lotFromageId !== collecte.lotFromageId) ||
    (updates.quantiteLitres !== undefined && updates.quantiteLitres !== Number(collecte.quantiteLitres)) ||
    (updates.date !== undefined && updates.date.getTime() !== collecte.date.getTime()) ||
    (updates.traite !== undefined && updates.traite !== collecte.traite)
  ) throw new ErreurElevage('Cette collecte est déjà affectée à une fabrication. Annulez cette fabrication avant de corriger sa quantité, sa date ou son affectation.', 409, 'COLLECTE_DEJA_TRANSFORMEE')
}
