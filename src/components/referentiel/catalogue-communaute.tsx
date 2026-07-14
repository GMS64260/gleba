"use client"

/**
 * Briques d'affichage PARTAGÉES du catalogue communautaire (maraîchage, verger,
 * variétés…), pour un rendu et un comportement identiques partout :
 *  - badge d'origine (Gleba / Communauté / Perso),
 *  - actions sur ses propres entrées perso (proposer à la communauté / rendre
 *    privé / supprimer),
 *  - filtre par origine (Tout / Gleba / Communauté / Mes variétés).
 *
 * Logique de visibilité/origine dans src/lib/referentiel-communaute.ts.
 */

import * as React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Share2, Lock, Trash2, Flag } from "lucide-react"
import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { confirmDialog } from "@/lib/global-dialog"
import { useToast } from "@/hooks/use-toast"
import type { AvisRefType } from "@/lib/avis/types"
import {
  badgeOrigine,
  origineReferentiel,
  type EntreeReferentiel,
} from "@/lib/referentiel-communaute"

export type EntreeCommunaute = { id: string; userId: string | null; partageCommunaute: boolean }

type ToastFn = ReturnType<typeof useToast>["toast"]

/**
 * Handlers PUT (bascule partage communauté) / DELETE (suppression) pour un
 * référentiel communautaire donné. `apiBase` = ex. "/api/varietes", "/api/verger/porte-greffes".
 */
