"use client"

/**
 * Vue Calendrier Gantt des ITPs embarquable dans le dashboard
 * Reprend la logique de /itps/calendrier sans le layout page
 * Éditable : cliquer sur une ligne pour modifier les semaines
 */

import * as React from "react"
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

interface ITPWithEspece {
  id: string
  nom: string | null
  especeId: string | null
  espece?: {
    id: string
    nom: string | null
    couleur: string | null
  } | null
  semaineSemis: number | null
  semainePlantation: number | null
  semaineRecolte: number | null
  dureeRecolte: number | null
  typePlanche: string | null
  notes: string | null
}

const MOIS_COURTS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"]

export function ItpCalendarView() {
  const [itps, setItps] = React.useState<ITPWithEspece[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [filtreTypePlanche, setFiltreTypePlanche] = React.useState('all')
  const [recherche, setRecherche] = React.useState('')
  const [editingItp, setEditingItp] = React.useState<ITPWithEspece | null>(null)
  const [editDialogOpen, setEditDialogOpen] = React.useState(false)
  // Décalage climatique (zone de l'exploitation) appliqué aux barres.
  const [decalageZone, setDecalageZone] = React.useState(0)
  const [zoneLabel, setZoneLabel] = React.useState<string | null>(null)

  React.useEffect(() => {
    fetch("/api/calendrier-climat")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return
        setDecalageZone(d.decalage ?? 0)
        setZoneLabel(d.label ?? null)
      })
      .catch(() => {})
  }, [])

  React.useEffect(() => {
    async function fetchITPs() {
      setIsLoading(true)
      try {
        const response = await fetch('/api/itps?pageSize=500')
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
      if (filtreTypePlanche !== 'all' && itp.typePlanche !== filtreTypePlanche) {
        return false
      }
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
  }, [itps, filtreTypePlanche, recherche])

  const handleEdit = (itp: ITPWithEspece) => {
    setEditingItp(itp)
    setEditDialogOpen(true)
  }

  const handleSaved = (updated: ITPWithEspece) => {
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
            <SelectItem value="Serre">Serre</SelectItem>
            <SelectItem value="Plein champ">Plein champ</SelectItem>
            <SelectItem value="Tunnel">Tunnel</SelectItem>
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
        {zoneLabel && decalageZone !== 0 && (
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
          <p>Aucun ITP trouvé</p>
        </div>
      ) : (
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
              {itpsFiltres.map(itp => (
                <GanttRow key={itp.id} itp={itp} onEdit={handleEdit} decalage={decalageZone} />
              ))}
            </tbody>
          </table>
        </div>
      )}

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
