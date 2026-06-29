"use client"

/**
 * Page Calendrier Gantt des ITPs
 * Vue annuelle type potaleger avec barres colorées par phase.
 *
 * Adaptation climatique : les dates de semis/plantation/récolte sont recalées
 * selon la zone climatique de l'exploitation (lib/calendrier-climat) + un réglage
 * fin précoce/tardif. Le filtre planches s'appuie sur les planches réelles de
 * l'utilisateur. Un encart biodynamique relie les semis aux jours lunaires.
 */

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Filter, Download, Snowflake, MapPin, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { GanttRow } from "@/components/itps/GanttRow"
import { ItpEditDialog } from "@/components/itps/ItpEditDialog"
import { SemisLunaireEncart } from "@/components/itps/SemisLunaireEncart"
import { libelleDecalage } from "@/lib/calendrier-climat"
import { alertDialog } from "@/lib/global-dialog"

interface ITPWithEspece {
  id: string
  especeId: string | null
  espece?: {
    id: string
    couleur: string | null
    modeSemis?: string | null
    famille?: { id?: string } | null
  } | null
  semaineSemis: number | null
  semainePlantation: number | null
  semaineRecolte: number | null
  dureeRecolte: number | null
  dureePepiniere?: number | null
  typePlanche: string | null
  notes: string | null
}

interface ZoneOption {
  value: string
  label: string
  decalage: number
}

interface ClimatPayload {
  zone: string | null
  label: string | null
  source: "manuelle" | "auto" | "inconnue"
  zoneDerivee: string | null
  labelDerivee: string | null
  decalage: number
  dernieresGelees: number | null
  premieresGelees: number | null
  options: ZoneOption[]
}

const MOIS_COURTS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"]

// Types de planche considérés « sous abri » (génériques) — utilisés pour faire
// correspondre les planches réelles de l'utilisateur aux ITP « Sous abri ».
const TYPES_ABRI = ["Serre", "Tunnel", "Châssis", "Chassis", "Sous abri"]

function libelleSemaine(semaine: number | null): string {
  if (!semaine) return "—"
  // Approx : 1er janvier + (semaine-1) × 7 jours, pour afficher le mois.
  const d = new Date(2025, 0, 1 + (semaine - 1) * 7)
  return `S${semaine} · ${d.toLocaleDateString("fr-FR", { day: "numeric", month: "short" })}`
}

