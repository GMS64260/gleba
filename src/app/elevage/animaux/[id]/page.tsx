"use client"

/**
 * Page detail animal - Fiche complete avec timeline chronologique
 */

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { UserMenu } from "@/components/auth/UserMenu"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"
import {
  Bird,
  ArrowLeft,
  Sprout,
  TreeDeciduous,
  Wallet,
  Settings,
  Stethoscope,
  Egg,
  Scissors,
  Baby,
  Calendar,
  Weight,
  MapPin,
  Heart,
} from "lucide-react"
import { GenealogyTree } from "@/components/elevage/GenealogyTree"

const STATUT_COLORS: Record<string, string> = {
  actif: "bg-green-100 text-green-800",
  vendu: "bg-blue-100 text-blue-800",
  abattu: "bg-red-100 text-red-800",
  mort: "bg-slate-100 text-slate-800",
  reforme: "bg-orange-100 text-orange-800",
}

const SOIN_TYPE_LABELS: Record<string, string> = {
  vaccination: "Vaccination",
  vermifuge: "Vermifuge",
  traitement: "Traitement",
  autre: "Autre",
}

interface AnimalDetail {
  id: number
  identifiant: string | null
  nom: string | null
  race: string | null
  sexe: string | null
  dateNaissance: string | null
  dateArrivee: string | null
  statut: string
  dateSortie: string | null
  causeSortie: string | null
  provenance: string | null
  prixAchat: number | null
  poidsActuel: number | null
  couleur: string | null
  notes: string | null
  pereIdentifiant: string | null
  especeAnimale: {
    id: string
    nom: string
    type: string
    couleur: string | null
    ponteAnnuelle: number | null
    poidsAdulte: number | null
    consommationJour: number | null
  }
  lot: { id: number; nom: string | null } | null
  mere: {
    id: number
    nom: string | null
    identifiant: string | null
    sexe: string | null
    mere: { id: number; nom: string | null; identifiant: string | null } | null
  } | null
  enfants: {
    id: number
    nom: string | null
    identifiant: string | null
    sexe: string | null
    dateNaissance: string | null
    statut: string
  }[]
  naissancesMere: {
    id: number
    date: string
    nombreNes: number
    nombreVivants: number
    nombreMales: number | null
    nombreFemelles: number | null
  }[]
  productionsOeufs: {
    id: number
    date: string
    quantite: number
    casses: number | null
  }[]
  soins: {
    id: number
    date: string
    type: string
    description: string | null
    produit: string | null
    cout: number | null
    fait: boolean
    finAttenteLait: string | null
    finAttenteViande: string | null
  }[]
  abattages: {
    id: number
    date: string
    poidsVif: number | null
    poidsCarcasse: number | null
    destination: string
  }[]
}

// Timeline event type
interface TimelineEvent {
  date: string
  type: "soin" | "production" | "naissance" | "abattage"
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  bgColor: string
  title: string
  detail: string
}

