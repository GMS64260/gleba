import { z } from 'zod'
import { REGIMES_TVA_TOUS, TERRITOIRES } from '@/lib/territoires'

/** Validation commune de la devise figée et du contexte fiscal complet. */
export const schemaContexteFiscal = z.object({
  version: z.literal(1), regimeTva: z.enum(REGIMES_TVA_TOUS),
  territoire: z.string().refine(t => Object.prototype.hasOwnProperty.call(TERRITOIRES, t)),
  devise: z.enum(['EUR', 'XPF']), date: z.string().datetime(),
}).strict()
export type ContexteFiscal = z.infer<typeof schemaContexteFiscal>

