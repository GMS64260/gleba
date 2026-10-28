import type { Prisma } from '@prisma/client'
import { genererNumeroLot } from '@/lib/recolte/lot'
import { ErreurVerger } from './erreur'

/** Compteur durable par préfixe : supprimer ou déplacer un lot ne libère pas son numéro. */
export async function prochainNumeroLotVerger(tx: Prisma.TransactionClient, userId: string, origine: {
  date: Date; parcelleNom?: string | null; espece?: string | null
}) {
  const prefixe = genererNumeroLot(origine).replace(/\d+$/, '')
  const lignes = await tx.$queryRaw<Array<{ dernier_numero: number }>>`
    WITH existants AS (
      SELECT substring(num_lot FROM length(${prefixe}) + 1) AS rang FROM recoltes_arbres
        WHERE user_id = ${userId} AND num_lot LIKE ${prefixe + '%'}
      UNION ALL
      SELECT substring(num_lot FROM length(${prefixe}) + 1) AS rang FROM production_bois
        WHERE user_id = ${userId} AND num_lot LIKE ${prefixe + '%'}
    ), maximum AS (
      SELECT COALESCE(MAX(CASE WHEN rang ~ '^[0-9]+$' THEN rang::numeric ELSE 0 END), 0) AS numero FROM existants
    )
    INSERT INTO sequences_lot_verger (user_id, prefixe, dernier_numero, updated_at)
      SELECT ${userId}, ${prefixe}, (numero + 1)::integer, CURRENT_TIMESTAMP FROM maximum WHERE numero < 2147483647
    ON CONFLICT (user_id, prefixe) DO UPDATE
      SET dernier_numero = GREATEST(sequences_lot_verger.dernier_numero, EXCLUDED.dernier_numero - 1) + 1,
          updated_at = CURRENT_TIMESTAMP
      WHERE sequences_lot_verger.dernier_numero < 2147483647
    RETURNING dernier_numero`
  if (!lignes.length) throw new ErreurVerger('La séquence automatique de ce lot est épuisée. Choisissez un numéro de lot manuel distinct.', 409, 'numLot')
  return genererNumeroLot({ ...origine, numeroSequence: lignes[0].dernier_numero })
}
