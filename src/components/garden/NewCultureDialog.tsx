"use client"

import * as React from "react"
import { useSession } from "next-auth/react"
import { format } from "date-fns"
import { Save } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { confirmDialog } from "@/lib/global-dialog"
import { RotationAdviceCompact } from "@/components/planche"
import { EspeceCombobox, type EspeceOption } from "@/components/especes/EspeceCombobox"

function weekToDate(year: number, week: number): Date {
  const jan4 = new Date(year, 0, 4)
  const dayOfWeek = jan4.getDay() || 7
  const monday = new Date(jan4)
  monday.setDate(jan4.getDate() - dayOfWeek + 1 + (week - 1) * 7)
  return monday
}

interface ITPData {
  id: string
  especeId: string | null
  semaineSemis: number | null
  semainePlantation: number | null
  semaineRecolte: number | null
  nbRangs: number | null
  espacement: number | null
}

interface NewCultureDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  plancheId: string
  plancheNom: string
  plancheLongueur: number | null
  onCreated: () => void
}

export function NewCultureDialog({ open, onOpenChange, plancheId, plancheNom, plancheLongueur, onCreated }: NewCultureDialogProps) {
  const { toast } = useToast()
  const [especes, setEspeces] = React.useState<EspeceOption[]>([])
  const [varietes, setVarietes] = React.useState<{ id: string }[]>([])
  const [itps, setItps] = React.useState<ITPData[]>([])
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const [especeId, setEspeceId] = React.useState("")
  const [varieteId, setVarieteId] = React.useState<string | null>(null)
  const [itpId, setItpId] = React.useState<string | null>(null)
  const [annee] = React.useState(new Date().getFullYear())
  const [dateSemis, setDateSemis] = React.useState<string>("")
  const [datePlantation, setDatePlantation] = React.useState<string>("")
  const [dateRecolte, setDateRecolte] = React.useState<string>("")
  const [nbRangs, setNbRangs] = React.useState<number | null>(null)
  const [longueur, setLongueur] = React.useState<number | null>(plancheLongueur)
  const [espacement, setEspacement] = React.useState<number | null>(null)
  const [quantite, setQuantite] = React.useState<number | null>(null)
  const [notes, setNotes] = React.useState("")

  // Reset quand on ouvre
  React.useEffect(() => {
    if (open) {
      setEspeceId("")
      setVarieteId(null)
      setItpId(null)
      setDateSemis("")
      setDatePlantation("")
      setDateRecolte("")
      setNbRangs(null)
      setLongueur(plancheLongueur)
      setEspacement(null)
      setQuantite(null)
      setNotes("")
    }
  }, [open, plancheLongueur])

  // Charger les especes (visibles : Gleba officiel + communauté + mes perso)
  const loadEspeces = React.useCallback(() => {
    return fetch("/api/especes?pageSize=500")
      .then(r => r.json())
      .then(d => setEspeces(d.data || []))
      .catch(() => setEspeces([]))
  }, [])

  React.useEffect(() => {
    if (!open) return
    loadEspeces()
  }, [open, loadEspeces])

  const { data: authSession } = useSession()
  const currentUserId = (authSession?.user as { id?: string } | undefined)?.id ?? null

  // Création d'une espèce perso (ex. Maracuja) directement depuis le sélecteur.
  const handleCreateEspece = async (nom: string) => {
    try {
      const res = await fetch("/api/especes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: nom, type: "legume", vivace: false, aPlanifier: true }),
      })
      const created = await res.json().catch(() => null)
      if (res.ok && created?.id) {
        await loadEspeces()
        setEspeceId(created.id)
        toast({ title: "Espèce perso créée", description: `« ${created.id} » ajoutée à votre catalogue.` })
      } else {
        toast({ variant: "destructive", title: "Erreur", description: created?.error || "Impossible de créer l'espèce" })
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Erreur réseau" })
    }
  }

  // Charger varietes + ITPs quand espece change
  React.useEffect(() => {
    if (!especeId) {
      setVarietes([])
      setItps([])
      setItpId(null)
      return
    }
    Promise.all([
      fetch(`/api/especes/${encodeURIComponent(especeId)}`).then(r => r.json()),
      fetch(`/api/itps?especeId=${encodeURIComponent(especeId)}&pageSize=500`).then(r => r.json()),
    ]).then(([especeData, itpsData]) => {
      setVarietes(especeData.varietes || [])
      const loaded = itpsData.data || []
      setItps(loaded)
      if (loaded.length > 0) {
        setItpId(loaded[0].id)
      } else {
        setItpId(null)
      }
    }).catch(() => {
      setVarietes([])
      setItps([])
      setItpId(null)
    })
  }, [especeId])

  // Remplir dates et quantites depuis ITP
  React.useEffect(() => {
    if (!itpId) return
    const itp = itps.find(i => i.id === itpId)
    if (!itp) return
    // Chronologie : une étape dont la semaine est antérieure au semis tombe l'année
    // suivante (ITP chevauchant deux années, ex. semis août → récolte janvier).
    if (itp.semaineSemis) setDateSemis(format(weekToDate(annee, itp.semaineSemis), "yyyy-MM-dd"))
    if (itp.semainePlantation) {
      const an = itp.semaineSemis && itp.semainePlantation < itp.semaineSemis ? annee + 1 : annee
      setDatePlantation(format(weekToDate(an, itp.semainePlantation), "yyyy-MM-dd"))
    }
    if (itp.semaineRecolte) {
      const ref = itp.semainePlantation ?? itp.semaineSemis
      const an = ref && itp.semaineRecolte < ref ? annee + 1 : annee
      setDateRecolte(format(weekToDate(an, itp.semaineRecolte), "yyyy-MM-dd"))
    }
    if (itp.nbRangs) setNbRangs(itp.nbRangs)
    if (itp.espacement) setEspacement(Math.round(itp.espacement))
  }, [itpId, itps, annee])

  // Auto-calculer quantite
  React.useEffect(() => {
    if (nbRangs && longueur && espacement && espacement > 0) {
      setQuantite(nbRangs * Math.floor((longueur * 100) / espacement))
    }
  }, [nbRangs, longueur, espacement])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!especeId) return

    setIsSubmitting(true)
    try {
      const toISO = (d: string) => d ? new Date(d).toISOString() : null
      const body: Record<string, unknown> = {
        especeId,
        varieteId: varieteId || null,
        itpId: itpId || null,
        plancheId,
        annee,
        dateSemis: toISO(dateSemis),
        datePlantation: toISO(datePlantation),
        dateRecolte: toISO(dateRecolte),
        semisFait: false,
        plantationFaite: false,
        recolteFaite: false,
        terminee: null,
        quantite,
        nbRangs,
        longueur,
        espacement,
        notes: notes || null,
      }

      const tryPost = async (confirmRotation: boolean) =>
        fetch("/api/cultures", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...body, confirmRotation }),
        })

      let response = await tryPost(false)

      // Bug #1 — Confirmation violation rotation (dialog déjà imbriqué :
      // on utilise confirm() natif pour ne pas empiler les Dialog shadcn).
      if (response.status === 409) {
        const payload = await response.json()
        if (payload?.rotationViolation) {
          const ok = await confirmDialog(
            `⚠️ ${payload.rotationViolation.message}\n\nCréer la culture quand même ? Elle sera marquée « rotation violée ».`
          )
          if (!ok) {
            setIsSubmitting(false)
            return
          }
          response = await tryPost(true)
        }
      }

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erreur lors de la création")
      }

      const culture = await response.json()
      toast({
        title: "Culture créée",
        description: `Culture #${culture.id} ajoutée sur ${plancheNom}`,
      })
      onOpenChange(false)
      onCreated()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur inconnue",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nouvelle culture sur {plancheNom}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Espece — Bug #12 + #31 combobox searchable + filtre maraîchage */}
          <div>
            <Label className="text-sm">Espèce *</Label>
            <div className="mt-1">
              <EspeceCombobox
                options={especes}
                value={especeId || null}
                onChange={(id) => setEspeceId(id || "")}
                defaultTypes={["legume", "aromatique", "engrais_vert"]}
                recentStorageKey="espece-recents-garden"
                placeholder="Rechercher une espèce…"
                currentUserId={currentUserId}
                onCreate={handleCreateEspece}
              />
            </div>
          </div>

          {/* Conseils de rotation */}
          {especeId && (
            <RotationAdviceCompact
              plancheId={plancheNom}
              especeId={especeId}
              year={annee}
            />
          )}

          {/* Variete */}
          {varietes.length > 0 && (
            <div>
              <Label className="text-sm">Variété</Label>
              <Select value={varieteId || undefined} onValueChange={setVarieteId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  {varietes.map(v => (
                    <SelectItem key={v.id} value={v.id}>{v.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* ITP */}
          {itps.length > 0 && (
            <div>
              <Label className="text-sm">Itinéraire technique</Label>
              <Select value={itpId || undefined} onValueChange={setItpId}>
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Sélectionner un ITP" />
                </SelectTrigger>
                <SelectContent>
                  {itps.map(itp => (
                    <SelectItem key={itp.id} value={itp.id}>{itp.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Semis</Label>
              <Input type="date" className="mt-1" value={dateSemis} onChange={e => setDateSemis(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Plantation</Label>
              <Input type="date" className="mt-1" value={datePlantation} onChange={e => setDatePlantation(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Récolte</Label>
              <Input type="date" className="mt-1" value={dateRecolte} onChange={e => setDateRecolte(e.target.value)} />
            </div>
          </div>

          {/* Quantites */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Longueur (m)</Label>
              <Input type="number" step="0.1" className="mt-1" value={longueur ?? ""} onChange={e => setLongueur(e.target.value ? parseFloat(e.target.value) : null)} />
            </div>
            <div>
              <Label className="text-xs">Nb rangs</Label>
              <Input type="number" min="1" className="mt-1" value={nbRangs ?? ""} onChange={e => setNbRangs(e.target.value ? parseInt(e.target.value) : null)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Espacement (cm)</Label>
              <Input type="number" min="1" className="mt-1" value={espacement ?? ""} onChange={e => setEspacement(e.target.value ? parseInt(e.target.value) : null)} />
            </div>
            <div>
              <Label className="text-xs">Quantite (auto)</Label>
              <Input type="number" className="mt-1" value={quantite ?? ""} onChange={e => setQuantite(e.target.value ? parseFloat(e.target.value) : null)} />
            </div>
          </div>

          {/* Notes */}
          <div>
            <Label className="text-xs">Notes</Label>
            <Textarea className="mt-1" rows={2} placeholder="Notes..." value={notes} onChange={e => setNotes(e.target.value)} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Annuler</Button>
            <Button type="submit" disabled={isSubmitting || !especeId}>
              <Save className="h-4 w-4 mr-2" />
              {isSubmitting ? "..." : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
