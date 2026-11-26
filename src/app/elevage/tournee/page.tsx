"use client"

import { useSaisieDelaisAttente } from "@/components/elevage/SaisieDelaisAttente"
import { dateRealisationPourFait } from '@/lib/elevage/date-realisation'
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
import { useSession } from "next-auth/react"
import { ajouterOperation, lireFile, lireTachesCachees, oublierAutreActeur, sansTachesEnFile, sauverTaches, synchroniserOperations, type PorteeTournee, type TacheTournee } from "@/lib/elevage/offline-tournee"

const CATEGORIES: Record<string, string> = {
  alimentation: 'Alimentation',
  traite: 'Traite',
  soin: 'Soin',
  reproduction: 'Reproduction',
  paturage: 'Pâturage',
  controle: 'Contrôle',
  autre: 'Autre',
}
const PRIORITES: Record<string, string> = {
  basse: 'Basse',
  normale: 'Normale',
  haute: 'Haute',
  urgente: 'Urgente',
}

const localDateTime = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 16) }

// QA caprin cms1v3fso — la Tournée n'affichait que les tâches terrain saisies
// à la main : elle restait vide alors que le Dashboard listait soins en retard,
// injections, délais et mises-bas. On agrège désormais l'agenda unifié (mêmes
// sources que le Dashboard et le Calendrier), avec action directe.
type EcheanceAgenda = {
  id: string
  kind: string
  date: string | null
  joursRestants: number | null
  titre: string
  detail?: string
  gravite: 'info' | 'attention' | 'urgent'
  action?: { soinId?: number; injectionId?: string }
}
const KINDS_TOURNEE = new Set(['soin_retard', 'soin_planifie', 'mise_bas', 'fenetre_mise_bas', 'tarissement', 'attente_lait', 'attente_oeufs', 'attente_viande', 'prophylaxie', 'diagnostic_gestation'])

