"use client"

import { useCallback, useEffect, useRef, useState } from 'react'
import { constructeurDictee, ouvrirDictee } from '@/lib/dictee-vocale'

export function useDicteeVocale(ecrire: (texte: string) => void) {
  const [disponible, setDisponible] = useState(false)
  const [ecoute, setEcoute] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const session = useRef<ReturnType<typeof ouvrirDictee> | null>(null)
  const ecrireRef = useRef(ecrire)
  ecrireRef.current = ecrire

  const annuler = useCallback(() => {
    session.current?.detruire()
    session.current = null
    setEcoute(false)
  }, [])

  useEffect(() => {
    setDisponible(Boolean(constructeurDictee()))
    const cacher = () => { if (document.hidden) annuler() }
    document.addEventListener('visibilitychange', cacher)
    return () => {
      document.removeEventListener('visibilitychange', cacher)
      session.current?.detruire()
    }
  }, [annuler])

  const demarrer = useCallback((initial: string) => {
    if (session.current) return
    const Constructeur = constructeurDictee()
    if (!Constructeur) return
    setErreur(null)
    setEcoute(true)
    try {
      session.current = ouvrirDictee(Constructeur, initial, {
        texte: texte => ecrireRef.current(texte),
        erreur: setErreur,
        fin: () => { session.current = null; setEcoute(false) },
      })
    } catch {
      session.current = null
      setEcoute(false)
      setErreur('Le microphone n’a pas pu démarrer. Utilisez le micro du clavier ou réessayez.')
    }
  }, [])

  return { disponible, ecoute, erreur, demarrer, arreter: () => session.current?.arreter(), annuler }
}
