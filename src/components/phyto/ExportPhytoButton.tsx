"use client"

/**
 * DEV3 audit Marc 2026-05-14 - Bloquant #2.
 *
 * Bouton d'export du registre phyto (PDF ou CSV) avec dialog de filtres :
 *   - Période (from, to)
 *   - Parcelle d'application
 *   - Produit (recherche libre)
 *   - Méthode de traitement
 *
 * L'export consomme la route /api/registre-phyto/export.
 */

import * as React from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Download, FileText } from "lucide-react"
import { METHODES_TRAITEMENT, PRODUIT_CLASSIFICATIONS } from "@/lib/phyto/methodes"

interface ExportPhytoButtonProps {
  format: "pdf" | "csv"
}

export function ExportPhytoButton({ format }: ExportPhytoButtonProps) {
  const [open, setOpen] = React.useState(false)
  const [from, setFrom] = React.useState(() => `${new Date().getFullYear()}-01-01`)
  const [to, setTo] = React.useState(() => `${new Date().getFullYear()}-12-31`)
  const [parcelleId, setParcelleId] = React.useState("")
  const [especeId, setEspeceId] = React.useState("")
  const [produit, setProduit] = React.useState("")
  const [methode, setMethode] = React.useState("")
  const [parcelles, setParcelles] = React.useState<{ id: string; nom: string }[]>([])
  const [downloading, setDownloading] = React.useState(false)

  React.useEffect(() => {
    if (!open) return
    fetch("/api/parcelles")
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        const arr = Array.isArray(data) ? data : Array.isArray(data?.data) ? data.data : []
        setParcelles(arr.map((p: { id: string; nom: string }) => ({ id: p.id, nom: p.nom })))
      })
      .catch(() => {})
  }, [open])

  const handleExport = async () => {
    setDownloading(true)
    try {
      const params = new URLSearchParams({
        format,
        from,
        to,
        ...(parcelleId && parcelleId !== "all" ? { parcelleId } : {}),
        ...(especeId ? { especeId } : {}),
        ...(produit ? { produit } : {}),
        ...(methode && methode !== "all" ? { methode } : {}),
      })
      const res = await fetch(`/api/registre-phyto/export?${params}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert("Erreur export : " + (err.error || res.statusText))
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `registre-phyto-${from}_${to}.${format}`
      link.click()
      URL.revokeObjectURL(url)
      setOpen(false)
    } finally {
      setDownloading(false)
    }
  }

  const Icon = format === "pdf" ? FileText : Download
  const label = format === "pdf" ? "PDF" : "CSV"

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
          <Icon className="h-3 w-3" />
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Icon className="h-4 w-4" />
            Export registre phyto ({label})
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Du</Label>
              <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Au</Label>
              <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Parcelle (toutes par défaut)</Label>
            <Select value={parcelleId} onValueChange={setParcelleId}>
              <SelectTrigger><SelectValue placeholder="Toutes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {parcelles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Méthode / Classification</Label>
            <Select value={methode} onValueChange={setMethode}>
              <SelectTrigger><SelectValue placeholder="Toutes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes</SelectItem>
                {PRODUIT_CLASSIFICATIONS.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
                {METHODES_TRAITEMENT.map((m) => (
                  <SelectItem key={m.slug} value={m.slug}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Produit (recherche libre)</Label>
            <Input
              placeholder="Ex: bouillie bordelaise"
              value={produit}
              onChange={(e) => setProduit(e.target.value)}
            />
          </div>
          <div>
            <Label className="text-xs">Espèce</Label>
            <Input
              placeholder="Ex: Pommier"
              value={especeId}
              onChange={(e) => setEspeceId(e.target.value)}
            />
          </div>
          <Button onClick={handleExport} disabled={downloading} className="w-full">
            {downloading ? "Téléchargement…" : `Télécharger le ${label}`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
