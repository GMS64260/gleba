import type { PolitiqueDebitApi } from "./auth-politique-types"

/** Surcharge privée : le trafic de caisse est plafonné par personne authentifiée. */
export const politiqueDebitApi: PolitiqueDebitApi = (request) => {
  if (!request || !/^\/api\/caisse(?:\/|$)/.test(new URL(request.url).pathname)) return null
  return { prefixeCle: "caisse:", windowMs: 15 * 60 * 1000, max: 2000 }
}
