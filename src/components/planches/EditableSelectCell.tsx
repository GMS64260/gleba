"use client"

/**
 * Cellule éditable pour tanstack-table
 * Click → Select natif → Save auto
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
  const [isEditing, setIsEditing] = React.useState(false)
  const [isSaving, setIsSaving] = React.useState(false)

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newValue = e.target.value
    setIsSaving(true)

    try {
      const res = await fetch(`/api/planches/${encodeURIComponent(plancheId)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [field]: newValue || null }),
      })

      if (!res.ok) {
        throw new Error('Erreur sauvegarde')
      }

      onUpdate()
    } catch (error) {
      console.error('Erreur:', error)
      alert('Erreur lors de la sauvegarde')
    } finally {
      setIsSaving(false)
    }
  }

  const currentOption = options.find(o => o.value === value)
  const displayValue = currentOption
    ? `${currentOption.icon || ''} ${currentOption.label}`.trim()
    : placeholder

  return (
    <select
      value={value || ''}
      onChange={handleChange}
      disabled={isSaving}
      onClick={(e) => e.stopPropagation()}
      className="h-8 text-xs rounded-md border border-input bg-background px-3 py-1 hover:bg-accent hover:ring-1 hover:ring-yellow-400 transition-all cursor-pointer disabled:opacity-50"
      title="Cliquer pour modifier"
    >
      <option value="">
        {placeholder}
      </option>
      {options.map(opt => (
        <option key={opt.value} value={opt.value}>
          {opt.icon} {opt.label}
        </option>
      ))}
    </select>
  )
}
