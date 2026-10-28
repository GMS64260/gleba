'use client'
import * as React from 'react'

export function useCandidatsBancaires<T>(
  operationId: string | null,
  type: 'reglements' | 'virements',
  partie: 'principal' | 'frais',
  recherche: string,
  actualisation = 0,
) {
  const [lignes, setLignes] = React.useState<T[]>([])
  const [curseur, setCurseur] = React.useState<string | null>(null)
  const [charge, setCharge] = React.useState(false)
  const [erreur, setErreur] = React.useState<string | null>(null)
  const generation = React.useRef(0)
  const charger = React.useCallback(
    async (apres?: string, signal?: AbortSignal) => {
      if (!operationId) return
      const numero = ++generation.current
      setCharge(true)
      setErreur(null)
      try {
        const r = await fetch(
          '/api/comptabilite/banque/candidats?' +
            new URLSearchParams({
              operationId,
              type,
              partie,
              q: recherche,
              ...(apres ? { curseur: apres } : {}),
            }),
          { signal, cache: 'no-store' },
        )
        const d = await r.json()
        if (!r.ok) throw new Error(d.error || 'Recherche indisponible.')
        if (numero !== generation.current) return
        setLignes((anciennes) => (apres ? [...anciennes, ...d.data] : d.data))
        setCurseur(d.curseurSuivant)
      } catch (e) {
        if (!signal?.aborted && numero === generation.current)
          setErreur(e instanceof Error ? e.message : 'Recherche indisponible.')
      } finally {
        if (numero === generation.current) setCharge(false)
      }
    },
    [operationId, type, partie, recherche],
  )
  React.useEffect(() => {
    generation.current++
    setLignes([])
    setCurseur(null)
    setErreur(null)
    if (!operationId) {
      setCharge(false)
      return
    }
    const controleur = new AbortController()
    setCharge(true)
    const timer = setTimeout(() => {
      void charger(undefined, controleur.signal)
    }, 200)
    return () => {
      clearTimeout(timer)
      controleur.abort()
      // Ce compteur identifie les requêtes, pas un nœud DOM à restaurer.
      // eslint-disable-next-line react-hooks/exhaustive-deps
      generation.current++
    }
  }, [charger, operationId, actualisation])
  return { lignes, curseur, charge, erreur, suivant: () => charger(curseur || undefined) }
}
