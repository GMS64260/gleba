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
import { EspeceCombobox, type EspeceOption, type EspeceType } from "@/components/especes/EspeceCombobox"
import {
  NouvelleEspecePersoDialog,
  type NouvelleEspecePerso,
} from "@/components/especes/NouvelleEspecePersoDialog"
import { datesDepuisItp, recolteApresDebut } from "@/lib/cultures/dates-itp"
import { nomAffichableItpAvecFenetre } from "@/lib/itp-label"
import { validateCultureDates } from "@/lib/validations/date-validation"
import { Checkbox } from "@/components/ui/checkbox"
import { cocherApresSaisieManuelle, etapeDejaRealisable } from "@/lib/cultures/deja-fait"

interface ITPData {
  id: string
  nom: string | null
  userId: string | null
  especeId: string | null
  semaineSemis: number | null
  semainePlantation: number | null
  semaineRecolte: number | null
  // QA cmsfxvbab — jalon de début de cycle des ITP « implantation seule »
  // (ni semis ni plantation), cf. semaineSemisEffective.
  semaineImplantationDebut: number | null
  semaineImplantationFin: number | null
  dureeCulture: number | null
  /** Arbres fruitiers : années entre plantation et première récolte. */
  delaiPremiereRecolteAnnees: number | null
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
  const [varietes, setVarietes] = React.useState<{ id: string; nom: string | null }[]>([])
  const [itps, setItps] = React.useState<ITPData[]>([])
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const [especeId, setEspeceId] = React.useState("")
  const [varieteId, setVarieteId] = React.useState<string | null>(null)
  const [itpId, setItpId] = React.useState<string | null>(null)
  const [annee] = React.useState(new Date().getFullYear())
  const [dateSemis, setDateSemis] = React.useState<string>("")
  const [datePlantation, setDatePlantation] = React.useState<string>("")
  const [dateRecolte, setDateRecolte] = React.useState<string>("")
  // Friction 2026-08-23 — « déjà fait » à la création (lib/cultures/deja-fait.ts).
  const [semisDejaFait, setSemisDejaFait] = React.useState(false)
  const [plantationDejaFaite, setPlantationDejaFaite] = React.useState(false)
  const [nbRangs, setNbRangs] = React.useState<number | null>(null)
  const [longueur, setLongueur] = React.useState<number | null>(plancheLongueur)
  const [espacement, setEspacement] = React.useState<number | null>(null)
  const [quantite, setQuantite] = React.useState<number | null>(null)
  const [notes, setNotes] = React.useState("")
  // Dernier début de cycle appliqué : le recalage de la récolte ne suit que
  // les CHANGEMENTS de début, jamais le remplissage initial de l'ITP.
  const debutCycleRef = React.useRef<string | null>(null)

