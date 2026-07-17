"use client"

/**
 * Onglet Races (élevage) — référentiel communautaire des races animales.
 * Liste les races par espèce, avis communautaires (note + modale), ajout/suppression.
 */

import * as React from "react"
import { useSession } from "next-auth/react"
import { Plus, Trash2, Bird } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import { AvisCell } from "@/components/avis/AvisCell"
import { AvisDialog } from "@/components/avis/AvisDialog"
import type { AvisStatsListe } from "@/lib/avis/types"
import {
  OrigineControls,
  useReferentielActions,
  FiltreOrigine,
  filtrerParOrigine,
  type FiltreOrigineValue,
} from "@/components/referentiel/catalogue-communaute"

interface EspeceAnimale {
  id: string
  nom: string
}

interface Race {
  id: string
  nom: string
  especeAnimaleId: string
  especeAnimale?: { id: string; nom: string }
  avisStats?: AvisStatsListe
  userId: string | null
  partageCommunaute: boolean
}

export function RacesTab() {
  const { toast } = useToast()
  const { data: session } = useSession()
  const currentUserId = (session?.user as any)?.id as string | undefined
  const isAdmin = (session?.user as any)?.role === "ADMIN"
  const [especes, setEspeces] = React.useState<EspeceAnimale[]>([])
  const [races, setRaces] = React.useState<Race[]>([])
  const [filtre, setFiltre] = React.useState("all")
  const [filtreOrigine, setFiltreOrigine] = React.useState<FiltreOrigineValue>("tout")
  const [loading, setLoading] = React.useState(true)
  const [avisRace, setAvisRace] = React.useState<Race | null>(null)
  const [showAdd, setShowAdd] = React.useState(false)
  const [form, setForm] = React.useState({ nom: "", especeAnimaleId: "", partageCommunaute: false })

  const reload = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch("/api/elevage/races?avis=1")
      if (!res.ok) throw new Error("Erreur de chargement")
      const json = await res.json()
      setRaces(json.data || [])
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les races" })
    } finally {
      setLoading(false)
    }
  }, [toast])

  React.useEffect(() => {
    fetch("/api/elevage/especes-animales")
      .then((r) => r.json())
      .then((res) => setEspeces(Array.isArray(res?.data) ? res.data : Array.isArray(res) ? res : []))
      .catch(() => {})
    reload()
  }, [reload])

  const referentielActions = useReferentielActions("/api/elevage/races", reload, toast)

  const parEspece = filtre === "all" ? races : races.filter((r) => r.especeAnimaleId === filtre)
  const filtered = filtrerParOrigine(parEspece, filtreOrigine, currentUserId)

  const ajouter = async () => {
    if (!form.especeAnimaleId) {
      toast({ title: "Sélectionnez une espèce", variant: "destructive" })
      return
    }
    if (!form.nom.trim()) {
      toast({ title: "Renseignez le nom de la race", variant: "destructive" })
      return
    }
    try {
      const res = await fetch("/api/elevage/races", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: form.nom.trim(),
          especeAnimaleId: form.especeAnimaleId,
          partageCommunaute: form.partageCommunaute,
        }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Erreur")
      }
      toast({ title: "Race ajoutée" })
      setShowAdd(false)
      setForm({ nom: "", especeAnimaleId: "", partageCommunaute: false })
      reload()
    } catch (e) {
      toast({ variant: "destructive", title: "Erreur", description: e instanceof Error ? e.message : "Erreur" })
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-y-2">
        <CardTitle className="flex items-center gap-2">
          <Bird className="h-5 w-5 text-lime-600" /> Races animales
        </CardTitle>
        <div className="flex items-center gap-2">
          <Select value={filtre} onValueChange={setFiltre}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder="Toutes espèces" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toutes espèces</SelectItem>
              {especes.map((e) => (
                <SelectItem key={e.id} value={e.id}>
                  {e.nom}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="button" size="sm" onClick={() => setShowAdd(true)}>
            <Plus className="mr-1 h-4 w-4" /> Ajouter
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filtre par origine (catalogue Gleba / communauté / mes races) */}
        <FiltreOrigine value={filtreOrigine} onChange={setFiltreOrigine} labelPerso="Mes races" />
        {loading ? (
          <Skeleton className="h-40 w-full" />
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucune race pour ce filtre.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Race</TableHead>
                <TableHead>Espèce</TableHead>
                <TableHead>Avis</TableHead>
                <TableHead>Origine</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.nom}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{r.especeAnimale?.nom ?? "-"}</TableCell>
                  <TableCell>
                    <AvisCell stats={r.avisStats} onClick={() => setAvisRace(r)} />
                  </TableCell>
                  <TableCell>
                    <OrigineControls
                      entree={{ id: r.id, userId: r.userId, partageCommunaute: r.partageCommunaute }}
                      nom={r.nom}
                      currentUserId={currentUserId}
                      actions={referentielActions}
                      showRemove={false}
                      signalerRefType="RACE"
                    />
                  </TableCell>
                  <TableCell className="text-right">
                    {(isAdmin || r.userId === currentUserId) && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0 hover:bg-red-100 hover:text-red-600"
                        onClick={() => referentielActions.remove(r.id, r.nom)}
                        title="Supprimer"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>

      {/* Ajout race */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nouvelle race</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Espèce *</Label>
              <Select value={form.especeAnimaleId} onValueChange={(v) => setForm((f) => ({ ...f, especeAnimaleId: v }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Sélectionner une espèce" />
                </SelectTrigger>
                <SelectContent>
                  {especes.map((e) => (
                    <SelectItem key={e.id} value={e.id}>
                      {e.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Nom de la race *</Label>
              <Input
                value={form.nom}
                onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                placeholder="Ex: Sussex"
              />
            </div>
            {!isAdmin && (
              <label className="flex items-center gap-2 text-sm text-slate-600">
                <Checkbox
                  checked={form.partageCommunaute}
                  onCheckedChange={(v) => setForm((f) => ({ ...f, partageCommunaute: v === true }))}
                />
                Proposer à la communauté Gleba
              </label>
            )}
            <Button type="button" className="w-full" onClick={ajouter}>
              Ajouter
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Avis race */}
      <AvisDialog
        refType="RACE"
        refId={avisRace?.id ?? null}
        nom={avisRace?.nom}
        open={avisRace !== null}
        onOpenChange={(o) => !o && setAvisRace(null)}
        onSaved={reload}
      />
    </Card>
  )
}
