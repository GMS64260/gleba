"use client"

/**
 * Cellule éditable pour tanstack-table
 * Même pattern que StockInput de la page stocks
 */

import * as React from "react"

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

  React.useEffect(() => {
    setLocalValue(value || '')
  }, [value])

  const handleBlur = async () => {
    setEditing(false)

    if (localValue !== value) {
      // Sauvegarder
      try {
        const res = await fetch(`/api/planches/${encodeURIComponent(plancheId)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ [field]: localValue || null }),
        })

        if (!res.ok) {
          throw new Error('Erreur sauvegarde')
        }

        // Rafraîchir les données
        onUpdate()
      } catch (error) {
        console.error('Erreur:', error)
        alert('Erreur lors de la sauvegarde')
        // Revenir à l'ancienne valeur
        setLocalValue(value || '')
      }
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
  const displayValue = currentOption
    ? `${currentOption.icon || ''} ${currentOption.label}`.trim()
    : placeholder

  if (editing) {
    return (
      <select
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        onClick={(e) => e.stopPropagation()}
        className="h-8 text-xs rounded-md border border-green-500 bg-background px-2 py-1 focus:outline-none focus:ring-2 focus:ring-green-500"
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
      onClick={() => setEditing(true)}
      className="px-2 py-1 rounded hover:bg-yellow-50 hover:ring-1 hover:ring-yellow-400 min-w-[100px] text-left transition-all group relative text-xs"
      title="Cliquer pour éditer"
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
