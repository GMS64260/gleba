"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { useToast } from "@/hooks/use-toast"
import { confirmDialog } from "@/lib/global-dialog"
import { Loader2, ShieldOff, Check, X, RotateCcw } from "lucide-react"

type Statut = "ouvert" | "traite" | "rejete" | "tous"

type Signalement = {
  id: string
  refType: string
  refId: string
  motif: string
  statut: string
  createdAt: string
  auteur: { id: string; name: string | null; email: string } | null
  entree: { nom: string; userId: string | null; partageCommunaute: boolean } | null
  apiBase: string
}

const TYPE_LABEL: Record<string, string> = {
  ESPECE: "Espèce",
  VARIETE: "Variété",
  ITP: "Itinéraire technique",
  PORTE_GREFFE: "Porte-greffe",
  RACE: "Race",
}

const FILTRES: { key: Statut; label: string }[] = [
  { key: "ouvert", label: "À traiter" },
  { key: "traite", label: "Traités" },
  { key: "rejete", label: "Rejetés" },
  { key: "tous", label: "Tous" },
]

export function SignalementsModeration() {
  const { toast } = useToast()
  const [statut, setStatut] = React.useState<Statut>("ouvert")
  const [items, setItems] = React.useState<Signalement[]>([])
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState<string | null>(null)

  const charger = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/admin/signalements?statut=${statut}`)
      const json = res.ok ? await res.json() : { data: [] }
      setItems(json.data || [])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [statut])

  React.useEffect(() => {
    void charger()
  }, [charger])

  async function patchStatut(id: string, nouveau: "traite" | "rejete" | "ouvert") {
    setBusy(id)
    try {
      const res = await fetch(`/api/admin/signalements/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut: nouveau }),
      })
      if (res.ok) {
        await charger()
      } else {
        const p = await res.json().catch(() => null)
        toast({ variant: "destructive", title: "Erreur", description: p?.error || "Action impossible" })
      }
    } finally {
      setBusy(null)
    }
  }

  // Retrait effectif : rendre l'entrée privée à son auteur (partageCommunaute=false),
  // puis marquer le signalement traité.
  async function retirer(s: Signalement) {
    if (!(await confirmDialog(`Retirer « ${s.entree?.nom ?? s.refId} » de la communauté (rendue privée à son auteur) ?`))) return
    setBusy(s.id)
    try {
      const res = await fetch(`${s.apiBase}/${encodeURIComponent(s.refId)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partageCommunaute: false }),
      })
      if (!res.ok) {
        const p = await res.json().catch(() => null)
        toast({ variant: "destructive", title: "Erreur", description: p?.error || "Retrait impossible" })
        setBusy(null)
        return
      }
      await fetch(`/api/admin/signalements/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ statut: "traite" }),
      })
      toast({ title: "Entrée retirée de la communauté", description: `« ${s.entree?.nom ?? s.refId} » est de nouveau privée.` })
      await charger()
    } finally {
      setBusy(null)
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-1 mb-4">
        {FILTRES.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setStatut(f.key)}
            className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
              statut === f.key ? "bg-orange-600 text-white border-orange-600" : "bg-white hover:bg-slate-100"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-muted-foreground py-10 text-center">Aucun signalement.</p>
      ) : (
        <div className="space-y-3">
          {items.map((s) => {
            const dejaPrive = s.entree ? !s.entree.partageCommunaute : false
            return (
              <div key={s.id} className="border rounded-lg p-4 bg-white">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className="text-xs">{TYPE_LABEL[s.refType] ?? s.refType}</Badge>
                      <span className="font-medium">{s.entree?.nom ?? s.refId}</span>
                      {!s.entree && <Badge variant="destructive" className="text-xs">entrée introuvable / supprimée</Badge>}
                      {s.entree && !s.entree.partageCommunaute && (
                        <Badge variant="outline" className="text-xs text-slate-500">déjà privée</Badge>
                      )}
                      {s.statut !== "ouvert" && (
                        <Badge variant="outline" className={`text-xs ${s.statut === "traite" ? "text-emerald-700" : "text-slate-500"}`}>
                          {s.statut === "traite" ? "traité" : "rejeté"}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm mt-1 whitespace-pre-line">{s.motif}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Signalé par {s.auteur?.name || s.auteur?.email || "?"} · {new Date(s.createdAt).toLocaleDateString("fr-FR")}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {s.statut === "ouvert" ? (
                      <>
                        {s.entree && !dejaPrive && (
                          <Button size="sm" variant="outline" disabled={busy === s.id} onClick={() => retirer(s)} title="Rendre privée (retirer de la communauté)">
                            <ShieldOff className="h-4 w-4 mr-1" /> Retirer
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" disabled={busy === s.id} onClick={() => patchStatut(s.id, "traite")} title="Marquer traité">
                          <Check className="h-4 w-4 mr-1" /> Traité
                        </Button>
                        <Button size="sm" variant="ghost" disabled={busy === s.id} onClick={() => patchStatut(s.id, "rejete")} title="Rejeter le signalement">
                          <X className="h-4 w-4 mr-1" /> Rejeter
                        </Button>
                      </>
                    ) : (
                      <Button size="sm" variant="ghost" disabled={busy === s.id} onClick={() => patchStatut(s.id, "ouvert")} title="Rouvrir">
                        <RotateCcw className="h-4 w-4 mr-1" /> Rouvrir
                      </Button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
