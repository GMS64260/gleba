"use client"

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Check, CloudOff, Plus, RefreshCw, ScanLine, Wifi } from "lucide-react"
import { AppHeader } from "@/components/shell/AppHeader"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { ajouterOperation, lireFile, lireTachesCachees, sauverTaches, synchroniserOperations, type TacheTournee } from "@/lib/elevage/offline-tournee"

const localDateTime = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16) }

export default function TourneePage() {
  const { toast } = useToast()
  const [tasks, setTasks] = React.useState<TacheTournee[]>([])
  const [online, setOnline] = React.useState(true)
  const [queued, setQueued] = React.useState(0)
  const [open, setOpen] = React.useState(false)
  const [lots, setLots] = React.useState<Array<{ id: number; nom: string | null }>>([])
  const [animaux, setAnimaux] = React.useState<Array<{ id: number; nom: string | null; identifiant: string | null }>>([])
  const [scanCode, setScanCode] = React.useState('')
  const [scanResult, setScanResult] = React.useState<{ id: number; nom: string | null; identifiant: string | null; especeAnimale: { nom: string } } | null>(null)
  const [form, setForm] = React.useState({ titre: '', description: '', categorie: 'controle', priorite: 'normale', prochaineEcheance: localDateTime(), recurrenceJours: '', cible: 'aucune', cibleId: '' })

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch('/api/elevage/tournee?jours=7')
      if (!res.ok) throw new Error()
      const data = (await res.json()).data as TacheTournee[]
      setTasks(data); await sauverTaches(data)
    } catch { setTasks(await lireTachesCachees()) }
    setQueued((await lireFile()).length)
  }, [])

  React.useEffect(() => {
    setOnline(navigator.onLine)
    void refresh()
    void Promise.all([fetch('/api/elevage/lots'), fetch('/api/elevage/animaux?statut=actif')]).then(async ([l, a]) => {
      if (l.ok) setLots((await l.json()).data)
      if (a.ok) setAnimaux((await a.json()).data)
    })
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw-elevage.js')
    const onOnline = async () => { setOnline(true); await synchroniserOperations(); await refresh() }
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline)
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline) }
  }, [refresh])

  async function terminer(task: TacheTournee) {
    const op = { tacheId: task.id, dateEcheance: task.prochaineEcheance, dateRealisation: new Date().toISOString(), notes: null, clientOperationId: crypto.randomUUID() }
    await ajouterOperation(op)
    setTasks(current => current.filter(t => t.id !== task.id))
    if (online) await synchroniserOperations()
    setQueued((await lireFile()).length)
    toast({ title: online ? 'Tâche acquittée' : 'Tâche conservée hors connexion', description: online ? undefined : 'Elle sera synchronisée au retour du réseau.' })
    if (online) await refresh()
  }

  async function creer(e: React.FormEvent) {
    e.preventDefault()
    if (!online) return toast({ variant: 'destructive', title: 'Création indisponible hors connexion', description: 'Les acquittements restent disponibles.' })
    const res = await fetch('/api/elevage/taches-terrain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, cible: undefined, cibleId: undefined, animalId: form.cible === 'animal' ? Number(form.cibleId) : null, lotId: form.cible === 'lot' ? Number(form.cibleId) : null, recurrenceJours: form.recurrenceJours ? Number(form.recurrenceJours) : null, actif: true }) })
    if (!res.ok) return toast({ variant: 'destructive', title: 'Tâche non créée', description: (await res.json()).error })
    setOpen(false); await refresh()
  }

  async function rechercherCode(code = scanCode) {
    if (!code.trim()) return
    const res = await fetch(`/api/elevage/scan?code=${encodeURIComponent(code.trim())}`)
    if (!res.ok) { setScanResult(null); return toast({ variant: 'destructive', title: 'Animal introuvable' }) }
    setScanResult((await res.json()).data)
  }

  async function lireNfc() {
    const NFCReader = (window as unknown as { NDEFReader?: new () => { scan: () => Promise<void>; addEventListener: (name: string, cb: (event: { message: { records: Array<{ data: DataView }> } }) => void) => void } }).NDEFReader
    if (!NFCReader) return toast({ variant: 'destructive', title: 'NFC non disponible', description: 'Saisissez ou scannez le numéro de boucle.' })
    try {
      const reader = new NFCReader(); await reader.scan()
      reader.addEventListener('reading', event => {
        const record = event.message.records[0]
        if (!record) return
        const code = new TextDecoder().decode(record.data)
        setScanCode(code); void rechercherCode(code)
      })
      toast({ title: 'Approchez la boucle ou l’étiquette NFC' })
    } catch { toast({ variant: 'destructive', title: 'Lecture NFC refusée' }) }
  }

  return <div className="min-h-screen bg-slate-50"><AppHeader current="elevage" /><main className="mx-auto max-w-3xl p-3 sm:p-6 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-2"><div><Button asChild variant="ghost" size="sm"><Link href="/elevage"><ArrowLeft className="h-4 w-4 mr-1" />Élevage</Link></Button><h1 className="text-2xl font-bold">Tournée du jour</h1><p className="text-sm text-muted-foreground">Actions terrain, acquittables même sans réseau.</p></div><div className="flex gap-2"><Badge variant={online ? 'default' : 'secondary'}>{online ? <Wifi className="h-3 w-3 mr-1" /> : <CloudOff className="h-3 w-3 mr-1" />}{online ? 'En ligne' : 'Hors ligne'}</Badge>{queued > 0 && <Badge variant="outline">{queued} à synchroniser</Badge>}</div></div>
    <div className="flex gap-2"><Button variant="outline" onClick={() => refresh()}><RefreshCw className="h-4 w-4 mr-1" />Actualiser</Button><Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Nouvelle tâche</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Nouvelle tâche terrain</DialogTitle></DialogHeader><form onSubmit={creer} className="space-y-3"><div><Label>Titre</Label><Input required value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))} /></div><div><Label>Description</Label><Textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} /></div><div className="grid grid-cols-2 gap-3"><div><Label>Catégorie</Label><Select value={form.categorie} onValueChange={v => setForm(f => ({ ...f, categorie: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['alimentation','traite','soin','reproduction','paturage','controle','autre'].map(v => <SelectItem value={v} key={v}>{v}</SelectItem>)}</SelectContent></Select></div><div><Label>Priorité</Label><Select value={form.priorite} onValueChange={v => setForm(f => ({ ...f, priorite: v }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{['basse','normale','haute','urgente'].map(v => <SelectItem value={v} key={v}>{v}</SelectItem>)}</SelectContent></Select></div></div><div className="grid grid-cols-2 gap-3"><div><Label>Cible</Label><Select value={form.cible} onValueChange={v => setForm(f => ({ ...f, cible: v, cibleId: '' }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="aucune">Toute l’exploitation</SelectItem><SelectItem value="lot">Un lot</SelectItem><SelectItem value="animal">Un animal</SelectItem></SelectContent></Select></div>{form.cible !== 'aucune' && <div><Label>{form.cible === 'lot' ? 'Lot' : 'Animal'}</Label><Select value={form.cibleId} onValueChange={v => setForm(f => ({ ...f, cibleId: v }))}><SelectTrigger><SelectValue placeholder="Choisir" /></SelectTrigger><SelectContent>{form.cible === 'lot' ? lots.map(l => <SelectItem key={l.id} value={String(l.id)}>{l.nom || `Lot #${l.id}`}</SelectItem>) : animaux.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.nom || a.identifiant || `#${a.id}`}</SelectItem>)}</SelectContent></Select></div>}</div><div><Label>Première échéance</Label><Input type="datetime-local" required value={form.prochaineEcheance} onChange={e => setForm(f => ({ ...f, prochaineEcheance: e.target.value }))} /></div><div><Label>Récurrence en jours</Label><Input type="number" min="1" max="366" value={form.recurrenceJours} onChange={e => setForm(f => ({ ...f, recurrenceJours: e.target.value }))} placeholder="Vide = une seule fois" /></div><Button type="submit" disabled={form.cible !== 'aucune' && !form.cibleId}>Créer</Button></form></DialogContent></Dialog></div>
    <Card><CardHeader><CardTitle className="text-lg">Identifier un animal</CardTitle><CardDescription>Saisie, douchette clavier ou étiquette NFC contenant le numéro de boucle.</CardDescription></CardHeader><CardContent><div className="flex gap-2"><Input value={scanCode} onChange={e => setScanCode(e.target.value)} onKeyDown={e => e.key === 'Enter' && rechercherCode()} placeholder="N° de boucle / RFID" /><Button variant="outline" onClick={() => rechercherCode()}><ScanLine className="h-4 w-4" /></Button><Button variant="outline" onClick={lireNfc}>NFC</Button></div>{scanResult && <div className="mt-3 rounded-lg bg-emerald-50 p-3"><Link className="font-medium underline" href={`/elevage/animaux/${scanResult.id}`}>{scanResult.nom || scanResult.identifiant} · {scanResult.especeAnimale.nom}</Link></div>}</CardContent></Card>
    <div className="space-y-3">{tasks.map(task => <Card key={task.id} className={task.priorite === 'urgente' ? 'border-red-400' : ''}><CardHeader className="pb-2"><div className="flex justify-between gap-3"><div><CardTitle className="text-lg">{task.titre}</CardTitle><CardDescription>{new Date(task.prochaineEcheance).toLocaleString('fr-FR')} · {task.categorie}{task.recurrenceJours ? ` · tous les ${task.recurrenceJours} j` : ''}</CardDescription></div><Badge variant={task.priorite === 'urgente' ? 'destructive' : 'outline'}>{task.priorite}</Badge></div></CardHeader><CardContent><p className="mb-3 text-sm">{task.description}</p><Button className="w-full min-h-12" onClick={() => terminer(task)}><Check className="h-5 w-5 mr-2" />Fait</Button></CardContent></Card>)}{!tasks.length && <Card><CardContent className="py-12 text-center text-muted-foreground">Aucune tâche à réaliser dans les sept prochains jours.</CardContent></Card>}</div>
  </main></div>
}
