"use client"

/**
 * Dialog d'édition rapide d'un ITP depuis le calendrier Gantt
 * Permet de modifier les semaines et durées directement
 */

import * as React from "react"
import { Save, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"

interface ITPWithEspece {
  id: string
  especeId: string | null
  espece?: {
    id: string
    couleur: string | null
  } | null
  semaineSemis: number | null
  semainePlantation: number | null
  semaineRecolte: number | null
  dureeRecolte: number | null
  typePlanche: string | null
  notes: string | null
}

interface ItpEditDialogProps {
  itp: ITPWithEspece | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (updated: ITPWithEspece) => void
}

export function ItpEditDialog({ itp, open, onOpenChange, onSaved }: ItpEditDialogProps) {
  const { toast } = useToast()
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const [semaineSemis, setSemaineSemis] = React.useState<number | null>(null)
  const [semainePlantation, setSemainePlantation] = React.useState<number | null>(null)
  const [semaineRecolte, setSemaineRecolte] = React.useState<number | null>(null)
  const [dureeRecolte, setDureeRecolte] = React.useState<number | null>(null)
  const [typePlanche, setTypePlanche] = React.useState<string | null>(null)

  // Sync form quand l'ITP change
  React.useEffect(() => {
    if (itp) {
      setSemaineSemis(itp.semaineSemis)
      setSemainePlantation(itp.semainePlantation)
      setSemaineRecolte(itp.semaineRecolte)
      setDureeRecolte(itp.dureeRecolte)
      setTypePlanche(itp.typePlanche)
    }
  }, [itp])

  if (!itp) return null

  const handleSave = async () => {
    setIsSubmitting(true)
    try {
      const body: Record<string, number | string | null> = {
        semaineSemis,
        semainePlantation,
        semaineRecolte,
        dureeRecolte,
        typePlanche,
      }

      const response = await fetch(`/api/itps/${encodeURIComponent(itp.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erreur lors de la mise à jour")
      }

      const updated = await response.json()

      toast({
        title: "ITP mis à jour",
        description: `"${itp.id}" modifié avec succès`,
      })

      onSaved({
        ...itp,
        semaineSemis,
        semainePlantation,
        semaineRecolte,
        dureeRecolte,
        typePlanche,
        espece: updated.espece || itp.espece,
      })
      onOpenChange(false)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur lors de la mise à jour",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const parseWeek = (value: string): number | null => {
    if (!value) return null
    const n = parseInt(value)
    if (isNaN(n) || n < 1 || n > 52) return null
    return n
  }

  const parseDuration = (value: string): number | null => {
    if (!value) return null
    const n = parseInt(value)
    if (isNaN(n) || n < 0 || n > 52) return null
    return n
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {itp.espece?.couleur && (
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: itp.espece.couleur }}
              />
            )}
            {itp.id}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            {itp.especeId && <span>{itp.especeId}</span>}
            {itp.typePlanche && (
              <Badge variant="outline" className="text-xs">{itp.typePlanche}</Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Semaines */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-orange-600">Semaine semis</Label>
              <Input
                type="number"
                min={1}
                max={52}
                placeholder="1-52"
                value={semaineSemis ?? ""}
                onChange={(e) => setSemaineSemis(parseWeek(e.target.value))}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-green-600">Sem. plantation</Label>
              <Input
                type="number"
                min={1}
                max={52}
                placeholder="1-52"
                value={semainePlantation ?? ""}
                onChange={(e) => setSemainePlantation(parseWeek(e.target.value))}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-purple-600">Sem. récolte</Label>
              <Input
                type="number"
                min={1}
                max={52}
                placeholder="1-52"
                value={semaineRecolte ?? ""}
                onChange={(e) => setSemaineRecolte(parseWeek(e.target.value))}
                className="h-9"
              />
            </div>
          </div>

          {/* Durée récolte + Type planche */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Durée récolte (sem.)</Label>
              <Input
                type="number"
                min={0}
                max={52}
                placeholder="Ex: 4"
                value={dureeRecolte ?? ""}
                onChange={(e) => setDureeRecolte(parseDuration(e.target.value))}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Type de planche</Label>
              <Select
                value={typePlanche || "_none"}
                onValueChange={(v) => setTypePlanche(v === "_none" ? null : v)}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">Non spécifié</SelectItem>
                  <SelectItem value="Serre">Serre</SelectItem>
                  <SelectItem value="Plein champ">Plein champ</SelectItem>
                  <SelectItem value="Tunnel">Tunnel</SelectItem>
                  <SelectItem value="Chassis">Chassis</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Mini preview Gantt */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium text-muted-foreground">Aperçu</Label>
            <GanttPreview
              semaineSemis={semaineSemis}
              semainePlantation={semainePlantation}
              semaineRecolte={semaineRecolte}
              dureeRecolte={dureeRecolte}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Annuler
          </Button>
          <Button onClick={handleSave} disabled={isSubmitting}>
            <Save className="h-4 w-4 mr-2" />
            {isSubmitting ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/** Mini barre Gantt de preview dans le dialog */
function GanttPreview({
  semaineSemis,
  semainePlantation,
  semaineRecolte,
  dureeRecolte,
}: {
  semaineSemis: number | null
  semainePlantation: number | null
  semaineRecolte: number | null
  dureeRecolte: number | null
}) {
  const bars: { start: number; width: number; color: string; label: string }[] = []

  if (semaineSemis && semainePlantation) {
    bars.push({
      start: (semaineSemis / 52) * 100,
      width: ((semainePlantation - semaineSemis) / 52) * 100,
      color: '#ff9800',
      label: 'Semis',
    })
  } else if (semaineSemis && semaineRecolte && !semainePlantation) {
    bars.push({
      start: (semaineSemis / 52) * 100,
      width: ((semaineRecolte - semaineSemis) / 52) * 100,
      color: '#ff9800',
      label: 'Semis',
    })
  }

  if (semainePlantation && semaineRecolte) {
    bars.push({
      start: (semainePlantation / 52) * 100,
      width: ((semaineRecolte - semainePlantation) / 52) * 100,
      color: '#4caf50',
      label: 'Croissance',
    })
  }

  if (semaineRecolte && dureeRecolte) {
    bars.push({
      start: (semaineRecolte / 52) * 100,
      width: (dureeRecolte / 52) * 100,
      color: '#9c27b0',
      label: 'Récolte',
    })
  }

  const months = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"]

  return (
    <div className="relative h-10 bg-muted/50 rounded border overflow-hidden">
      {/* Grilles mois */}
      <div className="absolute inset-0 flex">
        {months.map((m, i) => (
          <div key={i} className="flex-1 border-r border-gray-200 flex items-end justify-center pb-0.5">
            <span className="text-[9px] text-muted-foreground">{m}</span>
          </div>
        ))}
      </div>
      {/* Barres */}
      {bars.map((bar, i) => (
        <div
          key={i}
          className="absolute rounded-sm opacity-80"
          style={{
            left: `${Math.max(0, bar.start)}%`,
            width: `${Math.max(0, bar.width)}%`,
            top: '4px',
            height: '18px',
            backgroundColor: bar.color,
          }}
        />
      ))}
    </div>
  )
}
