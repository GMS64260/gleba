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
  icon: React.ElementType
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
        title: `${n.nombreNes} ne(s), ${n.nombreVivants} vivant(s)`,
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
              <Link href="/arbres"><Button variant="ghost" size="sm" className="rounded-none text-lime-700 hover:text-lime-800 hover:bg-lime-50 border-r"><TreeDeciduous className="h-4 w-4 mr-1" /><span className="hidden sm:inline">Verger</span></Button></Link>
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
            </div>

            {/* Cards info */}
            <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
              <Card>
                <CardHeader className="pb-1 pt-3 px-4">
                  <CardDescription className="text-xs flex items-center gap-1"><Calendar className="h-3 w-3" />Age</CardDescription>
                  <CardTitle className="text-lg">{getAge(animal.dateNaissance) || '-'}</CardTitle>
                </CardHeader>
                <CardContent className="pb-3 px-4">
                  <p className="text-xs text-muted-foreground">
                    {animal.dateNaissance ? `Ne(e) le ${new Date(animal.dateNaissance).toLocaleDateString('fr-FR')}` : 'Date inconnue'}
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-1 pt-3 px-4">
                  <CardDescription className="text-xs flex items-center gap-1"><Weight className="h-3 w-3" />Poids</CardDescription>
                  <CardTitle className="text-lg">{animal.poidsActuel ? `${animal.poidsActuel} kg` : '-'}</CardTitle>
                </CardHeader>
                <CardContent className="pb-3 px-4">
                  <p className="text-xs text-muted-foreground">
                    {animal.especeAnimale.poidsAdulte ? `Adulte : ${animal.especeAnimale.poidsAdulte} kg` : ''}
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

              <Card>
                <CardHeader className="pb-1 pt-3 px-4">
                  <CardDescription className="text-xs flex items-center gap-1"><Heart className="h-3 w-3" />Genealogie</CardDescription>
                  <CardTitle className="text-lg">{animal.enfants.length} enfant(s)</CardTitle>
                </CardHeader>
                <CardContent className="pb-3 px-4">
                  <p className="text-xs text-muted-foreground">
                    {animal.mere ? `Mere : ${animal.mere.nom || animal.mere.identifiant || `#${animal.mere.id}`}` : 'Mere inconnue'}
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Arbre genealogique */}
            {(animal.mere || animal.pereIdentifiant || animal.enfants.length > 0) && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Heart className="h-4 w-4 text-pink-600" />
                    Genealogie
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <GenealogyTree animal={animal} />
                </CardContent>
              </Card>
            )}

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
                    return <p className="text-sm text-muted-foreground text-center py-4">Aucun evenement enregistre</p>
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
