import { z } from 'zod'
import { estCheminJustificatif } from '@/lib/comptabilite/justificatif'

export const pjUrlSchema = z.custom<string>(
  value => typeof value === 'string' && (value === '' || estCheminJustificatif(value)),
  { message: 'Pièce justificative invalide : utilisez le chemin du fichier téléversé.' },
).nullable().optional()