export default function AnimalDetailPage() {
  const { data: session } = useSession()
  const { id } = useParams()
  const router = useRouter()
  const { toast } = useToast()
  const [animal, setAnimal] = React.useState<AnimalDetail | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)

  React.useEffect(() => {
    async function fetchAnimal() {
      setIsLoading(true)
      try {
        const res = await fetch(`/api/elevage/animaux/${id}`)
        if (res.ok) {
          const result = await res.json()
          setAnimal(result.data)
        } else {
          toast({ variant: "destructive", title: "Animal non trouve" })
          router.push("/elevage?tab=animaux")
        }
      } catch {
        toast({ variant: "destructive", title: "Erreur de chargement" })
      } finally {
        setIsLoading(false)
      }
    }
    if (id) fetchAnimal()
  }, [id, router, toast])

  // Calculer age
  const getAge = (dateNaissance: string | null) => {
    if (!dateNaissance) return null
    const born = new Date(dateNaissance)
    const now = new Date()
    const months = (now.getFullYear() - born.getFullYear()) * 12 + (now.getMonth() - born.getMonth())
    if (months < 1) {
      const days = Math.floor((now.getTime() - born.getTime()) / (1000 * 60 * 60 * 24))
      return `${days}j`
    }
    if (months < 12) return `${months} mois`
    const years = Math.floor(months / 12)
    const remainMonths = months % 12
    return remainMonths > 0 ? `${years}a ${remainMonths}m` : `${years} an${years > 1 ? 's' : ''}`
  }

  // Construire timeline
  const buildTimeline = (a: AnimalDetail): TimelineEvent[] => {
    const events: TimelineEvent[] = []

    a.soins.forEach(s => {
      events.push({
        date: s.date,
        type: "soin",
        icon: Stethoscope,
        iconColor: "text-blue-600",
        bgColor: "bg-blue-100",
        title: SOIN_TYPE_LABELS[s.type] || s.type,
        detail: [s.produit, s.description, s.cout ? `${s.cout.toFixed(2)} \u20ac` : null].filter(Boolean).join(" - "),
      })
    })

    a.productionsOeufs.forEach(p => {
      events.push({
        date: p.date,
        type: "production",
        icon: Egg,
        iconColor: "text-yellow-600",
        bgColor: "bg-yellow-100",
        title: `${p.quantite} oeufs`,
        detail: p.casses ? `dont ${p.casses} casses` : "",
      })
    })

    a.naissancesMere.forEach(n => {
      events.push({
        date: n.date,
        type: "naissance",
        icon: Baby,
        iconColor: "text-pink-600",
        bgColor: "bg-pink-100",
        title: `${n.nombreNes} né(s), ${n.nombreVivants} vivant(s)`,
        detail: [n.nombreMales ? `${n.nombreMales}M` : null, n.nombreFemelles ? `${n.nombreFemelles}F` : null].filter(Boolean).join(" / "),
      })
    })

    a.abattages.forEach(ab => {
      events.push({
        date: ab.date,
        type: "abattage",
        icon: Scissors,
        iconColor: "text-red-600",
        bgColor: "bg-red-100",
        title: `Abattage - ${ab.destination}`,
        detail: [ab.poidsVif ? `${ab.poidsVif}kg vif` : null, ab.poidsCarcasse ? `${ab.poidsCarcasse}kg carc.` : null].filter(Boolean).join(" / "),
      })
    })

    events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    return events
  }

  if (!session) {
    return <div className="min-h-screen flex items-center justify-center"><p>Chargement...</p></div>
  }

  return (
    <div className="min-h-screen bg-slate-50 aurora-bg-subtle">
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" aria-hidden="true" />
      {/* Header global */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-2.5 flex items-center justify-between max-w-[1600px]">
          <Link href="/" className="flex items-center hover:opacity-90 transition-opacity">
            <Image src="/gleba-logo.png" alt="Gleba" width={120} height={80} className="h-10 w-auto rounded-lg" priority />
          </Link>
          <div className="flex items-center gap-2">
            <div className="flex items-center border rounded-lg overflow-hidden">
              <Link href="/"><Button variant="ghost" size="sm" className="rounded-none text-green-700 hover:text-green-800 hover:bg-green-50 border-r"><Sprout className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Maraîchage</span></Button></Link>
              <Link href="/verger"><Button variant="ghost" size="sm" className="rounded-none text-lime-700 hover:text-lime-800 hover:bg-lime-50 border-r"><TreeDeciduous className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Verger</span></Button></Link>
              <Link href="/elevage?tab=animaux"><Button variant="ghost" size="sm" className="rounded-none bg-amber-50 text-amber-700 border-r"><Bird className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Élevage</span></Button></Link>
              <Link href="/comptabilite"><Button variant="ghost" size="sm" className="rounded-none text-blue-700 hover:text-blue-800 hover:bg-blue-50"><Wallet className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Compta</span></Button></Link>
            </div>
            <Link href="/parametres"><Button variant="ghost" size="sm"><Settings className="h-4 w-4" /></Button></Link>
            {session?.user && <UserMenu user={session.user} />}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-[1200px]">
        {/* Retour */}
        <Button variant="ghost" size="sm" onClick={() => router.push("/elevage?tab=animaux")} className="mb-4 -ml-2">
          <ArrowLeft className="h-4 w-4 mr-1" />
          Retour élevage
        </Button>

        {isLoading ? (
          <div className="space-y-4">
            <Skeleton className="h-24 w-full" />
            <div className="grid gap-4 md:grid-cols-3"><Skeleton className="h-32" /><Skeleton className="h-32" /><Skeleton className="h-32" /></div>
            <Skeleton className="h-64 w-full" />
          </div>
        ) : animal ? (
          <div className="space-y-6">
            {/* Header animal */}
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center text-white text-2xl font-bold"
                style={{ backgroundColor: animal.especeAnimale.couleur || '#f59e0b' }}>
                {animal.sexe === 'femelle' ? '\u2640' : animal.sexe === 'male' ? '\u2642' : '?'}
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold">
                  {animal.nom || animal.identifiant || `Animal #${animal.id}`}
                </h1>
                <div className="flex items-center gap-2 mt-1 flex-wrap">
                  <Badge className={STATUT_COLORS[animal.statut] || ''}>{animal.statut}</Badge>
                  <span className="text-sm text-muted-foreground">{animal.especeAnimale.nom}</span>
                  {animal.race && <span className="text-sm text-muted-foreground">- {animal.race}</span>}
                  {animal.identifiant && <span className="text-xs font-mono bg-slate-100 px-2 py-0.5 rounded">{animal.identifiant}</span>}
                </div>
              </div>
              {/* Bug #19 — Boutons d'action contextuels manquaient ;
                  on les renvoie vers la liste Animaux pour les modaux
                  existants (édition, soin via Alimentation > Soins). */}
              <div className="flex flex-col gap-2 items-end">
                <Link
                  href={`/elevage?tab=alimentation&sub=soins&animalId=${animal.id}`}
                  className="text-xs inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-blue-50 text-blue-700 hover:bg-blue-100"
                >
                  + Soin
                </Link>
                <Link
                  href={`/elevage?tab=animaux&edit=${animal.id}`}
                  className="text-xs inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-slate-100 text-slate-700 hover:bg-slate-200"
                >
                  Modifier
                </Link>
              </div>
            </div>

            {/* Délai d'attente — remise en vente lait/viande (feedback éleveur 2026-07-24) */}
            {(() => {
              const auj = new Date(new Date().toDateString()).getTime()
              const faits = animal.soins.filter((s) => s.fait)
              const futurs = (arr: (string | null)[]) =>
                arr.filter((d): d is string => !!d).map((d) => new Date(d).getTime()).filter((t) => t >= auj)
              const laitTs = futurs(faits.map((s) => s.finAttenteLait))
              const viandeTs = futurs(faits.map((s) => s.finAttenteViande))
              if (laitTs.length === 0 && viandeTs.length === 0) return null
              const remise = (ts: number) => {
                const x = new Date(ts)
                x.setDate(x.getDate() + 1)
                return x.toLocaleDateString('fr-FR')
              }
              return (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm">
                  <div className="font-semibold text-amber-800">⚠️ Délai d&apos;attente vétérinaire en cours</div>
                  <div className="mt-1 text-amber-900 flex flex-wrap gap-x-6 gap-y-1">
                    {laitTs.length > 0 && (
                      <span>🥛 Lait vendable à partir du <b>{remise(Math.max(...laitTs))}</b></span>
                    )}
                    {viandeTs.length > 0 && (
                      <span>🥩 Viande à partir du <b>{remise(Math.max(...viandeTs))}</b></span>
                    )}
                  </div>
                </div>
              )
            })()}

            {/* Cards info */}
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-1 pt-3 px-4">
                  <CardDescription className="text-xs flex items-center gap-1"><Calendar className="h-3 w-3" />Age</CardDescription>
                  <CardTitle className="text-lg">{getAge(animal.dateNaissance) || '-'}</CardTitle>
                </CardHeader>
                <CardContent className="pb-3 px-4">
                  <p className="text-xs text-muted-foreground">
                    {animal.dateNaissance ? `Né(e) le ${new Date(animal.dateNaissance).toLocaleDateString('fr-FR')}` : 'Date inconnue'}
                  </p>
                </CardContent>
              </Card>

              {/* Bug cmp8sf92p (Marc 2026-05-16) — afficher "-" en gros et
                  "Adulte : 65 kg" en petit était trompeur. On préfère le poids
                  actuel si saisi, sinon le poids adulte de l'espèce comme valeur
                  principale avec un préfixe ≈ pour signaler l'estimation. */}
              <Card>
                <CardHeader className="pb-1 pt-3 px-4">
                  <CardDescription className="text-xs flex items-center gap-1"><Weight className="h-3 w-3" />Poids</CardDescription>
                  <CardTitle className="text-lg">
                    {animal.poidsActuel
                      ? `${animal.poidsActuel} kg`
                      : animal.especeAnimale.poidsAdulte
                        ? `≈ ${animal.especeAnimale.poidsAdulte} kg`
                        : '-'}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pb-3 px-4">
                  <p className="text-xs text-muted-foreground">
                    {animal.poidsActuel
                      ? (animal.especeAnimale.poidsAdulte ? `Adulte : ${animal.especeAnimale.poidsAdulte} kg` : '')
                      : (animal.especeAnimale.poidsAdulte ? "Estimation espèce (poids adulte)" : 'Aucun poids saisi')}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-1 pt-3 px-4">
                  <CardDescription className="text-xs flex items-center gap-1"><MapPin className="h-3 w-3" />Lot</CardDescription>
                  <CardTitle className="text-lg">{animal.lot?.nom || 'Aucun'}</CardTitle>
                </CardHeader>
                <CardContent className="pb-3 px-4">
                  <p className="text-xs text-muted-foreground">
                    {animal.provenance ? `Provenance : ${animal.provenance}` : ''}
                  </p>
                </CardContent>
              </Card>

              {(() => {
                // Bug cmp8sdg9b (Marc 2026-05-16) — la carte Généalogie comptait
                // uniquement les enfants référencés individuellement en table
                // Animal, ignorant les naissances déclarées (table NaissanceAnimale).
                // On somme les deux et on libelle "descendants" pour lever
                // l'ambiguïté avec la mère.
                const enfantsRef = animal.enfants.length
                const totalNes = animal.naissancesMere.reduce((s, n) => s + n.nombreVivants, 0)
                const totalDescendants = enfantsRef + Math.max(0, totalNes - enfantsRef)
                return (
                  <Card>
                    <CardHeader className="pb-1 pt-3 px-4">
                      <CardDescription className="text-xs flex items-center gap-1"><Heart className="h-3 w-3" />Descendance</CardDescription>
                      <CardTitle className="text-lg">{totalDescendants} descendant{totalDescendants > 1 ? 's' : ''}</CardTitle>
                    </CardHeader>
                    <CardContent className="pb-3 px-4">
                      <p className="text-xs text-muted-foreground">
                        {enfantsRef > 0 && `${enfantsRef} fiche${enfantsRef > 1 ? 's' : ''} · `}
                        {totalNes > 0 ? `${totalNes} né${totalNes > 1 ? 's' : ''}` : (enfantsRef > 0 ? '' : 'Aucune naissance enregistrée')}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {animal.mere ? `Mère : ${animal.mere.nom || animal.mere.identifiant || `#${animal.mere.id}`}` : 'Mère inconnue'}
                      </p>
                    </CardContent>
                  </Card>
                )
              })()}
            </div>

            {/* Arbre genealogique */}
            {(animal.mere || animal.pereIdentifiant || animal.enfants.length > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Heart className="h-4 w-4 text-pink-600" />
                    Généalogie
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <GenealogyTree animal={animal} />
                </CardContent>
              </Card>
            )}

            {/* GAP P1 — Pesées & croissance (GMQ) */}
            <PeseesCard animalId={animal.id} />

            {/* Timeline chronologique */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Historique</CardTitle>
                <CardDescription>Soins, productions, naissances, abattages</CardDescription>
              </CardHeader>
              <CardContent>
                {(() => {
                  const timeline = buildTimeline(animal)
                  if (timeline.length === 0) {
                    return <p className="text-sm text-muted-foreground text-center py-4">Aucun événement enregistré</p>
                  }
                  return (
                    <div className="space-y-3 max-h-[500px] overflow-y-auto">
                      {timeline.map((event, idx) => (
                        <div key={idx} className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-full ${event.bgColor} flex items-center justify-center flex-shrink-0 mt-0.5`}>
                            <event.icon className={`h-4 w-4 ${event.iconColor}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{event.title}</span>
                              <span className="text-xs text-muted-foreground">
                                {new Date(event.date).toLocaleDateString('fr-FR')}
                              </span>
                            </div>
                            {event.detail && (
                              <p className="text-xs text-muted-foreground mt-0.5">{event.detail}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                })()}
              </CardContent>
            </Card>

            {/* Notes */}
            {animal.notes && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Notes</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-wrap">{animal.notes}</p>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Animal non trouve</p>
          </div>
        )}
      </main>
    </div>
  )
}

// ============================================================
// GAP P1 — Pesées & croissance (historique de poids + GMQ)
// ============================================================
type PeseeRow = { id: string; date: string; poidsKg: number; gmq: number | null; notes: string | null }

function PeseesCard({ animalId }: { animalId: number }) {
  const { toast } = useToast()
  const [data, setData] = React.useState<PeseeRow[]>([])
  const [gmqGlobal, setGmqGlobal] = React.useState<number | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [date, setDate] = React.useState(() => new Date().toISOString().slice(0, 10))
  const [poids, setPoids] = React.useState("")
  const [saving, setSaving] = React.useState(false)

  const reload = React.useCallback(() => {
    setLoading(true)
    fetch(`/api/elevage/pesees?animalId=${animalId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j) { setData(j.data || []); setGmqGlobal(j.gmqGlobal ?? null) } })
      .finally(() => setLoading(false))
  }, [animalId])
  React.useEffect(() => { reload() }, [reload])

  const ajouter = async () => {
    const p = parseFloat(poids)
    if (!(p > 0)) { toast({ variant: "destructive", title: "Poids invalide" }); return }
    setSaving(true)
    const res = await fetch("/api/elevage/pesees", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ animalId, date, poidsKg: p }),
    })
    setSaving(false)
    if (res.ok) { setPoids(""); toast({ title: "Pesée enregistrée" }); reload() }
    else { const j = await res.json().catch(() => ({})); toast({ variant: "destructive", title: "Erreur", description: j.error }) }
  }
  const supprimer = async (id: string) => {
    const res = await fetch(`/api/elevage/pesees?id=${id}`, { method: "DELETE" })
    if (res.ok) { toast({ title: "Pesée supprimée" }); reload() }
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Weight className="h-4 w-4 text-slate-500" /> Pesées &amp; croissance
          {gmqGlobal != null && (
            <Badge variant="outline" className="ml-auto">GMQ global {gmqGlobal > 0 ? "+" : ""}{gmqGlobal} g/j</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap items-end gap-2">
          <div><Label className="text-xs">Date</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-9 w-40" /></div>
          <div><Label className="text-xs">Poids (kg)</Label><Input type="number" step="0.1" min="0" value={poids} onChange={(e) => setPoids(e.target.value)} className="h-9 w-28" placeholder="0" /></div>
          <Button size="sm" onClick={ajouter} disabled={saving}>Ajouter</Button>
        </div>
        {loading ? (
          <Skeleton className="h-16 w-full" />
        ) : data.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune pesée enregistrée. Ajoutez-en pour suivre la croissance (gain moyen quotidien).</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b">
                <tr><th className="p-1.5 text-left">Date</th><th className="p-1.5 text-right">Poids</th><th className="p-1.5 text-right">GMQ</th><th className="p-1.5"></th></tr>
              </thead>
              <tbody>
                {[...data].reverse().map((p) => (
                  <tr key={p.id} className="border-b hover:bg-slate-50">
                    <td className="p-1.5">{new Date(p.date).toLocaleDateString("fr-FR")}</td>
                    <td className="p-1.5 text-right font-medium">{p.poidsKg} kg</td>
                    <td className="p-1.5 text-right text-slate-500">{p.gmq != null ? `${p.gmq > 0 ? "+" : ""}${p.gmq} g/j` : "—"}</td>
                    <td className="p-1.5 text-right"><button onClick={() => supprimer(p.id)} className="text-red-500 hover:text-red-700" title="Supprimer">&times;</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
