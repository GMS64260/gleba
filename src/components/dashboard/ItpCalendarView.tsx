"use client"

/**
 * Vue Calendrier Gantt des ITPs embarquable dans le dashboard
 * Reprend la logique de /itps/calendrier sans le layout page
 * Éditable : cliquer sur une ligne pour modifier les semaines
 */

import * as React from "react"
import { useSession } from "next-auth/react"
import { Filter, MapPin } from "lucide-react"

import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { GanttRow } from "@/components/itps/GanttRow"
import { ItpEditDialog } from "@/components/itps/ItpEditDialog"
import { decalageItpPourLecteur, itpApplicableAZone } from "@/lib/calendrier-climat"
import type { ItpVue } from "@/components/itps/types"
import type { ZoneClimat } from "@/lib/terroir"

const MOIS_COURTS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"]

export function ItpCalendarView() {
  const { data: session } = useSession()
  const currentUserId = (session?.user as { id?: string } | undefined)?.id ?? null
  const [itps, setItps] = React.useState<ItpVue[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [filtreTypePlanche, setFiltreTypePlanche] = React.useState('all')
  const [recherche, setRecherche] = React.useState('')
  const [editingItp, setEditingItp] = React.useState<ItpVue | null>(null)
  const [editDialogOpen, setEditDialogOpen] = React.useState(false)
  // Décalage climatique (zone de l'exploitation) appliqué aux barres.
  const [decalageZone, setDecalageZone] = React.useState(0)
  const [zoneLabel, setZoneLabel] = React.useState<string | null>(null)
  const [zone, setZone] = React.useState<string | null>(null)
  const [horsReference, setHorsReference] = React.useState(false)

  React.useEffect(() => {
    fetch("/api/calendrier-climat")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return
        // Outre-mer : ITP calés sur la zone, donc aucun décalage métropolitain.
        setHorsReference(d.horsReference ?? false)
        setDecalageZone(d.horsReference ? 0 : (d.decalage ?? 0))
        setZoneLabel(d.label ?? null)
        setZone(d.zone ?? null)
      })
      .catch(() => {})
  }, [])

  React.useEffect(() => {
    async function fetchITPs() {
      setIsLoading(true)
      try {
        const response = await fetch(
          '/api/itps?pageSize=1000&applicable=1&sortBy=confiance'
        )
        if (response.ok) {
          const data = await response.json()
          setItps(data.data || data.itps || [])
        }
      } catch (error) {
        console.error('Erreur chargement ITPs:', error)
      } finally {
        setIsLoading(false)
      }
    }
    fetchITPs()
  }, [])

  const itpsFiltres = React.useMemo(() => {
    return itps.filter(itp => {
      // Filtre par zone : outre-mer → ITP calés sur la zone ; métropole → référentiel métropolitain.
      if (!itpApplicableAZone(itp.zoneClimat, zone as ZoneClimat | null)) {
        return false
      }
      if (filtreTypePlanche !== 'all' && itp.typePlanche !== filtreTypePlanche) {
        return false
      }
      if (recherche) {
        const search = recherche.toLowerCase()
        return (
          itp.id.toLowerCase().includes(search) ||
          itp.nom?.toLowerCase().includes(search) ||
          itp.especeId?.toLowerCase().includes(search) ||
          false
        )
      }
      return true
    })
  }, [itps, filtreTypePlanche, recherche, zone])

  const conduitesDisponibles = React.useMemo(
    () =>
      Array.from(new Set(itps.map((i) => i.typePlanche).filter(Boolean) as string[])).sort((a, b) =>
        a.localeCompare(b, "fr")
      ),
    [itps]
  )

  const handleEdit = (itp: ItpVue) => {
    setEditingItp(itp)
    setEditDialogOpen(true)
  }

  const handleSaved = (updated: ItpVue) => {
    setItps(prev => prev.map(itp => itp.id === updated.id ? updated : itp))
  }

  return (
    <div className="space-y-3">
      {/* Filtres */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="flex-1">
          <Input
            placeholder="Rechercher ITP ou espèce..."
            value={recherche}
            onChange={(e) => setRecherche(e.target.value)}
            className="w-full h-8 text-sm"
          />
        </div>
        <Select value={filtreTypePlanche} onValueChange={setFiltreTypePlanche}>
          <SelectTrigger className="w-full sm:w-40 h-8 text-sm">
            <Filter className="h-3 w-3 mr-1" />
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous types</SelectItem>
            {/* Ces options étaient écrites en dur : « Serre » et « Tunnel » ne
                correspondaient à AUCUNE ligne du référentiel (la frise se vidait),
                et « Sous abri », porté par 212 itinéraires, n'était pas proposé.
                On dérive la liste des conduites réellement présentes. */}
            {conduitesDisponibles.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Légende */}
      <div className="flex items-center gap-4 text-xs text-muted-foreground flex-wrap">
        <div className="flex items-center gap-1">
          <div className="w-4 h-3 bg-orange-400 rounded"></div>
          <span>Semis</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-3 bg-green-500 rounded"></div>
          <span>Croissance</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-4 h-3 bg-purple-500 rounded"></div>
          <span>Récolte</span>
        </div>
        {zoneLabel && horsReference && (
          <span className="inline-flex items-center gap-1 text-emerald-700">
            <MapPin className="h-3 w-3" />
            {zoneLabel} — calé sur vos saisons
          </span>
        )}
        {zoneLabel && !horsReference && decalageZone !== 0 && (
          <span className="inline-flex items-center gap-1 text-emerald-700">
            <MapPin className="h-3 w-3" />
            {zoneLabel} ({decalageZone > 0 ? "+" : "−"}{Math.abs(decalageZone)} sem.)
          </span>
        )}
        <span className="ml-auto text-muted-foreground">{itpsFiltres.length} itineraires</span>
      </div>

      {/* Tableau Gantt */}
      {isLoading ? (
        <Skeleton className="h-[300px] w-full" />
      ) : itpsFiltres.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {horsReference ? (
            <p className="text-sm max-w-sm mx-auto">
              Pas encore d&apos;itinéraire de référence pour votre zone ({zoneLabel}). Les
              calendriers métropolitains ne sont pas transposables — créez les vôtres, calés
              sur vos saisons locales.
            </p>
          ) : (
            <p>Aucun ITP trouvé</p>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {itpsFiltres.length > 150 && (
            <p className="text-xs text-muted-foreground">
              150 itinéraires affichés dans cette vue compacte sur {itpsFiltres.length}.
              Utilisez la recherche pour cibler une espèce.
            </p>
          )}
          <div className="overflow-x-auto rounded-lg border">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b">
                <th className="text-left p-2 bg-muted font-medium sticky left-0 z-10 min-w-[180px]">
                  ITP / Espèce
                </th>
                <th className="text-left p-2 bg-muted font-medium min-w-[90px]">Type</th>
                {MOIS_COURTS.map(m => (
                  <th key={m} className="text-center p-1 bg-muted font-medium text-xs w-[60px]">
                    {m}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {itpsFiltres.slice(0, 150).map(itp => (
                <GanttRow
                  key={itp.id}
                  itp={itp}
                  onEdit={handleEdit}
                  decalage={decalageItpPourLecteur(itp, zone as ZoneClimat | null, currentUserId)}
                />
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* Dialog d'édition */}
      <ItpEditDialog
        itp={editingItp}
        decalage={
          editingItp
            ? decalageItpPourLecteur(editingItp, zone as ZoneClimat | null, currentUserId)
            : 0
        }
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSaved={handleSaved}
      />
    </div>
  )
}
