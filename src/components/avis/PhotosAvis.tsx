"use client"

/* Les URLs des photos vérifient la session ; ne pas les faire transiter par le cache Next Image. */
/* eslint-disable @next/next/no-img-element */

import * as React from "react"
import { Camera, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { preparerPhotoAvis } from "@/lib/avis/photos"

export interface PhotoAvisAffichable {
  id: string
  url: string
}

export async function photosPourEnvoi(fichiers: File[]): Promise<{ dataUrl: string }[]> {
  return Promise.all(fichiers.map(preparerPhotoAvis))
}

export function GaleriePhotosAvis({ photos, retrait, disabled = false }: { photos: PhotoAvisAffichable[]; retrait?: (id: string) => void; disabled?: boolean }) {
  if (!photos.length) return null
  return <div className="mt-3 grid grid-cols-3 gap-2">{photos.map((photo, index) => <div key={photo.id} className="relative min-w-0"><a href={photo.url} target="_blank" rel="noopener noreferrer" aria-label={`Agrandir la photo ${index + 1}`} className="block overflow-hidden rounded-lg border">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={photo.url} alt={`Photo partagée ${index + 1}`} loading="lazy" className="aspect-square w-full object-cover" /></a>{retrait && <Button type="button" size="icon" variant="secondary" className="absolute right-1 top-1 h-8 w-8" disabled={disabled} aria-label={`Retirer la photo ${index + 1}`} onClick={() => retrait(photo.id)}><X className="h-4 w-4" /></Button>}</div>)}</div>
}

export function SelecteurPhotosAvis({ fichiers, onChange, existantes = 0, disabled = false }: { fichiers: File[]; onChange: (fichiers: File[]) => void; existantes?: number; disabled?: boolean }) {
  const inputId = React.useId()
  const [erreur, setErreur] = React.useState<string | null>(null)
  const [apercus, setApercus] = React.useState<string[]>([])
  React.useEffect(() => {
    const urls = fichiers.map(fichier => URL.createObjectURL(fichier))
    setApercus(urls)
    return () => urls.forEach(url => URL.revokeObjectURL(url))
  }, [fichiers])
  const places = Math.max(0, 3 - existantes - fichiers.length)
  return <div className="space-y-2"><div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-medium">Photos de votre récolte ou de votre culture</span><span className="text-xs text-muted-foreground">{existantes + fichiers.length}/3</span></div>{places > 0 && <label htmlFor={inputId} className={`inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm ${disabled ? "pointer-events-none opacity-50" : "hover:bg-muted"}`}><Camera className="h-4 w-4" aria-hidden />Ajouter des photos<input id={inputId} type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" multiple disabled={disabled} className="sr-only" onChange={event => {
    const selection = Array.from(event.target.files ?? [])
    event.target.value = ""
    if (selection.some(fichier => !/^(image\/(jpeg|jpg|png|webp|heic|heif))$/i.test(fichier.type) && !(fichier.type === "" && /\.(jpe?g|png|webp|heic|heif)$/i.test(fichier.name)))) { setErreur("Choisissez des photos JPEG, PNG, WebP ou HEIC lisibles par votre appareil."); return }
    if (selection.some(fichier => fichier.size > 20 * 1024 * 1024)) { setErreur("Chaque photo doit peser moins de 20 Mo."); return }
    if (selection.length > places) { setErreur("Vous pouvez joindre 3 photos au maximum."); return }
    setErreur(null)
    onChange([...fichiers, ...selection])
  }} /></label>}<p className="text-xs text-muted-foreground">JPEG, PNG, WebP ou HEIC compatible · 20 Mo maximum avant compression.</p>{apercus.length > 0 && <div className="grid grid-cols-3 gap-2">{apercus.map((url, index) => <div key={url} className="relative min-w-0">{/* eslint-disable-next-line @next/next/no-img-element */}<img src={url} alt={`Aperçu de la photo ${index + 1}`} className="aspect-square w-full rounded-lg border object-cover" /><Button type="button" variant="secondary" size="icon" className="absolute right-1 top-1 h-8 w-8" aria-label={`Retirer la nouvelle photo ${index + 1}`} disabled={disabled} onClick={() => onChange(fichiers.filter((_, i) => i !== index))}><X className="h-4 w-4" /></Button></div>)}</div>}{erreur && <p role="alert" className="text-sm text-red-700">{erreur}</p>}</div>
}
