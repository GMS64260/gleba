"use client"

/**
 * Page Météo dédiée — chantier UX 2026-07, palier 3.
 *
 * La météo n'existait qu'en widgets dispersés (header, onglets) ; cette page
 * regroupe conditions/prévisions (MeteoWidget) et conseil d'irrigation
 * (IrrigationAdvisor) pour la parcelle choisie. Accessible depuis le popover
 * météo du header sur toutes les pages.
 */

import * as React from "react"
import Link from "next/link"
import { CloudSun, MapPin, Settings } from "lucide-react"
import { AppHeader, PageToolbar } from "@/components/shell/AppHeader"
import { MeteoWidget } from "@/components/meteo/MeteoWidget"
import { IrrigationAdvisor } from "@/components/meteo/IrrigationAdvisor"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"

interface ParcelleMeteo {
  id: string
  nom: string
  centroidLat: number
  centroidLng: number
}

export default function MeteoPage() {
  const [parcelles, setParcelles] = React.useState<ParcelleMeteo[]>([])
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function load() {
      try {
        const res = await fetch("/api/carte")
        if (!res.ok) return
        const data = await res.json()
        const avecCoords = (data as Array<{ id: string; nom: string; centroidLat: number | null; centroidLng: number | null }>)
          .filter((p) => p.centroidLat && p.centroidLng)
          .map((p) => ({ id: p.id, nom: p.nom, centroidLat: p.centroidLat as number, centroidLng: p.centroidLng as number }))
        setParcelles(avecCoords)
        if (avecCoords.length > 0) setSelectedId(avecCoords[0].id)
      } catch {
        // silencieux — l'état vide guide l'utilisateur
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const parcelle = parcelles.find((p) => p.id === selectedId) ?? null

  return (
    <div className="min-h-screen bg-slate-50 aurora-bg-subtle">
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" aria-hidden="true" />
      <AppHeader />
      <PageToolbar>
        <div className="flex items-center gap-2">
          <CloudSun className="h-6 w-6 text-sky-600" />
          <h1 className="text-xl font-bold">Météo</h1>
        </div>
        <div className="flex items-center gap-2">
          {parcelles.length > 1 && selectedId && (
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="w-[190px] h-8">
                <MapPin className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {parcelles.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.nom}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Link href="/parametres">
            <Button variant="outline" size="sm">
              <Settings className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Station</span>
            </Button>
          </Link>
        </div>
      </PageToolbar>

      <main className="container mx-auto px-4 py-6 max-w-[1600px]">
        {loading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-96 w-full" />
            <Skeleton className="h-96 w-full" />
          </div>
        ) : !parcelle ? (
          <Card>
            <CardContent className="py-10 text-center space-y-3">
              <CloudSun className="h-10 w-10 text-slate-300 mx-auto" />
              <p className="text-sm text-slate-600">
                Aucune parcelle géolocalisée : la météo a besoin d&apos;un point de référence.
              </p>
              <Link href="/parcelles">
                <Button variant="outline" size="sm" className="mt-1">
                  <MapPin className="h-4 w-4 mr-1" />
                  Définir mes parcelles
                </Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2 items-start">
            <MeteoWidget lat={parcelle.centroidLat} lng={parcelle.centroidLng} />
            <IrrigationAdvisor lat={parcelle.centroidLat} lng={parcelle.centroidLng} />
          </div>
        )}
      </main>
    </div>
  )
}
