"use client"

import { useId } from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

export function DarField({ value, onChange, required = false }: {
  value: string
  onChange: (value: string) => void
  required?: boolean
}) {
  const id = useId()
  return (
    <div>
      <Label htmlFor={id}>DAR (jours){required && <span className="text-red-600"> *</span>}</Label>
      <Input id={id} type="number" min="0" step="1" value={value}
        onChange={(e) => onChange(e.target.value)} placeholder="Délai avant récolte"
        aria-describedby={`${id}-aide`} />
      <p id={`${id}-aide`} className="mt-1 text-xs text-muted-foreground">0 = aucun délai. Laissez vide si le délai est inconnu.</p>
    </div>
  )
}
