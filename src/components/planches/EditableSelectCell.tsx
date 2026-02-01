"use client"

/**
 * Cellule éditable pour tanstack-table
 * Click → Select dropdown → Save auto
 */

import * as React from "react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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

  const handleChange = async (newValue: string) => {
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

      setIsEditing(false)
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

  if (!isEditing) {
    return (
      <div
        onClick={() => setIsEditing(true)}
        className="cursor-pointer hover:bg-yellow-50 hover:ring-1 hover:ring-yellow-400 rounded px-2 py-1 transition-all inline-block"
        title="Cliquer pour modifier"
      >
        {value ? (
          <span className="text-xs font-medium">{displayValue}</span>
        ) : (
          <span className="text-xs text-muted-foreground">{placeholder}</span>
        )}
      </div>
    )
  }

  return (
    <div onClick={(e) => e.stopPropagation()}>
      <Select
        value={value || ''}
        onValueChange={handleChange}
        disabled={isSaving}
        open={isEditing}
        onOpenChange={setIsEditing}
      >
        <SelectTrigger className="h-8 text-xs w-[140px]">
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="">
            <span className="text-muted-foreground">{placeholder}</span>
          </SelectItem>
          {options.map(opt => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.icon} {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
