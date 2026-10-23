"use client"

/**
 * Champ « Porte-greffe » d'un arbre, commun à la fiche arbre (`/verger/[id]`)
 * et à l'inspecteur du plan (`/jardin`).
 *
 * QA cmvkp3kqc (2026-10-23) — l'inspecteur du plan ne lisait que la colonne
 * texte historique `portGreffe`, que la création par le catalogue laisse vide
 * (elle n'écrit que `porteGreffeId`) : le champ restait sur « Ex: M26 » alors
 * que la fiche, qui lit le référentiel, affichait « Prunier Saint-Julien A ».
 * Les deux écrans passent maintenant par ce champ :
 *  - liste du référentiel compatible avec l'espèce quand il en existe (même
 *    route que la fiche : `/api/verger/porte-greffes?especeId=`) ; un choix
 *    écrit l'id ET son libellé, comme le faisait la fiche ;
 *  - texte libre sinon, pré-rempli par le libellé du référentiel quand
 *    l'arbre en a un, sans perdre l'id tant que le texte n'est pas changé.
 * Une saisie libre historique reste visible dans la liste (« saisie libre ») :
 * avant, la fiche l'affichait « — Aucun » dès qu'un catalogue existait.
 */

import * as React from "react"
import { Combobox } from "@/components/ui/combobox"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { valeurDepuisSaisieLibre, type ValeurPorteGreffe } from "@/lib/verger/porte-greffe-saisie"

export interface PorteGreffeCatalogue {
  id: string
  nom: string
  vigueur: number | null
}

interface ChampPorteGreffeProps {
  id?: string
  espece: string | null
  porteGreffeId: string | null
  portGreffe: string | null
  /** Libellé du référentiel déjà joint par la liste (`porteGreffeRef.nom`). */
  porteGreffeNom?: string | null
  /** Saisies libres déjà utilisées sur les autres arbres (mode texte libre). */
  suggestions: string[]
  onChange: (valeur: ValeurPorteGreffe) => void
  className?: string
}

const AUCUN = "_none"
const SAISIE_LIBRE = "_saisie_libre"

export function ChampPorteGreffe({
  id,
  espece,
  porteGreffeId,
  portGreffe,
  porteGreffeNom,
  suggestions,
  onChange,
  className,
}: ChampPorteGreffeProps) {
  // null = chargement en cours ; [] = aucun porte-greffe de référence pour l'espèce.
  const [catalogue, setCatalogue] = React.useState<PorteGreffeCatalogue[] | null>(espece ? null : [])

  React.useEffect(() => {
    if (!espece) {
      setCatalogue([])
      return
    }
    // La liste précédente reste affichée pendant le rechargement : l'espèce se
    // tape lettre à lettre dans la fiche, un état « chargement » clignoterait.
    let annule = false
    fetch(`/api/verger/porte-greffes?especeId=${encodeURIComponent(espece)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((res) => {
        if (!annule) setCatalogue(Array.isArray(res?.data) ? res.data : [])
      })
      .catch(() => {
        if (!annule) setCatalogue([])
      })
    return () => {
      annule = true
    }
  }, [espece])

  const libelle =
    porteGreffeNom ??
    (porteGreffeId ? catalogue?.find((p) => p.id === porteGreffeId)?.nom : undefined) ??
    portGreffe ??
    null

  if (catalogue === null) {
    return <Input id={id} value={libelle ?? ""} readOnly disabled placeholder="Chargement…" className={className} />
  }

  if (catalogue.length === 0) {
    return (
      <Combobox
        value={libelle ?? ""}
        onValueChange={(v) => onChange(valeurDepuisSaisieLibre(v, { porteGreffeId, libelle }))}
        options={[...new Set([...suggestions, ...(libelle ? [libelle] : [])])]
          .sort()
          .map((v) => ({ value: v, label: v }))}
        placeholder="Ex: M26"
        className={className}
      />
    )
  }

  // L'arbre peut pointer un porte-greffe hors de la liste de son espèce
  // (espèce modifiée depuis, entrée devenue privée) : on le garde visible.
  const horsListe = porteGreffeId != null && !catalogue.some((p) => p.id === porteGreffeId)
  const valeur = porteGreffeId ?? (portGreffe ? SAISIE_LIBRE : AUCUN)

  return (
    <Select
      value={valeur}
      onValueChange={(v) => {
        if (v === SAISIE_LIBRE) return
        if (v === AUCUN) {
          onChange({ porteGreffeId: null, portGreffe: null })
          return
        }
        const choisi = catalogue.find((p) => p.id === v)
        onChange({ porteGreffeId: v, portGreffe: choisi?.nom ?? libelle })
      }}
    >
      <SelectTrigger id={id} className={className}>
        <SelectValue placeholder="Sélectionner" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={AUCUN}>— Aucun</SelectItem>
        {!porteGreffeId && portGreffe && (
          <SelectItem value={SAISIE_LIBRE}>{portGreffe} (saisie libre)</SelectItem>
        )}
        {horsListe && (
          <SelectItem value={porteGreffeId}>{libelle ?? "Porte-greffe enregistré"}</SelectItem>
        )}
        {catalogue.map((pg) => (
          <SelectItem key={pg.id} value={pg.id}>
            {pg.nom}
            {pg.vigueur != null && (
              <span className="text-muted-foreground text-xs ml-2">vigueur {pg.vigueur}/5</span>
            )}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