export default function TourneePage() {
  const { toast } = useToast()
  const id = React.useId()
  const [tasks, setTasks] = React.useState<TacheTournee[]>([])
  const [echeances, setEcheances] = React.useState<EcheanceAgenda[]>([])
  const [online, setOnline] = React.useState(true)
  const [queued, setQueued] = React.useState(0)
  const [open, setOpen] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [lots, setLots] = React.useState<Array<{ id: number; nom: string | null }>>([])
  const [animaux, setAnimaux] = React.useState<Array<{ id: number; nom: string | null; identifiant: string | null }>>([])
  const [scanCode, setScanCode] = React.useState('')
  const [scanResult, setScanResult] = React.useState<{ id: number; nom: string | null; identifiant: string | null; especeAnimale: { nom: string } } | null>(null)
  const [form, setForm] = React.useState({ titre: '', description: '', categorie: 'controle', priorite: 'normale', prochaineEcheance: localDateTime(), recurrenceJours: '', cible: 'aucune', cibleId: '' })

  // Cache hors connexion rattaché à la personne connectée (revue Codex SEC-02) :
  // la session, quand elle est lisible, écarte le cache d'un autre compte ; la
  // portée renvoyée par le serveur rattache les tâches et la file.
  const { data: session } = useSession()
  const acteurSession = session?.user?.id ?? null
  const acteurRef = React.useRef<string | null>(null)

  const refresh = React.useCallback(async () => {
    try {
      const res = await fetch('/api/elevage/tournee?jours=7')
      if (!res.ok) throw new Error()
      const { data, portee } = await res.json() as { data: TacheTournee[]; portee: PorteeTournee }
      await sauverTaches(portee, data)
      // Une tâche déjà acquittée mais pas encore envoyée ne se repropose pas.
      setTasks(sansTachesEnFile(data, await lireFile(acteurRef.current)))
    } catch { setTasks(await lireTachesCachees(acteurRef.current)) }
    // Échéances élevage (soins, injections, délais, mises-bas) — mêmes sources
    // que le Dashboard. Best-effort : hors connexion, seules les tâches
    // terrain mises en cache restent disponibles.
    try {
      const res = await fetch('/api/elevage/agenda?jours=7')
      if (res.ok) {
        const { echeances: all } = await res.json() as { echeances: EcheanceAgenda[] }
        setEcheances(all.filter(e => KINDS_TOURNEE.has(e.kind)))
      }
    } catch { /* hors connexion : section masquée */ }
    setQueued((await lireFile(acteurRef.current)).length)
  }, [])

  // `toast` lu par une ref : l'annonce reste stable d'un rendu à l'autre et
  // ne relance pas le chargement de la tournée.
  const toastRef = React.useRef(toast)
  toastRef.current = toast
  const annoncerRejets = React.useCallback((n: number) => {
    toastRef.current({
      variant: 'destructive',
      title: n > 1 ? `${n} acquittements refusés` : 'Un acquittement refusé',
      description: 'La tâche a été supprimée ou modifiée entre-temps. Vérifiez la tournée.',
    })
  }, [])

  // Lecture puis envoi de la file restée en attente : sans cela, une tâche validée
  // hors réseau ne partait qu'à un retour du réseau vécu page ouverte, ou à la
  // validation suivante. Rouvrir la tournée en ligne suffit maintenant.
  const actualiser = React.useCallback(async () => {
    await refresh()
    if (!navigator.onLine) return
    try {
      const { envoyees, rejetees } = await synchroniserOperations()
      if (rejetees > 0) annoncerRejets(rejetees)
      if (envoyees > 0 || rejetees > 0) await refresh()
    } catch { /* base locale illisible : la file reste pour la prochaine fois */ }
  }, [refresh, annoncerRejets])

  React.useEffect(() => {
    if (!acteurSession || acteurRef.current === acteurSession) return
    acteurRef.current = acteurSession
    void oublierAutreActeur(acteurSession).then(actualiser)
  }, [acteurSession, actualiser])

  React.useEffect(() => {
    setOnline(navigator.onLine)
    void actualiser()
    void Promise.all([fetch('/api/elevage/lots'), fetch('/api/elevage/animaux?statut=actif')]).then(async ([l, a]) => {
      if (l.ok) setLots((await l.json()).data)
      if (a.ok) setAnimaux((await a.json()).data)
    })
    if ('serviceWorker' in navigator) void navigator.serviceWorker.register('/sw-elevage.js')
    const onOnline = () => { setOnline(true); void actualiser() }
    const onOffline = () => setOnline(false)
    window.addEventListener('online', onOnline); window.addEventListener('offline', onOffline)
    return () => { window.removeEventListener('online', onOnline); window.removeEventListener('offline', onOffline) }
  }, [refresh, actualiser])

  const { validerSoin, dialogue: dialogueDelais } = useSaisieDelaisAttente()

  async function validerEcheance(e: EcheanceAgenda) {
    if (!e.action?.soinId) return
    // Échéance ancienne : la date réelle est demandée, pas l'instant du clic.
    const dateFait = dateRealisationPourFait(e.date, e.action.injectionId ? 'Cette injection' : 'Ce soin')
    if (dateFait === null) return
    try {
      const res = e.action.injectionId
        ? await validerSoin(`/api/elevage/soins/${e.action.soinId}/injections`,
            { injectionId: e.action.injectionId, statut: 'realisee', dateRealisee: dateFait })
        : await validerSoin('/api/elevage/soins', { id: e.action.soinId, fait: true, date: dateFait })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.error || 'Mise à jour impossible')
      }
      toast({ title: e.action.injectionId ? 'Injection enregistrée' : 'Soin marqué fait' })
      await refresh()
    } catch (err) {
      toast({ variant: 'destructive', title: 'Erreur', description: err instanceof Error ? err.message : 'Mise à jour impossible' })
    }
  }

  // Appuis successifs sur « Fait » : un seul acquittement à la fois par tâche.
  const enCours = React.useRef(new Set<string>())
  async function terminer(task: TacheTournee) {
    if (enCours.current.has(task.id)) return
    enCours.current.add(task.id)
    try {
      await acquitter(task)
    } finally {
      enCours.current.delete(task.id)
    }
  }
  async function acquitter(task: TacheTournee) {
    const op = { tacheId: task.id, dateEcheance: task.prochaineEcheance, dateRealisation: new Date().toISOString(), notes: null, clientOperationId: crypto.randomUUID() }
    if (!await ajouterOperation(op)) {
      toast({ variant: 'destructive', title: 'Tâche non enregistrée', description: 'Rechargez la tournée en ligne avant de la reprendre hors connexion.' })
      return
    }
    setTasks(current => current.filter(t => t.id !== task.id))
    if (online) {
      const { rejetees } = await synchroniserOperations()
      if (rejetees > 0) annoncerRejets(rejetees)
    }
    setQueued((await lireFile(acteurRef.current)).length)
    toast({ title: online ? 'Tâche acquittée' : 'Tâche conservée hors connexion', description: online ? undefined : 'Elle sera synchronisée au retour du réseau.' })
    if (online) await refresh()
  }

  async function creer(e: React.FormEvent) {
    e.preventDefault()
    if (isSubmitting) return
    if (!online) return toast({ variant: 'destructive', title: 'Création indisponible hors connexion', description: 'Les acquittements restent disponibles.' })
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/elevage/taches-terrain', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, cible: undefined, cibleId: undefined, animalId: form.cible === 'animal' ? Number(form.cibleId) : null, lotId: form.cible === 'lot' ? Number(form.cibleId) : null, recurrenceJours: form.recurrenceJours ? Number(form.recurrenceJours) : null, actif: true }) })
      if (!res.ok) return toast({ variant: 'destructive', title: 'Tâche non créée', description: (await res.json()).error })
      setOpen(false); await refresh()
    } finally {
      setIsSubmitting(false)
    }
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
    {dialogueDelais}
    <div className="flex flex-wrap items-center justify-between gap-2"><div><Button asChild variant="ghost" size="sm"><Link href="/elevage"><ArrowLeft className="h-4 w-4 mr-1" />Élevage</Link></Button><h1 className="text-2xl font-bold">Tournée du jour</h1><p className="text-sm text-muted-foreground">Actions terrain, acquittables même sans réseau.</p></div><div className="flex gap-2"><Badge variant={online ? 'default' : 'secondary'}>{online ? <Wifi className="h-3 w-3 mr-1" /> : <CloudOff className="h-3 w-3 mr-1" />}{online ? 'En ligne' : 'Hors ligne'}</Badge>{queued > 0 && <Badge variant="outline">{queued} à synchroniser</Badge>}</div></div>
    <div className="flex gap-2">
      <Button variant="outline" onClick={() => actualiser()}><RefreshCw className="h-4 w-4 mr-1" />Actualiser</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-1" />Nouvelle tâche</Button></DialogTrigger>
        <DialogContent>
          <DialogHeader><DialogTitle>Nouvelle tâche terrain</DialogTitle></DialogHeader>
          <form onSubmit={creer} className="space-y-3">
            <div>
              <Label htmlFor={`${id}-titre`}>Titre</Label>
              <Input id={`${id}-titre`} required value={form.titre} onChange={e => setForm(f => ({ ...f, titre: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor={`${id}-description`}>Description</Label>
              <Textarea id={`${id}-description`} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label id={`${id}-categorie-label`} htmlFor={`${id}-categorie`}>Catégorie</Label>
                <Select value={form.categorie} onValueChange={v => setForm(f => ({ ...f, categorie: v }))}>
                  <SelectTrigger id={`${id}-categorie`} aria-labelledby={`${id}-categorie-label`}><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(CATEGORIES).map(([valeur, libelle]) => <SelectItem value={valeur} key={valeur}>{libelle}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <Label id={`${id}-priorite-label`} htmlFor={`${id}-priorite`}>Priorité</Label>
                <Select value={form.priorite} onValueChange={v => setForm(f => ({ ...f, priorite: v }))}>
                  <SelectTrigger id={`${id}-priorite`} aria-labelledby={`${id}-priorite-label`}><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(PRIORITES).map(([valeur, libelle]) => <SelectItem value={valeur} key={valeur}>{libelle}</SelectItem>)}</SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label id={`${id}-cible-label`} htmlFor={`${id}-cible`}>Cible</Label>
                <Select value={form.cible} onValueChange={v => setForm(f => ({ ...f, cible: v, cibleId: '' }))}>
                  <SelectTrigger id={`${id}-cible`} aria-labelledby={`${id}-cible-label`}><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="aucune">Toute l’exploitation</SelectItem>
                    <SelectItem value="lot">Un lot</SelectItem>
                    <SelectItem value="animal">Un animal</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {form.cible !== 'aucune' && <div>
                <Label id={`${id}-cibleId-label`} htmlFor={`${id}-cibleId`}>{form.cible === 'lot' ? 'Lot' : 'Animal'}</Label>
                <Select value={form.cibleId} onValueChange={v => setForm(f => ({ ...f, cibleId: v }))}>
                  <SelectTrigger id={`${id}-cibleId`} aria-labelledby={`${id}-cibleId-label`}><SelectValue placeholder="Choisir" /></SelectTrigger>
                  <SelectContent>{form.cible === 'lot' ? lots.map(l => <SelectItem key={l.id} value={String(l.id)}>{l.nom || `Lot #${l.id}`}</SelectItem>) : animaux.map(a => <SelectItem key={a.id} value={String(a.id)}>{a.nom || a.identifiant || `#${a.id}`}</SelectItem>)}</SelectContent>
                </Select>
              </div>}
            </div>
            <div>
              <Label htmlFor={`${id}-echeance`}>Première échéance</Label>
              <Input id={`${id}-echeance`} type="datetime-local" required value={form.prochaineEcheance} onChange={e => setForm(f => ({ ...f, prochaineEcheance: e.target.value }))} />
            </div>
            <div>
              <Label htmlFor={`${id}-recurrence`}>Récurrence en jours</Label>
              <Input id={`${id}-recurrence`} aria-describedby={`${id}-recurrence-aide`} type="number" min="1" max="366" value={form.recurrenceJours} onChange={e => setForm(f => ({ ...f, recurrenceJours: e.target.value }))} />
              <p id={`${id}-recurrence-aide`} className="text-sm text-muted-foreground">Vide = une seule fois</p>
            </div>
            <Button type="submit" disabled={(form.cible !== 'aucune' && !form.cibleId) || isSubmitting}>{isSubmitting ? "Enregistrement..." : "Créer"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
    <Card>
      <CardHeader><CardTitle className="text-lg">Identifier un animal</CardTitle><CardDescription>Saisie, douchette clavier ou étiquette NFC contenant le numéro de boucle.</CardDescription></CardHeader>
      <CardContent>
        <Label htmlFor={`${id}-scan`}>N° de boucle / RFID</Label>
        <div className="flex gap-2">
          <Input id={`${id}-scan`} className="min-w-0 flex-1" value={scanCode} onChange={e => setScanCode(e.target.value)} onKeyDown={e => e.key === 'Enter' && rechercherCode()} placeholder="N° de boucle / RFID" />
          <Button variant="outline" aria-label="Rechercher l’animal" onClick={() => rechercherCode()}><ScanLine aria-hidden="true" className="h-4 w-4" /></Button>
          <Button variant="outline" onClick={lireNfc}>NFC</Button>
        </div>
        {scanResult && <div className="mt-3 rounded-lg bg-emerald-50 p-3"><Link className="font-medium underline" href={`/elevage/animaux/${scanResult.id}`}>{scanResult.nom || scanResult.identifiant} · {scanResult.especeAnimale.nom}</Link></div>}
      </CardContent>
    </Card>
    {echeances.length > 0 && <div className="space-y-3">
      <h2 className="text-lg font-semibold">Échéances élevage (7 jours)</h2>
      {echeances.map(e => (
        <Card key={e.id} className={e.gravite === 'urgent' ? 'border-red-400' : e.gravite === 'attention' ? 'border-amber-300' : ''}>
          <CardHeader className="pb-2">
            <div className="flex justify-between gap-3">
              <div>
                <CardTitle className="text-base">{e.titre}</CardTitle>
                <CardDescription>
                  {e.date ? new Date(e.date).toLocaleDateString('fr-FR') : ''}{e.detail ? ` · ${e.detail}` : ''}
                </CardDescription>
              </div>
              <Badge variant={e.gravite === 'urgent' ? 'destructive' : 'outline'}>
                {e.joursRestants != null && e.joursRestants < 0 ? 'En retard' : e.gravite === 'urgent' ? 'Urgent' : e.kind === 'mise_bas' ? 'Mise-bas' : e.kind === 'fenetre_mise_bas' ? 'Mises bas' : e.kind === 'tarissement' ? 'Tarissement' : e.kind.startsWith('attente') ? 'Délai' : 'À venir'}
              </Badge>
            </div>
          </CardHeader>
          {e.action?.soinId && (
            <CardContent className="pt-0">
              <Button className="w-full min-h-12" variant="outline" onClick={() => validerEcheance(e)}>
                <Check className="h-5 w-5 mr-2" />{e.action.injectionId ? 'Injection faite' : 'Marquer fait'}
              </Button>
            </CardContent>
          )}
        </Card>
      ))}
    </div>}
    <div className="space-y-3">
    <h2 className="text-lg font-semibold">Tâches terrain</h2>
    {tasks.map(task => <Card key={task.id} className={task.priorite === 'urgente' ? 'border-red-400' : ''}><CardHeader className="pb-2"><div className="flex justify-between gap-3"><div><CardTitle className="text-lg">{task.titre}</CardTitle><CardDescription>{new Date(task.prochaineEcheance).toLocaleString('fr-FR')} · {CATEGORIES[task.categorie] ?? task.categorie}{task.recurrenceJours ? ` · tous les ${task.recurrenceJours} j` : ''}</CardDescription></div><Badge variant={task.priorite === 'urgente' ? 'destructive' : 'outline'}>{PRIORITES[task.priorite] ?? task.priorite}</Badge></div></CardHeader><CardContent><p className="mb-3 text-sm">{task.description}</p><Button className="w-full min-h-12" onClick={() => terminer(task)}><Check className="h-5 w-5 mr-2" />Fait</Button></CardContent></Card>)}{!tasks.length && <Card><CardContent className="py-12 text-center text-muted-foreground">{echeances.length > 0 ? 'Aucune tâche terrain planifiée — voir les échéances ci-dessus.' : 'Aucune tâche à réaliser dans les sept prochains jours.'}</CardContent></Card>}</div>
  </main></div>
}
