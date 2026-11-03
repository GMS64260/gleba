/**
 * Formulaires de sortie de lait (vente de lait cru, livraison, fabrication) :
 * une réponse 422 `LAIT_INDISPONIBLE` ouvre une confirmation ; si
 * l'utilisateur confirme, la même requête repart avec la confirmation.
 * Décision du 2026-11-03 : alerte confirmable, jamais de blocage.
 */
import { confirmDialog } from "@/lib/global-dialog"
import { CODE_LAIT_INDISPONIBLE } from "./lait-indisponible"

/** Corps JSON de la dernière réponse, `{}` s'il n'est pas lisible. */
export interface CorpsReponse {
  error?: string
  code?: string
  warning?: string | null
  data?: Record<string, unknown>
}

export interface ReponseConfirmee {
  res: Response
  json: CorpsReponse
}

/**
 * `envoyer(confirmer)` émet la requête, avec `confirmerLaitIndisponible`
 * quand `confirmer` est vrai. Rend `null` si l'utilisateur renonce.
 */
export async function envoyerAvecConfirmationLait(
  envoyer: (confirmer: boolean) => Promise<Response>,
): Promise<ReponseConfirmee | null> {
  let res = await envoyer(false)
  let json: CorpsReponse = await res.json().catch(() => ({}))
  if (res.status === 422 && json?.code === CODE_LAIT_INDISPONIBLE) {
    const confirme = await confirmDialog(String(json.error), {
      title: "Plus de lait sorti que collecté",
      confirmLabel: "Enregistrer quand même",
      cancelLabel: "Revenir à la saisie",
      variant: "warning",
    })
    if (!confirme) return null
    res = await envoyer(true)
    json = await res.json().catch(() => ({}))
  }
  return { res, json }
}
