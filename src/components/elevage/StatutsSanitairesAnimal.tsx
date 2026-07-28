"use client"

import * as React from "react"
import { Loader2, Plus, ShieldCheck, Trash2 } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useToast } from "@/hooks/use-toast"

type Maladie = { id: string; nom: string; code: string }
type Statut = {
  id: string
  statut: "indemne" | "en_cours" | "positif" | "inconnu"
  dateControle: string | null
  laboratoire: string | null
  numeroAnalyse: string | null
  notes: string | null
  maladie: Maladie
}

const LABELS = {
  indemne: "Indemne",
  en_cours: "En cours",
  positif: "Positif",
  inconnu: "Inconnu",
}
const CLASSES = {
  indemne: "border-emerald-200 bg-emerald-50 text-emerald-800",
  en_cours: "border-blue-200 bg-blue-50 text-blue-800",
  positif: "border-red-200 bg-red-50 text-red-800",
  inconnu: "border-amber-200 bg-amber-50 text-amber-800",
}

export function StatutsSanitairesAnimal({
  animalId,
  legacyStatuses = [],
}: {
  animalId: number
  legacyStatuses?: string[]
}) {
  const { toast } = useToast()
  const [statuts, setStatuts] = React.useState<Statut[]>([])
  const [maladies, setMaladies] = React.useState<Maladie[]>([])
  const [loading, setLoading] = React.useState(true)
  const [saving, setSaving] = React.useState(false)
  const [nouvelleMaladie, setNouvelleMaladie] = React.useState("")
  const [form, setForm] = React.useState({
    maladieId: "",
    statut: "inconnu",
    dateControle: "",
    laboratoire: "",
    numeroAnalyse: "",
    notes: "",
  })

  const reload = React.useCallback(async () => {
    setLoading(true)
    try {
      const response = await fetch(`/api/elevage/statuts-sanitaires?animalId=${animalId}`)
      if (!response.ok) throw new Error("Chargement impossible")
      const payload = await response.json()
      setStatuts(payload.data ?? [])
      setMaladies(payload.maladies ?? [])
      setForm((current) => ({
        ...current,
        maladieId: current.maladieId || payload.maladies?.[0]?.id || "",
      }))
    } catch (error) {
      toast({ variant: "destructive", title: "Statuts sanitaires indisponibles", description: error instanceof Error ? error.message : undefined })
    } finally {
      setLoading(false)
    }
  }, [animalId, toast])

  React.useEffect(() => { void reload() }, [reload])

  async function enregistrer(event: React.FormEvent) {
    event.preventDefault()
    if (!form.maladieId) return
    setSaving(true)
    try {
      const response = await fetch("/api/elevage/statuts-sanitaires", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          animalId,
          maladieId: form.maladieId,
          statut: form.statut,
          dateControle: form.dateControle || null,
          laboratoire: form.laboratoire || null,
          numeroAnalyse: form.numeroAnalyse || null,
          notes: form.notes || null,
        }),
      })
      const payload = await response.json().catch(() => null)
      if (!response.ok) throw new Error(payload?.error || "Enregistrement impossible")
      toast({ title: "Qualification sanitaire enregistrée" })
      setForm((current) => ({ ...current, dateControle: "", laboratoire: "", numeroAnalyse: "", notes: "" }))
      await reload()
    } catch (error) {
      toast({ variant: "destructive", title: "Erreur", description: error instanceof Error ? error.message : undefined })
    } finally {
      setSaving(false)
    }
  }

  async function ajouterMaladie() {
    if (!nouvelleMaladie.trim()) return
    const response = await fetch("/api/elevage/statuts-sanitaires", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nom: nouvelleMaladie, especesCibles: [] }),
    })
    const payload = await response.json().catch(() => null)
    if (!response.ok) {
      toast({ variant: "destructive", title: "Maladie non ajoutée", description: payload?.error })
      return
    }
    setNouvelleMaladie("")
    setForm((current) => ({ ...current, maladieId: payload.data.id }))
    await reload()
  }

  async function supprimer(id: string) {
    const response = await fetch(`/api/elevage/statuts-sanitaires?id=${encodeURIComponent(id)}`, { method: "DELETE" })
    if (response.ok) await reload()
  }

  return (
    <Card className={statuts.length || legacyStatuses.length ? "border-blue-200" : "border-amber-200"}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="h-5 w-5 text-blue-600" />
          Statuts sanitaires structurés
        </CardTitle>
        <CardDescription>
          Maladie, qualification, dernier contrôle, laboratoire et numéro d’analyse.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />Chargement…</div>
        ) : (
          <div className="space-y-2">
            {statuts.map((item) => (
              <div key={item.id} className="flex flex-wrap items-start justify-between gap-2 rounded-lg border p-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">{item.maladie.nom}</span>
                    <Badge variant="outline" className={CLASSES[item.statut]}>{LABELS[item.statut]}</Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {item.dateControle ? new Date(item.dateControle).toLocaleDateString("fr-FR") : "Date non renseignée"}
                    {item.laboratoire ? ` · ${item.laboratoire}` : ""}
                    {item.numeroAnalyse ? ` · analyse ${item.numeroAnalyse}` : ""}
                  </div>
                  {item.notes && <p className="mt-1 text-sm">{item.notes}</p>}
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={() => void supprimer(item.id)} aria-label={`Supprimer ${item.maladie.nom}`}>
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
            ))}
            {!statuts.length && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                Statut inconnu : complétez une qualification avant introduction, cession ou concours.
              </p>
            )}
            {legacyStatuses.length > 0 && (
              <div className="flex flex-wrap gap-1">
                <span className="mr-1 text-xs text-muted-foreground">Anciennes mentions :</span>
                {legacyStatuses.map((item) => <Badge key={item} variant="outline">{item}</Badge>)}
              </div>
            )}
          </div>
        )}

        <form onSubmit={enregistrer} className="space-y-3 rounded-lg border bg-slate-50 p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Maladie</Label>
              <Select value={form.maladieId} onValueChange={(value) => setForm((current) => ({ ...current, maladieId: value }))}>
                <SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger>
                <SelectContent>{maladies.map((item) => <SelectItem key={item.id} value={item.id}>{item.nom}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label>Statut</Label>
              <Select value={form.statut} onValueChange={(value) => setForm((current) => ({ ...current, statut: value }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="indemne">Indemne</SelectItem>
                  <SelectItem value="en_cours">En cours d’analyse</SelectItem>
                  <SelectItem value="positif">Positif</SelectItem>
                  <SelectItem value="inconnu">Inconnu</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label>Date du contrôle</Label><Input type="date" value={form.dateControle} onChange={(event) => setForm((current) => ({ ...current, dateControle: event.target.value }))} /></div>
            <div><Label>Laboratoire</Label><Input value={form.laboratoire} onChange={(event) => setForm((current) => ({ ...current, laboratoire: event.target.value }))} /></div>
            <div className="sm:col-span-2"><Label>N° d’analyse</Label><Input value={form.numeroAnalyse} onChange={(event) => setForm((current) => ({ ...current, numeroAnalyse: event.target.value }))} /></div>
            <div className="sm:col-span-2"><Label>Notes</Label><Textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} /></div>
          </div>
          <Button type="submit" disabled={saving || !form.maladieId}>
            {saving && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}Enregistrer la qualification
          </Button>
        </form>

        <div className="flex gap-2">
          <Input value={nouvelleMaladie} onChange={(event) => setNouvelleMaladie(event.target.value)} placeholder="Ajouter une maladie personnalisée" />
          <Button type="button" variant="outline" onClick={() => void ajouterMaladie()} disabled={!nouvelleMaladie.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
