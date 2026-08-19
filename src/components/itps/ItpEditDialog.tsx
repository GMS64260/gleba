"use client"

/**
 * Dialog d'édition rapide d'un ITP depuis le calendrier Gantt
 * Permet de modifier les semaines et durées directement
 */

import * as React from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { Save } from "lucide-react"

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
import { nomAffichableItp } from "@/lib/itp-label"
import { decalerSemaine } from "@/lib/calendrier-climat"
import type { ItpVue } from "./types"

interface ItpEditDialogProps {
  itp: ItpVue | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (updated: ItpVue) => void
  /**
   * Décalage appliqué par l'écran appelant pour l'affichage (calage climatique
   * du lecteur + réglage fin). Le dialog édite les semaines DE LA SOURCE : sans
   * cette information, les barres du calendrier et les champs du dialog
   * affichaient deux semaines différentes pour le même itinéraire, sans un mot.
   */
  decalage?: number
}

export function ItpEditDialog({
  itp,
  open,
  onOpenChange,
  onSaved,
  decalage = 0,
}: ItpEditDialogProps) {
  const { toast } = useToast()
  const { data: session } = useSession()
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

  // Même règle que la fiche ITP (/maraichage/itps/[id]) : seul l'auteur d'un ITP
  // personnel — ou un admin — peut le modifier, et jamais une référence sourcée.
  // Ce dialog ne la connaissait pas : les 241 itinéraires officiels non sourcés
  // s'ouvraient en édition pour n'importe quel membre, avec un 403 au moment
  // d'enregistrer. On montre désormais la même consultation en lecture seule.
  const currentUserId = (session?.user as { id?: string } | undefined)?.id
  const canEdit =
    !itp.sourceRecordId &&
    (session?.user?.role === "ADMIN" ||
      (!!itp.userId && !!currentUserId && itp.userId === currentUserId))

  if (!canEdit) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{nomAffichableItp(itp)}</DialogTitle>
            <DialogDescription>
              {itp.sourceRecordId
                ? "Référence documentée protégée : les fenêtres publiées ne sont pas modifiables directement depuis le calendrier."
                : "Itinéraire du catalogue Gleba : consultable, non modifiable. Créez un ITP personnel pour l'adapter à votre ferme."}
            </DialogDescription>
          </DialogHeader>
          {decalage !== 0 && (
            <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              Semaines de la source. Dans votre zone, le calendrier les décale de{" "}
              {decalage > 0 ? "+" : "−"}
              {Math.abs(decalage)} semaine{Math.abs(decalage) > 1 ? "s" : ""}.
            </p>
          )}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Implantation</p>
              <p className="mt-1 font-medium">
                {itp.semaineImplantationDebut && itp.semaineImplantationFin
                  ? `S${itp.semaineImplantationDebut}–S${itp.semaineImplantationFin}`
                  : itp.semaineSemis || itp.semainePlantation
                    ? [
                        itp.semaineSemis ? `semis S${itp.semaineSemis}` : null,
                        itp.semainePlantation ? `plantation S${itp.semainePlantation}` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")
                    : "Non renseignée"}
              </p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Récolte</p>
              <p className="mt-1 font-medium">
                {itp.semaineRecolte && itp.semaineRecolteFin
                  ? `S${itp.semaineRecolte}–S${itp.semaineRecolteFin}`
                  : itp.semaineRecolte
                    ? `S${itp.semaineRecolte}`
                    : "Pluriannuelle ou non renseignée"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Fermer
            </Button>
            <Button asChild>
              <Link href={`/maraichage/itps/${encodeURIComponent(itp.id)}`}>
                {itp.sourceRecordId ? "Voir la source" : "Voir la fiche"}
              </Link>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    )
  }

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
        description: `« ${nomAffichableItp(itp)} » modifié avec succès`,
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

  // Rappel du calage, quand l'écran appelant décale l'affichage.
  const rappelCalage =
    decalage !== 0 ? (
      <p className="rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
        Ces semaines sont celles de la source. Dans votre zone, le calendrier et la planification
        les décalent de {decalage > 0 ? "+" : "−"}
        {Math.abs(decalage)} semaine{Math.abs(decalage) > 1 ? "s" : ""}
        {[
          semaineSemis ? ` — semis S${decalerSemaine(semaineSemis, decalage)}` : null,
          semainePlantation ? `, plantation S${decalerSemaine(semainePlantation, decalage)}` : null,
          semaineRecolte ? `, récolte S${decalerSemaine(semaineRecolte, decalage)}` : null,
        ]
          .filter(Boolean)
          .join("")}
        .
      </p>
    ) : null

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
            {nomAffichableItp(itp)}
          </DialogTitle>
          <DialogDescription className="flex items-center gap-2">
            {itp.especeId && <span>{itp.espece?.nom ?? itp.espece?.id ?? itp.especeId}</span>}
            {itp.typePlanche && (
              <Badge variant="outline" className="text-xs">{itp.typePlanche}</Badge>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {rappelCalage}
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

          {/* Durée recolte + Type planche */}
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

  // Bug testeur 2026-05-29 — passage d'année (récolte < semis → +52) sinon
  // largeurs négatives = barres invisibles (Carotte-automne-conservation-serre).
  const dureeSem = (debut: number, fin: number) => (fin >= debut ? fin - debut : fin + 52 - debut)
  const pushBarre = (debut: number, dureeSemaines: number, color: string, label: string) => {
    const start = (debut / 52) * 100
    bars.push({ start, width: Math.min(100 - start, Math.max(0, (dureeSemaines / 52) * 100)), color, label })
  }

  if (semaineSemis && semainePlantation) {
    pushBarre(semaineSemis, dureeSem(semaineSemis, semainePlantation), '#ff9800', 'Semis')
  } else if (semaineSemis && semaineRecolte && !semainePlantation) {
    pushBarre(semaineSemis, dureeSem(semaineSemis, semaineRecolte), '#ff9800', 'Semis')
  }

  if (semainePlantation && semaineRecolte) {
    pushBarre(semainePlantation, dureeSem(semainePlantation, semaineRecolte), '#4caf50', 'Croissance')
  }

  if (semaineRecolte && dureeRecolte) {
    pushBarre(semaineRecolte, dureeRecolte, '#9c27b0', 'Récolte')
  }

  const months = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"]

  return (
    <div className="relative h-10 bg-muted/50 rounded border overflow-hidden">
      {/* Grilles mois */}
      <div className="absolute inset-0 flex">
        {months.map((m, i) => (
          <div key={i} className="flex-1 border-r border-slate-200 flex items-end justify-center pb-0.5">
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
