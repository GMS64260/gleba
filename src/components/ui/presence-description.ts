import * as React from "react"

/**
 * Lien `aria-describedby` des fenêtres Radix (Dialog, Sheet) selon la présence
 * réelle d'une description.
 *
 * Ticket cmv29k7ub (QA 2026-10-10) — Radix pose toujours
 * `aria-describedby` sur le contenu, même sans `Description` rendue : la
 * référence ARIA pointe vers un id absent, et chaque ouverture affiche
 * « Missing `Description` or `aria-describedby={undefined}` ». Environ vingt
 * fenêtres n'ont pas de description. Plutôt que de corriger chacune (et de
 * laisser revenir le défaut à la prochaine), la description signale sa
 * présence au contenu, qui passe `aria-describedby={undefined}` (la voie
 * prévue par Radix) tant qu'aucune n'est rendue.
 */

type Signaler = (delta: 1 | -1) => void

export const SignalDescriptionContext = React.createContext<Signaler | null>(null)

const useLayoutEffectIso = typeof window === "undefined" ? React.useEffect : React.useLayoutEffect

/**
 * Côté contenu. Rend le signal à fournir aux enfants et les props à étaler
 * AVANT celles de l'appelant : un `aria-describedby` passé explicitement garde
 * la main.
 */
export function usePresenceDescription(props: object) {
  const [nbDescriptions, setNbDescriptions] = React.useState(0)
  const signaler = React.useCallback<Signaler>((delta) => setNbDescriptions((n) => n + delta), [])
  const ariaDescribedBy: { "aria-describedby"?: undefined } =
    "aria-describedby" in props || nbDescriptions > 0 ? {} : { "aria-describedby": undefined }
  return { signaler, ariaDescribedBy }
}

/**
 * Côté description : se déclare au montage, se retire au démontage. Effet de
 * mise en page, donc avant l'effet de Radix qui lit l'attribut pour avertir.
 */
export function useSignalerDescription() {
  const signaler = React.useContext(SignalDescriptionContext)
  useLayoutEffectIso(() => {
    if (!signaler) return
    signaler(1)
    return () => signaler(-1)
  }, [signaler])
}
