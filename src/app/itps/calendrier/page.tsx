"use client"

/**
 * Page Calendrier Gantt des ITPs
 * Vue annuelle type potaleger avec barres colorées par phase
 * Éditable : cliquer sur une ligne pour modifier les semaines
 */

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Filter, Download } from "lucide-react"

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
import { Skeleton } from "@/components/ui/skeleton"
import { GanttRow } from "@/components/itps/GanttRow"
import { ItpEditDialog } from "@/components/itps/ItpEditDialog"

interface ITPWithEspece {
  id: string
  especeId: string | null
  espece?: {
    id: string
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

export default function ITCalendrierPage() {
  const [itps, setItps] = React.useState<ITPWithEspece[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [filtreTypePlanche, setFiltreTypePlanche] = React.useState('all')
  const [recherche, setRecherche] = React.useState('')
  const [editingItp, setEditingItp] = React.useState<ITPWithEspece | null>(null)
  const [editDialogOpen, setEditDialogOpen] = React.useState(false)

  // Charger les ITPs
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

  // Filtrer les ITPs
  const itpsFiltres = React.useMemo(() => {
    return itps.filter(itp => {
      // Filtre type planche
      if (filtreTypePlanche !== 'all' && itp.typePlanche !== filtreTypePlanche) {
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
  }, [itps, filtreTypePlanche, recherche])

  const handleEdit = (itp: ITPWithEspece) => {
    setEditingItp(itp)
    setEditDialogOpen(true)
  }

  const handleSaved = (updated: ITPWithEspece) => {
    setItps(prev => prev.map(itp => itp.id === updated.id ? updated : itp))
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/itps">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                ITPs
              </Button>
            </Link>
            <div>
              <h1 className="text-xl font-bold">Calendrier des ITPs</h1>
              <p className="text-sm text-muted-foreground">
                Timeline annuelle - Cliquez sur une ligne pour modifier
              </p>
            </div>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-6">
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
                <SelectTrigger className="w-full md:w-48">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Type planche" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous types</SelectItem>
                  <SelectItem value="Serre">Serre</SelectItem>
                  <SelectItem value="Plein champ">Plein champ</SelectItem>
                  <SelectItem value="Tunnel">Tunnel</SelectItem>
                </SelectContent>
              </Select>
            </div>

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
              <CardTitle>{itpsFiltres.length} itinéraires</CardTitle>
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
                      {MOIS_COURTS.map(m => (
                        <th key={m} className="text-center p-1 bg-muted font-medium text-xs w-[60px]">
                          {m}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {itpsFiltres.map(itp => (
                      <GanttRow key={itp.id} itp={itp} onEdit={handleEdit} />
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
              <strong>Comment lire ce calendrier :</strong>
              {' '}Les barres colorées montrent les périodes de semis (orange), croissance (vert) et récolte (violet) pour chaque ITP.
              Cliquez sur une ligne pour modifier les semaines directement.
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