  // Reset quand on ouvre
  React.useEffect(() => {
    if (open) {
      setEspeceId("")
      setVarieteId(null)
      setItpId(null)
      setDateSemis("")
      setDatePlantation("")
      setDateRecolte("")
      setSemisDejaFait(false)
      setPlantationDejaFaite(false)
      debutCycleRef.current = null
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
  // Passe par un dialogue : le type et la famille botanique étaient auparavant
  // forcés à « légume » / aucune, ce qui privait rotation et associations de
  // leur donnée d'entrée (friction du 2026-07-30).
  const [especeACreer, setEspeceACreer] = React.useState<{
    nom: string
    type: EspeceType | undefined
  } | null>(null)

  const handleCreateEspece = (nom: string, typeSuggere?: EspeceType) => {
    setEspeceACreer({ nom, type: typeSuggere })
  }

  const handleConfirmEspece = async (data: NouvelleEspecePerso) => {
    try {
      const res = await fetch("/api/especes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: data.nom,
          type: data.type,
          familleId: data.familleId,
          vivace: data.vivace,
          aPlanifier: true,
        }),
      })
      const created = await res.json().catch(() => null)
      if (res.ok && created?.id) {
        await loadEspeces()
        setEspeceId(created.id)
        // `created.id` est un cuid pour une espèce perso : afficher `nom`.
        toast({
          title: "Espèce perso créée",
          description: `« ${created.nom ?? created.id} » ajoutée à votre catalogue.`,
        })
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
      fetch(`/api/itps?especeId=${encodeURIComponent(especeId)}&pageSize=1000&applicable=1&calibre=1&sortBy=confiance`).then(r => r.json()),
    ]).then(([especeData, itpsData]) => {
      setVarietes(especeData.varietes || [])
      // La variété de l'espèce précédente restait sélectionnée : la culture
      // partait « Carotte / Tomate Marmande ». Le serveur refuse désormais cette
      // combinaison, le formulaire ne doit plus la produire.
      setVarieteId(null)
      const loaded = itpsData.data || []
      setItps(loaded)
      if (loaded.length > 0) {
        setItpId(loaded[0].id)
      } else {
        setItpId(null)
      }
    }).catch(() => {
      setVarietes([])
      setVarieteId(null)
      setItps([])
      setItpId(null)
    })
  }, [especeId])

  // Remplir dates et quantites depuis ITP
  React.useEffect(() => {
    if (!itpId) return
    const itp = itps.find(i => i.id === itpId)
    if (!itp) return
    // Chronologie garantie croissante par datesDepuisItp : un ITP à cheval sur
    // deux années ne peut plus produire une récolte antérieure à la plantation.
    const cycle = datesDepuisItp(annee, itp)
    if (cycle.dateSemis) setDateSemis(format(cycle.dateSemis, "yyyy-MM-dd"))
    if (cycle.datePlantation) setDatePlantation(format(cycle.datePlantation, "yyyy-MM-dd"))
    if (cycle.dateRecolte) setDateRecolte(format(cycle.dateRecolte, "yyyy-MM-dd"))
    // Le cycle vient d'être posé en bloc : mémoriser son début pour que le
    // recalage de la récolte ne réécrive pas celle de datesDepuisItp.
    const debutCycle = cycle.datePlantation ?? cycle.dateSemis
    if (debutCycle) debutCycleRef.current = format(debutCycle, "yyyy-MM-dd")
    if (itp.nbRangs) setNbRangs(itp.nbRangs)
    if (itp.espacement) setEspacement(Math.round(itp.espacement))
  }, [itpId, itps, annee])

  // Friction 2026-08-14 — la date de récolte SUIT le début de cycle saisi
  // (durée du cycle ITP préservée, `recolteApresDebut`). Éditer la seule
  // récolte ne déclenche rien ; une récolte vidée n'est pas re-remplie.
  React.useEffect(() => {
    const debutStr = datePlantation || dateSemis
    if (!debutStr) return
    const debut = new Date(debutStr)
    if (Number.isNaN(debut.getTime())) return
    const debutChange = debutCycleRef.current !== null && debutCycleRef.current !== debutStr
    debutCycleRef.current = debutStr

    if (!dateRecolte) return
    const recolte = new Date(dateRecolte)
    if (Number.isNaN(recolte.getTime())) return
    const recolteIncoherente = recolte <= debut
    if (!debutChange && !recolteIncoherente) return

    const itp = itps.find((i) => i.id === itpId)
    if (!itp) return
    const nouvelleRecolte = recolteApresDebut(debut, itp)
    if (!nouvelleRecolte) return
    const nouvelleStr = format(nouvelleRecolte, "yyyy-MM-dd")
    if (nouvelleStr !== dateRecolte) setDateRecolte(nouvelleStr)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dateSemis, datePlantation, itpId, itps])

  // Auto-calculer quantite
  React.useEffect(() => {
    if (nbRangs && longueur && espacement && espacement > 0) {
      setQuantite(nbRangs * Math.floor((longueur * 100) / espacement))
    }
  }, [nbRangs, longueur, espacement])

  // La case « déjà fait » ne survit pas à une date devenue future ou vidée,
  // quel que soit le chemin qui a déplacé la date (saisie ou préremplissage
  // ITP) : une étape faite ne peut pas être datée dans le futur.
  React.useEffect(() => {
    if (semisDejaFait && !etapeDejaRealisable(dateSemis)) setSemisDejaFait(false)
  }, [dateSemis, semisDejaFait])
  React.useEffect(() => {
    if (plantationDejaFaite && !etapeDejaRealisable(datePlantation)) setPlantationDejaFaite(false)
  }, [datePlantation, plantationDejaFaite])

  // Contrôle de chronologie en direct : l'API refuse désormais un cycle
  // impossible, autant le dire avant que l'utilisateur clique sur Créer.
  const erreursDates = React.useMemo(() => {
    if (!dateSemis && !datePlantation && !dateRecolte) return []
    return validateCultureDates({
      dateSemis: dateSemis || null,
      datePlantation: datePlantation || null,
      dateRecolte: dateRecolte || null,
      annee,
    }).errors
  }, [dateSemis, datePlantation, dateRecolte, annee])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!especeId || erreursDates.length > 0) return

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
        semisFait: semisDejaFait,
        plantationFaite: plantationDejaFaite,
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
    <>
    <NouvelleEspecePersoDialog
      open={especeACreer !== null}
      onOpenChange={(o) => { if (!o) setEspeceACreer(null) }}
      nomInitial={especeACreer?.nom ?? ""}
      typeInitial={especeACreer?.type ?? "legume"}
      typesProposes={["legume", "aromatique", "fleur", "engrais_vert", "petit_fruit"]}
      onConfirm={handleConfirmEspece}
    />
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90dvh] overflow-y-auto">
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
                defaultTypes={["legume", "aromatique", "fleur", "engrais_vert"]}
                recentStorageKey="espece-recents-garden"
                placeholder="Rechercher une espèce…"
                currentUserId={currentUserId}
                onCreate={handleCreateEspece}
              />
            </div>
          </div>

          {/* Conseils de rotation. Identifiant et non libellé : la création POST
              envoie `plancheId`, le conseil doit porter sur la même planche sans
              repli de résolution par nom. */}
          {especeId && (
            <RotationAdviceCompact
              plancheId={plancheId}
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
                    <SelectItem key={v.id} value={v.id}>{v.nom ?? v.id}</SelectItem>
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
                    <SelectItem key={itp.id} value={itp.id}>{nomAffichableItpAvecFenetre(itp)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <Label className="text-xs">Semis</Label>
              <Input
                type="date"
                className="mt-1"
                value={dateSemis}
                onChange={e => {
                  setDateSemis(e.target.value)
                  // Antidater est le geste de qui enregistre un semis déjà en
                  // terre : la case suit la saisie (lib/cultures/deja-fait.ts).
                  if (cocherApresSaisieManuelle(e.target.value)) setSemisDejaFait(true)
                }}
              />
              {etapeDejaRealisable(dateSemis) && (
                <label className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground cursor-pointer">
                  <Checkbox checked={semisDejaFait} onCheckedChange={(v) => setSemisDejaFait(v === true)} />
                  Déjà semé
                </label>
              )}
            </div>
            <div>
              <Label className="text-xs">Plantation</Label>
              <Input
                type="date"
                className="mt-1"
                value={datePlantation}
                onChange={e => {
                  setDatePlantation(e.target.value)
                  if (cocherApresSaisieManuelle(e.target.value)) setPlantationDejaFaite(true)
                }}
              />
              {etapeDejaRealisable(datePlantation) && (
                <label className="flex items-center gap-1.5 mt-1 text-xs text-muted-foreground cursor-pointer">
                  <Checkbox checked={plantationDejaFaite} onCheckedChange={(v) => setPlantationDejaFaite(v === true)} />
                  Déjà plantée
                </label>
              )}
            </div>
            <div>
              <Label className="text-xs">Récolte</Label>
              <Input type="date" className="mt-1" value={dateRecolte} onChange={e => setDateRecolte(e.target.value)} />
            </div>
          </div>
          {erreursDates.length > 0 && (
            <p className="text-xs text-red-600">{erreursDates.join(" ")}</p>
          )}

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
              <Label className="text-xs">Quantité (auto)</Label>
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
            <Button type="submit" disabled={isSubmitting || !especeId || erreursDates.length > 0}>
              <Save className="h-4 w-4 mr-2" />
              {isSubmitting ? "..." : "Créer"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
    </>
  )
}
