"use client"

/**
 * Composant d'édition inline pour les planches
 * Click sur valeur → devient éditable → Save automatique
 */

import * as React from "react"
import { Check, X } from "lucide-react"
import { Combobox, type ComboboxOption } from "@/components/ui/combobox"

interface InlineEditFieldProps {
  value: string | number | null
  onSave: (value: string | null) => Promise<void>
  type?: 'text' | 'number' | 'select' | 'combobox'
  options?: string[]
  comboboxOptions?: ComboboxOption[]
  unit?: string
  placeholder?: string
  className?: string
}

export function InlineEditField({
  value,
  onSave,
  type = 'text',
  options,
  comboboxOptions,
  unit = '',
  placeholder = '-',
  className = '',
}: InlineEditFieldProps) {
  const [isEditing, setIsEditing] = React.useState(false)
  const [editValue, setEditValue] = React.useState('')
  const [isSaving, setIsSaving] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement | HTMLSelectElement>(null)

  const displayValue = value !== null && value !== '' ? `${value}${unit}` : placeholder

  React.useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isEditing])

  const handleEdit = () => {
    setEditValue(value?.toString() || '')
    setIsEditing(true)
  }

  const handleSave = async () => {
    setIsSaving(true)
    try {
      const finalValue = editValue.trim() === '' ? null : editValue
      await onSave(finalValue)
      setIsEditing(false)
    } catch (error) {
      console.error('Erreur sauvegarde:', error)
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setIsEditing(false)
    setEditValue('')
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleSave()
    } else if (e.key === 'Escape') {
      handleCancel()
    }
  }

  if (!isEditing) {
    return (
      <span
        onClick={handleEdit}
        className={`cursor-pointer hover:bg-yellow-50 hover:ring-1 hover:ring-yellow-400 rounded px-2 py-1 transition-all ${className}`}
        title="Cliquer pour modifier"
      >
        {displayValue}
      </span>
    )
  }

  if (type === 'select' && options) {
    return (
      <div className="flex items-center gap-1">
        <select
          ref={inputRef as React.RefObject<HTMLSelectElement>}
          value={editValue}
          onChange={(e) => setEditValue(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isSaving}
          className="w-full rounded border border-green-500 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <option value="">-</option>
          {options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="text-green-600 hover:text-green-700 disabled:opacity-50"
          title="Enregistrer"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          onClick={handleCancel}
          disabled={isSaving}
          className="text-gray-400 hover:text-gray-600"
          title="Annuler"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  if (type === 'combobox' && comboboxOptions) {
    return (
      <div className="flex items-center gap-1">
        <Combobox
          value={editValue}
          onValueChange={(v) => setEditValue(v)}
          options={comboboxOptions}
          placeholder={placeholder}
          disabled={isSaving}
          className="w-full rounded border border-green-500 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
        />
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="text-green-600 hover:text-green-700 disabled:opacity-50"
          title="Enregistrer (Entrée)"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          onClick={handleCancel}
          disabled={isSaving}
          className="text-gray-400 hover:text-gray-600"
          title="Annuler (Échap)"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1">
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type={type}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={isSaving}
        step={type === 'number' ? '0.1' : undefined}
        className="w-full rounded border border-green-500 px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
      />
      <button
        onClick={handleSave}
        disabled={isSaving}
        className="text-green-600 hover:text-green-700 disabled:opacity-50"
        title="Enregistrer (Entrée)"
      >
        <Check className="h-4 w-4" />
      </button>
      <button
        onClick={handleCancel}
        disabled={isSaving}
        className="text-gray-400 hover:text-gray-600"
        title="Annuler (Échap)"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
