"use client"

/**
 * PROMPT 16 LOT A — Composant ImageUploader réutilisable.
 *
 * Usage :
 *   <ImageUploader
 *     value={form.photoUrl}
 *     onChange={(url) => setForm({ ...form, photoUrl: url })}
 *   />
 *
 * Features :
 *   - Drag & drop + click to pick
 *   - Preview live de l'image
 *   - Bouton "Retirer" qui repasse la valeur à null
 *   - État loading pendant l'upload
 *   - Affichage des erreurs de l'API (413 trop gros, 415 format, etc.)
 *
 * Stratégie : POST vers /api/upload/image qui renvoie `{ url, thumbnailUrl }`.
 * On stocke `url` (la version 1200px) ; la miniature reste accessible mais
 * non utilisée côté caller pour simplifier l'API.
 */

import * as React from "react"
import { Button } from "@/components/ui/button"
import { ImagePlus, X, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface Props {
  value?: string | null
  onChange: (url: string | null) => void
  /** Texte affiché dans l'état vide */
  placeholder?: string
  /** Hauteur du conteneur (Tailwind class), défaut h-48 */
  heightClass?: string
  /** Désactive le composant (édition impossible) */
  disabled?: boolean
}

export function ImageUploader({
  value,
  onChange,
  placeholder = "Glisser une image ici ou cliquer pour choisir",
  heightClass = "h-48",
  disabled = false,
}: Props) {
  const { toast } = useToast()
  const [uploading, setUploading] = React.useState(false)
  const [dragOver, setDragOver] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement | null>(null)

  const upload = async (file: File) => {
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/upload/image", {
        method: "POST",
        body: fd,
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: "Upload échoué",
          description: body.error || `HTTP ${res.status}`,
        })
        return
      }
      onChange(body.url as string)
      toast({ title: "Image téléversée" })
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Upload échoué",
        description: err instanceof Error ? err.message : "Erreur réseau",
      })
    } finally {
      setUploading(false)
    }
  }

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    if (f) upload(f)
    // reset input pour permettre de re-upload le même fichier
    e.target.value = ""
  }

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setDragOver(false)
    if (disabled || uploading) return
    const f = e.dataTransfer.files?.[0]
    if (f) upload(f)
  }

  return (
    <div className="space-y-2">
      {value ? (
        // ── Preview avec bouton "Retirer" ──
        <div className={`relative ${heightClass} w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-50`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt="Aperçu"
            className="h-full w-full object-cover"
          />
          {!disabled && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={() => onChange(null)}
              className="absolute right-2 top-2 h-7 w-7 p-0"
              title="Retirer l'image"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      ) : (
        // ── Zone drag & drop ──
        <div
          onClick={() => !disabled && !uploading && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            if (!disabled && !uploading) setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`flex ${heightClass} w-full cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed transition-colors ${
            dragOver
              ? "border-blue-400 bg-blue-50"
              : "border-slate-300 bg-slate-50/50 hover:border-slate-400"
          } ${disabled || uploading ? "cursor-not-allowed opacity-60" : ""}`}
        >
          {uploading ? (
            <>
              <Loader2 className="h-6 w-6 animate-spin text-slate-500" />
              <p className="text-sm text-slate-600">Téléversement…</p>
            </>
          ) : (
            <>
              <ImagePlus className="h-7 w-7 text-slate-400" />
              <p className="text-center text-sm text-slate-600 px-4">{placeholder}</p>
              <p className="text-xs text-slate-400">JPG / PNG / WebP — max 5 MB</p>
            </>
          )}
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={onPick}
        disabled={disabled || uploading}
        className="hidden"
      />
    </div>
  )
}