export function useReferentielActions(apiBase: string, refetch: () => void, toast: ToastFn) {
  const togglePartage = React.useCallback(
    async (id: string, nom: string, current: boolean) => {
      const next = !current
      try {
        const res = await fetch(`${apiBase}/${encodeURIComponent(id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ partageCommunaute: next }),
        })
        if (res.ok) {
          toast({ title: next ? "Proposé à la communauté" : "Rendu privé", description: `« ${nom} »` })
          refetch()
        } else {
          const p = await res.json().catch(() => null)
          toast({ variant: "destructive", title: "Erreur", description: p?.error || "Action impossible" })
        }
      } catch {
        toast({ variant: "destructive", title: "Erreur", description: "Action impossible" })
      }
    },
    [apiBase, refetch, toast]
  )

  const remove = React.useCallback(
    async (id: string, nom: string) => {
      if (!(await confirmDialog(`Supprimer « ${nom} » ?`))) return
      try {
        const res = await fetch(`${apiBase}/${encodeURIComponent(id)}`, { method: "DELETE" })
        if (res.ok) {
          toast({ title: "Supprimé", description: `« ${nom} »` })
          refetch()
        } else {
          const p = await res.json().catch(() => null)
          toast({ variant: "destructive", title: "Erreur", description: p?.error || "Suppression impossible" })
        }
      } catch {
        toast({ variant: "destructive", title: "Erreur", description: "Suppression impossible" })
      }
    },
    [apiBase, refetch, toast]
  )

  return { togglePartage, remove }
}

export interface OrigineActions {
  togglePartage: (id: string, nom: string, current: boolean) => void
  remove: (id: string, nom: string) => void
}

/**
 * Bouton « signaler » (décision #3 : modération a posteriori) — signale à la
 * modération une entrée communautaire d'un AUTRE membre. Dialogue autonome
 * (motif libre) → POST /api/signalements.
 */
function SignalerButton({ refType, refId, nom }: { refType: AvisRefType; refId: string; nom: string }) {
  const { toast } = useToast()
  const [open, setOpen] = React.useState(false)
  const [motif, setMotif] = React.useState("")
  const [sending, setSending] = React.useState(false)

  async function submit() {
    if (motif.trim().length < 3) {
      toast({ variant: "destructive", title: "Motif requis", description: "Indiquez brièvement le problème." })
      return
    }
    setSending(true)
    try {
      const res = await fetch("/api/signalements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refType, refId, motif: motif.trim() }),
      })
      if (res.ok) {
        const p = await res.json().catch(() => null)
        toast({
          title: p?.deja ? "Déjà signalé" : "Signalement envoyé",
          description: p?.deja ? `« ${nom} » est déjà en attente de modération.` : `Merci, « ${nom} » a été transmis à la modération.`,
        })
        setOpen(false)
        setMotif("")
      } else {
        const p = await res.json().catch(() => null)
        toast({ variant: "destructive", title: "Erreur", description: p?.error || "Signalement impossible" })
      }
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Signalement impossible" })
    } finally {
      setSending(false)
    }
  }

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 w-8 p-0 hover:bg-orange-100 hover:text-orange-600"
        title="Signaler à la modération"
        onClick={() => setOpen(true)}
      >
        <Flag className="h-4 w-4" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" onClick={(ev) => ev.stopPropagation()}>
          <DialogHeader>
            <DialogTitle>Signaler « {nom} »</DialogTitle>
            <DialogDescription>
              Cette entrée du catalogue communautaire vous semble erronée, inappropriée ou en double ?
              Décrivez le problème : un modérateur la vérifiera.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={motif}
            onChange={(e) => setMotif(e.target.value)}
            placeholder="Ex. : doublon de « Tomate Marmande », données erronées, contenu inapproprié…"
            rows={4}
            maxLength={2000}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={sending}>Annuler</Button>
            <Button onClick={submit} disabled={sending}>{sending ? "Envoi…" : "Signaler"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

/**
 * Badge d'origine + actions (proposer/rendre privé/supprimer) sur ses perso.
 * Rendu partagé, utilisable dans une cellule DataTable comme dans un tableau simple.
 */
export function OrigineControls({
  entree,
  nom,
  currentUserId,
  actions,
  showRemove = true,
  signalerRefType,
}: {
  entree: EntreeCommunaute
  nom: string
  currentUserId: string | null | undefined
  actions: OrigineActions
  /** Afficher le bouton supprimer (désactivé quand la suppression est gérée ailleurs). */
  showRemove?: boolean
  /** Si fourni, affiche le bouton « signaler » sur les entrées communautaires d'autres membres. */
  signalerRefType?: AvisRefType
}) {
  const mine = !!currentUserId && entree.userId === currentUserId
  const badge = badgeOrigine(entree, currentUserId)
  // Signalable : entrée d'un AUTRE membre, proposée à la communauté (pas l'officiel Gleba, pas la mienne).
  const signalable = !!signalerRefType && !mine && entree.userId != null && entree.partageCommunaute
  return (
    <div className="flex items-center gap-1" onClick={(ev) => ev.stopPropagation()}>
      {entree.userId == null ? (
        <Badge variant="outline" className="text-xs text-muted-foreground">Gleba</Badge>
      ) : badge ? (
        <Badge variant="outline" className={`text-xs ${badge.cls}`}>{badge.label}</Badge>
      ) : null}
      {mine && (
        <>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 hover:bg-emerald-100 hover:text-emerald-700"
            title={entree.partageCommunaute ? "Rendre privé (retirer de la communauté)" : "Proposer à la communauté"}
            onClick={() => actions.togglePartage(entree.id, nom, entree.partageCommunaute)}
          >
            {entree.partageCommunaute ? <Lock className="h-4 w-4" /> : <Share2 className="h-4 w-4" />}
          </Button>
          {showRemove && (
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600"
              title="Supprimer"
              onClick={() => actions.remove(entree.id, nom)}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </>
      )}
      {signalable && <SignalerButton refType={signalerRefType!} refId={entree.id} nom={nom} />}
    </div>
  )
}

/** Colonne « Origine » pour un DataTable (@tanstack/react-table). */
export function makeOrigineColumn<T extends EntreeCommunaute>(
  nomOf: (row: T) => string,
  currentUserId: string | undefined | null,
  actions: OrigineActions,
  signalerRefType?: AvisRefType
): ColumnDef<T> {
  return {
    id: "origine",
    header: "Origine",
    enableSorting: false,
    cell: ({ row }) => (
      <OrigineControls
        entree={row.original}
        nom={nomOf(row.original)}
        currentUserId={currentUserId}
        actions={actions}
        signalerRefType={signalerRefType}
      />
    ),
  }
}

// ── Filtre par origine ───────────────────────────────────────────────────────

export type FiltreOrigineValue = "tout" | "gleba" | "communaute" | "perso"

const FILTRES: { key: FiltreOrigineValue; label: string }[] = [
  { key: "tout", label: "Tout" },
  { key: "gleba", label: "Catalogue Gleba" },
  { key: "communaute", label: "Communauté" },
  { key: "perso", label: "Mes variétés" },
]

/** Filtre client d'une liste selon l'origine (cf. origineReferentiel). */
export function filtrerParOrigine<T extends EntreeReferentiel>(
  liste: T[],
  filtre: FiltreOrigineValue,
  currentUserId: string | null | undefined
): T[] {
  if (filtre === "tout") return liste
  return liste.filter((e) => origineReferentiel(e, currentUserId) === filtre)
}

/** Barre de filtre par origine, style cohérent avec les onglets de type. */
export function FiltreOrigine({
  value,
  onChange,
  labelPerso = "Mes variétés",
  className,
}: {
  value: FiltreOrigineValue
  onChange: (v: FiltreOrigineValue) => void
  /** Libellé du filtre perso (ex. « Mes espèces », « Mes essences »). */
  labelPerso?: string
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {FILTRES.map((f) => (
        <button
          key={f.key}
          type="button"
          onClick={() => onChange(f.key)}
          className={cn(
            "text-xs px-2.5 py-1 rounded-md border transition-colors",
            value === f.key ? "bg-emerald-600 text-white border-emerald-600" : "bg-white hover:bg-slate-100"
          )}
        >
          {f.key === "perso" ? labelPerso : f.label}
        </button>
      ))}
    </div>
  )
}
