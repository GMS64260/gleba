"use client"

import { useId } from "react"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"

export function MotifRectificationField({ value, onChange }: {
  value: string
  onChange: (value: string) => void
}) {
  const id = useId()
  return (
    <div>
      <Label htmlFor={id}>Motif de la rectification *</Label>
      <Textarea id={id} value={value} onChange={(e) => onChange(e.target.value)}
        required maxLength={500} rows={2} aria-describedby={`${id}-aide`} />
      <p id={`${id}-aide`} className="mt-1 text-xs text-muted-foreground">Expliquez la correction du traitement réalisé. Le motif sera conservé dans l’historique du registre.</p>
    </div>
  )
}
