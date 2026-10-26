/** Petite interface locale : Web Speech est encore préfixé selon le navigateur. */
export interface ReconnaissanceVocale {
  lang: string
  continuous: boolean
  interimResults: boolean
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null
  onerror: ((e: { error: string }) => void) | null
  onend: (() => void) | null
  start(): void
  stop(): void
  abort(): void
}
export type ConstructeurReconnaissance = new () => ReconnaissanceVocale

export function constructeurDictee(): ConstructeurReconnaissance | undefined {
  if (typeof window === 'undefined') return undefined
  const navigateur = window as unknown as { SpeechRecognition?: ConstructeurReconnaissance; webkitSpeechRecognition?: ConstructeurReconnaissance }
  return navigateur.SpeechRecognition ?? navigateur.webkitSpeechRecognition
}

export function erreurDictee(code: string): string {
  if (code === 'not-allowed' || code === 'service-not-allowed') return 'Le microphone est refusé. Autorisez-le dans votre navigateur, ou utilisez le micro du clavier.'
  if (code === 'audio-capture') return 'Aucun microphone disponible. Utilisez le clavier pour cette saisie.'
  if (code === 'network') return 'La dictée nécessite une connexion. Votre texte est conservé ; vous pouvez le compléter au clavier.'
  if (code === 'no-speech') return 'Je n’ai rien entendu. Réessayez en parlant près du microphone.'
  return 'La dictée s’est interrompue. Votre texte est conservé.'
}

/** Reconstruit les résultats complets à chaque événement : les hypothèses
 * intermédiaires sont remplacées, jamais ajoutées en double au brouillon. */
export function ouvrirDictee(Constructeur: ConstructeurReconnaissance, initial: string, callbacks: {
  texte: (texte: string) => void
  erreur: (message: string) => void
  fin: () => void
}) {
  const reconnaissance = new Constructeur()
  reconnaissance.lang = 'fr-FR'
  reconnaissance.continuous = false
  reconnaissance.interimResults = true
  let active = true
  reconnaissance.onresult = evenement => {
    if (!active) return
    const texte = Array.from(evenement.results, r => r[0]?.transcript ?? '').join(' ').trim()
    callbacks.texte([initial.trimEnd(), texte].filter(Boolean).join(' '))
  }
  reconnaissance.onerror = e => {
    if (active && e.error !== 'aborted') callbacks.erreur(erreurDictee(e.error))
  }
  reconnaissance.onend = () => {
    if (!active) return
    active = false
    callbacks.fin()
  }
  reconnaissance.start()
  return {
    arreter: () => { if (active) reconnaissance.stop() },
    detruire: () => {
      active = false
      reconnaissance.onresult = null
      reconnaissance.onerror = null
      reconnaissance.onend = null
      reconnaissance.abort()
    },
  }
}
