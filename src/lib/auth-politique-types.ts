/** Quota appliqué après résolution d'une session valide, à la place du quota IP. */
export interface DebitApiActeur {
  prefixeCle: string
  windowMs: number
  max: number
}

/** null conserve le quota IP générique, avant l'authentification. */
export type PolitiqueDebitApi = (request?: Request) => DebitApiActeur | null
