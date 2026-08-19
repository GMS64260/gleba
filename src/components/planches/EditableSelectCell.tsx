"use client"

/**
 * Cellule éditable pour tanstack-table
 * Même pattern que StockInput de la page stocks
 */

import * as React from "react"
import { alertDialog } from "@/lib/global-dialog"

interface EditableSelectCellProps {
  plancheId: string
  field: string
  value: string | null
  options: Array<{ value: string; label: string; icon?: string }>
  placeholder?: string
  onUpdate: () => void
}

export function EditableSelectCell({
  plancheId,
  field,
  value,
  options,
  placeholder = "-",
  onUpdate,
}: EditableSelectCellProps) {
  const [editing, setEditing] = React.useState(false)
  const [localValue, setLocalValue] = React.useState(value || '')
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    setLocalValue(value || '')
  }, [value])

  // QA cmsnodbo6 — la sauvegarde n'était déclenchée qu'au blur, or choisir
  // une option d'un <select> natif ne retire pas le focus : « Limoneux »
  // s'affichait puis disparaissait au reload car aucun PUT n'était jamais
  // parti (et le clic « ailleurs » naturel tombait sur la ligne cliquable qui
  // navigue vers la fiche). On enregistre dès le changement de valeur.
  const save = async (next: string) => {
    if (next === (value || '')) return
    setSaving(true)
    try {
      const res = await fetch(`/api/planches/${encodeURIComponent(plancheId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: next || null }),
      })

      if (!res.ok) {
        throw new Error('Erreur sauvegarde')
      }

      // Rafraîchir les données
      onUpdate()
    } catch (error) {
      console.error('Erreur:', error)
      await alertDialog('Erreur lors de la sauvegarde')
      // Revenir à l'ancienne valeur
      setLocalValue(value || '')
    } finally {
      setSaving(false)
      setEditing(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      ;(e.target as HTMLSelectElement).blur()
    }
    if (e.key === 'Escape') {
      setLocalValue(value || '')
      setEditing(false)
    }
  }

  const currentOption = options.find(o => o.value === value)
  // Une valeur héritée hors canon (ex. type_sol « argile ») reste visible
  // telle quelle au lieu de se faire passer pour absente (« Définir »).
  const displayValue = currentOption
    ? `${currentOption.icon || ''} ${currentOption.label}`.trim()
    : (value || placeholder)

  if (editing) {
    return (
      <select
        value={localValue}
        onChange={(e) => {
          setLocalValue(e.target.value)
          void save(e.target.value)
        }}
        onBlur={() => {
          if (!saving) setEditing(false)
        }}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        disabled={saving}
        className="h-8 text-xs rounded-md border border-green-500 bg-background px-2 py-1 focus:outline-none focus:ring-2 focus:ring-green-500 disabled:opacity-60"
        autoFocus
      >
        <option value="">{placeholder}</option>
        {options.map(opt => (
          <option key={opt.value} value={opt.value}>
            {opt.icon} {opt.label}
          </option>
        ))}
      </select>
    )
  }

  return (
    <button
      onClick={(e) => {
        e.stopPropagation()
        setEditing(true)
      }}
      // PROMPT 20c — Indicateur visuel d'édition rapide
      className="cursor-text px-2 py-1 rounded hover:bg-yellow-50 hover:ring-1 hover:ring-yellow-400 hover:underline hover:decoration-dotted hover:decoration-yellow-500 min-w-[100px] text-left transition-all group relative text-xs"
      title="Cliquez pour éditer (Entrée = valider, Échap = annuler)"
    >
      <span className={value ? "font-medium" : "text-muted-foreground"}>
        {displayValue}
      </span>
      <span className="absolute right-1 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-[10px]">
        ✏️
      </span>
    </button>
  )
}
