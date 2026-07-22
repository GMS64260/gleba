"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Droplets, Fence, Leaf, MoveRight } from "lucide-react"
import { AppHeader } from "@/components/shell/AppHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"

type Lot = { id: number; nom: string | null; quantiteActuelle: number; parcelleGeoId: string | null; especeAnimale: { nom: string } }
type Paddock = { id: string; nom: string; surface: number | null; disponibiliteFourragereKgMsHa: number | null; eauDisponible: boolean | null; etatCloture: string | null; lots: Lot[]; totalTetes: number; ugb: number; chargementUgbHa: number | null; joursOccupation: number | null; joursRepos: number | null; fourrageDisponibleKgMs: number | null }

export default function PaturagePage() {
  const { toast } = useToast()
  const [parcelles, setParcelles] = React.useState<Paddock[]>([])
  const [sansParcelle, setSansParcelle] = React.useState<Lot[]>([])
  const [moveOpen, setMoveOpen] = React.useState(false)
  const [lotId, setLotId] = React.useState('')
  const [destination, setDestination] = React.useState('none')
  const [settings, setSettings] = React.useState<Record<string, { fourrage: string; eau: string; cloture: string }>>({})

  const reload = React.useCallback(async () => {
    const res = await fetch('/api/elevage/paturage')
    if (!res.ok) return
    const json = await res.json(); setParcelles(json.data); setSansParcelle(json.lotsSansParcelle)
    setSettings(Object.fromEntries((json.data as Paddock[]).map(p => [p.id, { fourrage: p.disponibiliteFourragereKgMsHa?.toString() || '', eau: p.eauDisponible == null ? 'inconnu' : p.eauDisponible ? 'oui' : 'non', cloture: p.etatCloture || 'a_surveiller' }])))
  }, [])
  React.useEffect(() => { void reload() }, [reload])
  const allLots = [...sansParcelle, ...parcelles.flatMap(p => p.lots)]

  async function deplacer(e: React.FormEvent) {
    e.preventDefault()
    const lot = allLots.find(l => String(l.id) === lotId)
    if (!lot) return
    const res = await fetch('/api/elevage/mouvements-cheptel', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ lotId: lot.id, parcelleAvantId: lot.parcelleGeoId, parcelleApresId: destination === 'none' ? null : destination, date: new Date(), motif: 'Rotation pâturage' }) })
    if (!res.ok) return toast({ variant: 'destructive', title: 'Déplacement impossible', description: (await res.json()).error })
    setMoveOpen(false); await reload(); toast({ title: 'Rotation enregistrée' })
  }
  async function save(p: Paddock) {
    const s = settings[p.id]
    const res = await fetch('/api/elevage/paturage', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ parcelleId: p.id, disponibiliteFourragereKgMsHa: s.fourrage ? Number(s.fourrage) : null, eauDisponible: s.eau === 'inconnu' ? null : s.eau === 'oui', etatCloture: s.cloture }) })
    if (res.ok) { await reload(); toast({ title: 'État du paddock mis à jour' }) }
  }

  return <div className="min-h-screen bg-slate-50"><AppHeader current="elevage" /><main className="mx-auto max-w-6xl p-3 sm:p-6 space-y-4">
    <div className="flex flex-wrap justify-between gap-3"><div><Button asChild variant="ghost" size="sm"><Link href="/elevage"><ArrowLeft className="h-4 w-4 mr-1" />Élevage</Link></Button><h1 className="text-2xl font-bold">Pâturage & rotations</h1><p className="text-sm text-muted-foreground">Chargement, occupation, repos, fourrage, eau et clôtures.</p></div><Dialog open={moveOpen} onOpenChange={setMoveOpen}><DialogTrigger asChild><Button><MoveRight className="h-4 w-4 mr-2" />Déplacer un lot</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Rotation de pâturage</DialogTitle></DialogHeader><form onSubmit={deplacer} className="space-y-3"><div><Label>Lot</Label><Select value={lotId} onValueChange={setLotId}><SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger><SelectContent>{allLots.map(l => <SelectItem key={l.id} value={String(l.id)}>{l.nom || `Lot #${l.id}`} · {l.quantiteActuelle} têtes</SelectItem>)}</SelectContent></Select></div><div><Label>Destination</Label><Select value={destination} onValueChange={setDestination}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="none">Sortie de parcelle</SelectItem>{parcelles.map(p => <SelectItem key={p.id} value={p.id}>{p.nom}</SelectItem>)}</SelectContent></Select></div><Button type="submit" disabled={!lotId}>Enregistrer le mouvement</Button></form></DialogContent></Dialog></div>
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{parcelles.map(p => { const s = settings[p.id]; return <Card key={p.id}><CardHeader><div className="flex justify-between gap-2"><CardTitle>{p.nom}</CardTitle><Badge variant={p.totalTetes ? 'default' : 'secondary'}>{p.totalTetes} têtes</Badge></div><CardDescription>{p.surface ?? '—'} ha · {p.ugb} UGB · {p.chargementUgbHa ?? '—'} UGB/ha</CardDescription></CardHeader><CardContent className="space-y-3"><div className="grid grid-cols-2 gap-2 text-sm"><div className="rounded bg-emerald-50 p-2"><div className="text-muted-foreground">Occupation</div><strong>{p.joursOccupation == null ? 'Libre' : `${p.joursOccupation} j`}</strong></div><div className="rounded bg-amber-50 p-2"><div className="text-muted-foreground">Repos</div><strong>{p.joursRepos == null ? '—' : `${p.joursRepos} j`}</strong></div></div>{p.lots.map(l => <div className="text-sm" key={l.id}>{l.nom || `Lot #${l.id}`} · {l.especeAnimale.nom} · {l.quantiteActuelle}</div>)}{s && <><div><Label className="flex gap-1"><Leaf className="h-4 w-4" />Fourrage kg MS/ha</Label><Input type="number" min="0" value={s.fourrage} onChange={e => setSettings(x => ({ ...x, [p.id]: { ...s, fourrage: e.target.value } }))} /></div><div className="grid grid-cols-2 gap-2"><div><Label className="flex gap-1"><Droplets className="h-4 w-4" />Eau</Label><Select value={s.eau} onValueChange={v => setSettings(x => ({ ...x, [p.id]: { ...s, eau: v } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="oui">Disponible</SelectItem><SelectItem value="non">Absente</SelectItem><SelectItem value="inconnu">À vérifier</SelectItem></SelectContent></Select></div><div><Label className="flex gap-1"><Fence className="h-4 w-4" />Clôture</Label><Select value={s.cloture} onValueChange={v => setSettings(x => ({ ...x, [p.id]: { ...s, cloture: v } }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="bon">Bonne</SelectItem><SelectItem value="a_surveiller">À surveiller</SelectItem><SelectItem value="a_reparer">À réparer</SelectItem></SelectContent></Select></div></div><Button variant="outline" className="w-full" onClick={() => save(p)}>Mettre à jour</Button></>}</CardContent></Card>})}</div>
  </main></div>
}