export default function ITCalendrierPage() {
  const [itps, setItps] = React.useState<ITPWithEspece[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [filtreTypePlanche, setFiltreTypePlanche] = React.useState("all")
  const [recherche, setRecherche] = React.useState("")
  const [editingItp, setEditingItp] = React.useState<ITPWithEspece | null>(null)
  const [editDialogOpen, setEditDialogOpen] = React.useState(false)

  // Adaptation climatique
  const [climat, setClimat] = React.useState<ClimatPayload | null>(null)
  const [reglageFin, setReglageFin] = React.useState(0) // -4..+4 semaines
  const [savingZone, setSavingZone] = React.useState(false)

  // Planches réelles de l'utilisateur (types disponibles)
  const [typesPlanchesUser, setTypesPlanchesUser] = React.useState<string[]>([])
  const [nbPlanches, setNbPlanches] = React.useState(0)

  // Charger les ITPs
  React.useEffect(() => {
    async function fetchITPs() {
      setIsLoading(true)
      try {
        const response = await fetch("/api/itps?pageSize=500")
        if (response.ok) {
          const data = await response.json()
          setItps(data.data || data.itps || [])
        }
      } catch (error) {
        console.error("Erreur chargement ITPs:", error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchITPs()
  }, [])

  // Charger la zone climatique + les planches de l'utilisateur
  React.useEffect(() => {
    fetch("/api/calendrier-climat")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setClimat(d))
      .catch(() => {})

    fetch("/api/planches?pageSize=500")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const liste = d?.data || d?.planches || []
        setNbPlanches(liste.length)
        const types = Array.from(
          new Set(liste.map((p: { type?: string | null }) => p.type).filter(Boolean))
        ) as string[]
        setTypesPlanchesUser(types)
      })
      .catch(() => {})
  }, [])

  const userADeLAbri = typesPlanchesUser.some((t) => TYPES_ABRI.includes(t))
  const userADuPleinChamp = typesPlanchesUser.includes("Plein champ")

  // Décalage total appliqué à l'affichage
  const decalageZone = climat?.decalage ?? 0
  const decalageTotal = decalageZone + reglageFin

  const changerZone = async (value: string) => {
    setSavingZone(true)
    const zone = value === "auto" ? null : value
    try {
      const r = await fetch("/api/calendrier-climat", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ zone }),
      })
      if (r.ok) {
        setClimat(await r.json())
      } else {
        const p = await r.json().catch(() => null)
        await alertDialog(p?.error || "Impossible de changer la zone climatique", { title: "Erreur" })
      }
    } catch {
      await alertDialog("Erreur réseau lors du changement de zone climatique", { title: "Erreur" })
    } finally {
      setSavingZone(false)
    }
  }

  // Filtrer les ITPs
  const itpsFiltres = React.useMemo(() => {
    return itps.filter((itp) => {
      // Filtre planches
      if (filtreTypePlanche === "mes-planches") {
        const t = itp.typePlanche
        if (!t) return true // ITP générique : toujours affiché
        if (TYPES_ABRI.includes(t)) return userADeLAbri
        if (t === "Plein champ") return userADuPleinChamp
        return false
      } else if (filtreTypePlanche !== "all" && itp.typePlanche !== filtreTypePlanche) {
        return false
      }

      // Filtre recherche
      if (recherche) {
        const search = recherche.toLowerCase()
        return (
          itp.id.toLowerCase().includes(search) ||
          itp.especeId?.toLowerCase().includes(search) ||
          false
        )
      }

      return true
    })
  }, [itps, filtreTypePlanche, recherche, userADeLAbri, userADuPleinChamp])

  const handleEdit = (itp: ITPWithEspece) => {
    setEditingItp(itp)
    setEditDialogOpen(true)
  }

  const handleSaved = (updated: ITPWithEspece) => {
    setItps((prev) => prev.map((itp) => (itp.id === updated.id ? updated : itp)))
  }

  const zoneInconnue = !climat || climat.source === "inconnue"

  return (
    <div className="min-h-screen bg-slate-50 aurora-bg-subtle">
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" aria-hidden="true" />
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/maraichage/itps">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                ITPs
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">Calendrier des ITPs</h1>
              <p className="text-sm text-muted-foreground">
                Timeline annuelle adaptée à votre climat — cliquez sur une ligne pour modifier
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Adaptation climatique */}
        <Card className="mb-4 border-emerald-200 bg-emerald-50/40">
          <CardContent className="pt-4">
            <div className="flex flex-col lg:flex-row lg:items-end gap-4">
              {/* Zone climatique */}
              <div className="flex-1">
                <label className="text-xs font-medium text-slate-700 flex items-center gap-1.5 mb-1">
                  <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                  Zone climatique
                  {savingZone && <Loader2 className="h-3 w-3 animate-spin" />}
                </label>
                <Select
                  value={climat?.source === "manuelle" ? climat.zone ?? "auto" : "auto"}
                  onValueChange={changerZone}
                >
                  <SelectTrigger className="w-full md:w-72 bg-white">
                    <SelectValue placeholder="Zone climatique" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">
                      Détection auto
                      {climat?.labelDerivee ? ` (${climat.labelDerivee})` : " (non déterminée)"}
                    </SelectItem>
                    {climat?.options.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                        {o.decalage !== 0
                          ? ` — semis ${o.decalage > 0 ? "+" : "−"}${Math.abs(o.decalage)} sem.`
                          : " — référence"}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-1">
                  {zoneInconnue ? (
                    <>
                      Zone non détectée (renseignez le code postal de votre exploitation
                      ou choisissez une zone). Calendrier affiché sans décalage.
                    </>
                  ) : (
                    <>
                      {climat.source === "auto" ? "Détectée automatiquement" : "Choix manuel"} :{" "}
                      <strong>{climat.label}</strong> — dates {libelleDecalage(decalageZone)}.
                    </>
                  )}
                </p>
              </div>

              {/* Réglage fin précoce/tardif */}
              <div className="lg:w-72">
                <label className="text-xs font-medium text-slate-700 mb-1 block">
                  Réglage fin :{" "}
                  <span className="font-semibold">
                    {reglageFin === 0
                      ? "aucun"
                      : `${reglageFin > 0 ? "+" : "−"}${Math.abs(reglageFin)} sem.`}
                  </span>
                </label>
                <input
                  type="range"
                  min={-4}
                  max={4}
                  step={1}
                  value={reglageFin}
                  onChange={(e) => setReglageFin(parseInt(e.target.value))}
                  className="w-full accent-emerald-600"
                />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>← précoce</span>
                  <span>tardif →</span>
                </div>
              </div>
            </div>

            {/* Badge décalage total + gelées */}
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              {decalageTotal !== 0 && (
                <Badge className="bg-emerald-600 hover:bg-emerald-600">
                  Dates ajustées : {decalageTotal > 0 ? "+" : "−"}
                  {Math.abs(decalageTotal)} semaine{Math.abs(decalageTotal) > 1 ? "s" : ""}
                </Badge>
              )}
              {!zoneInconnue && climat && (climat.dernieresGelees || climat.premieresGelees) && (
                <span className="inline-flex items-center gap-1.5 text-slate-600 bg-white rounded-full px-2.5 py-1 ring-1 ring-slate-200">
                  <Snowflake className="h-3.5 w-3.5 text-sky-500" />
                  Gelées moyennes : dernières{" "}
                  <strong>{libelleSemaine(climat.dernieresGelees)}</strong> · premières{" "}
                  <strong>{libelleSemaine(climat.premieresGelees)}</strong>
                </span>
              )}
              {!zoneInconnue && climat && !climat.dernieresGelees && (
                <span className="inline-flex items-center gap-1.5 text-slate-600 bg-white rounded-full px-2.5 py-1 ring-1 ring-slate-200">
                  <Snowflake className="h-3.5 w-3.5 text-slate-300" />
                  Pas de risque de gelée (climat doux)
                </span>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Encart biodynamique */}
        {!isLoading && itps.length > 0 && (
          <div className="mb-4">
            <SemisLunaireEncart itps={itps} decalage={decalageTotal} />
          </div>
        )}

        {/* Filtres */}
        <Card className="mb-4">
          <CardContent className="pt-4">
            <div className="flex flex-col md:flex-row gap-3">
              <div className="flex-1">
                <Input
                  placeholder="Rechercher ITP ou espèce..."
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  className="w-full"
                />
              </div>
              <Select value={filtreTypePlanche} onValueChange={setFiltreTypePlanche}>
                <SelectTrigger className="w-full md:w-56">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Type planche" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous types</SelectItem>
                  {nbPlanches > 0 && (
                    <SelectItem value="mes-planches">
                      Compatibles avec mes planches ({nbPlanches})
                    </SelectItem>
                  )}
                  <SelectItem value="Plein champ">Plein champ</SelectItem>
                  <SelectItem value="Sous abri">Sous abri</SelectItem>
                  <SelectItem value="Serre">Serre</SelectItem>
                  <SelectItem value="Tunnel">Tunnel</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {nbPlanches > 0 && (
              <p className="mt-2 text-xs text-muted-foreground">
                Vos planches : {typesPlanchesUser.length > 0 ? typesPlanchesUser.join(", ") : "type non précisé"}.
                {" "}Le filtre « Compatibles avec mes planches » masque les itinéraires qui demandent un abri ou
                un plein champ dont vous ne disposez pas.
              </p>
            )}

            <div className="mt-3 flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-2">
                <div className="w-4 h-3 bg-orange-400 rounded"></div>
                <span>Semis</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-3 bg-green-500 rounded"></div>
                <span>Croissance</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-4 h-3 bg-purple-500 rounded"></div>
                <span>Récolte</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tableau Gantt */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{itpsFiltres.length} itineraires</CardTitle>
              <Button variant="outline" size="sm" disabled>
                <Download className="h-4 w-4 mr-2" />
                Export PDF
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-96 w-full" />
            ) : itpsFiltres.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>Aucun ITP trouvé avec ces filtres</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2 bg-muted font-medium sticky left-0 z-10 min-w-[200px]">
                        ITP / Espèce
                      </th>
                      <th className="text-left p-2 bg-muted font-medium min-w-[100px]">Type</th>
                      {MOIS_COURTS.map((m) => (
                        <th key={m} className="text-center p-1 bg-muted font-medium text-xs w-[60px]">
                          {m}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {itpsFiltres.map((itp) => (
                      <GanttRow key={itp.id} itp={itp} onEdit={handleEdit} decalage={decalageTotal} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Aide */}
        <Card className="mt-4 bg-blue-50 border-blue-200">
          <CardContent className="py-3">
            <p className="text-sm text-blue-800">
              <strong>Comment lire ce calendrier :</strong> les barres montrent les périodes de semis
              (orange), croissance (vert) et récolte (violet). Les dates sont recalées selon votre zone
              climatique{decalageTotal !== 0 ? " (décalage appliqué)" : ""} ; l&apos;itinéraire de référence
              reste inchangé. Cliquez sur une ligne pour le modifier.
            </p>
          </CardContent>
        </Card>
      </main>

      {/* Dialog d'édition */}
      <ItpEditDialog
        itp={editingItp}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSaved={handleSaved}
      />
    </div>
  )
}
