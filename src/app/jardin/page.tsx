"use client"

/**
 * Page Plan du jardin - Visualisation 2D avec éditeur
 */

import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Map as MapIcon, Save, RotateCcw, ZoomIn, ZoomOut } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { GardenView } from "@/components/garden/GardenView"
import { useToast } from "@/hooks/use-toast"

interface PlancheWithCulture {
  id: string
  largeur: number | null
  longueur: number | null
  posX: number | null
  posY: number | null
  rotation2D: number | null
  ilot: string | null
  cultures: {
    id: number
    espece: {
      id: string
      couleur: string | null
      famille: { couleur: string | null } | null
    }
  }[]
}

export default function JardinPage() {
  const { toast } = useToast()
  const [planches, setPlanches] = React.useState<PlancheWithCulture[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [editMode, setEditMode] = React.useState(false)
  const [scale, setScale] = React.useState(50)
  const [hasChanges, setHasChanges] = React.useState(false)
  const [saving, setSaving] = React.useState(false)

  // Charger les planches
  const fetchPlanches = React.useCallback(async () => {
    try {
      const response = await fetch("/api/jardin")
      if (!response.ok) throw new Error("Erreur chargement")
      const data = await response.json()
      setPlanches(data)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger le plan du jardin"
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  React.useEffect(() => {
    fetchPlanches()
  }, [fetchPlanches])

  // Déplacer une planche
  const handlePlancheMove = (id: string, x: number, y: number) => {
    setPlanches(prev => prev.map(p =>
      p.id === id ? { ...p, posX: x, posY: y } : p
    ))
    setHasChanges(true)
  }

  // Sauvegarder les positions
  const handleSave = async () => {
    setSaving(true)
    try {
      // Sauvegarder chaque planche modifiée
      const promises = planches.map(p =>
        fetch(`/api/planches/${encodeURIComponent(p.id)}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            posX: p.posX,
            posY: p.posY,
            rotation2D: p.rotation2D
          })
        })
      )

      await Promise.all(promises)

      toast({
        title: "Plan sauvegardé",
        description: "Les positions des planches ont été enregistrées"
      })
      setHasChanges(false)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de sauvegarder le plan"
      })
    } finally {
      setSaving(false)
    }
  }

  // Réinitialiser les positions (grille automatique)
  const handleReset = () => {
    const cols = Math.ceil(Math.sqrt(planches.length))
    setPlanches(prev => prev.map((p, i) => ({
      ...p,
      posX: (i % cols) * 2,
      posY: Math.floor(i / cols) * 3
    })))
    setHasChanges(true)
  }

  // Légende des couleurs
  const legendItems = React.useMemo(() => {
    const items = new Map<string, { color: string; name: string }>()
    planches.forEach(p => {
      if (p.cultures[0]) {
        const espece = p.cultures[0].espece
        const color = espece.couleur || espece.famille?.couleur || "#22c55e"
        items.set(espece.id, { color, name: espece.id })
      }
    })
    return Array.from(items.values())
  }, [planches])

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Accueil
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <MapIcon className="h-6 w-6 text-green-600" />
              <h1 className="text-xl font-bold">Plan du jardin</h1>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Zoom */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setScale(s => Math.max(20, s - 10))}
              >
                <ZoomOut className="h-4 w-4" />
              </Button>
              <span className="text-sm w-12 text-center">{scale}px/m</span>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setScale(s => Math.min(100, s + 10))}
              >
                <ZoomIn className="h-4 w-4" />
              </Button>
            </div>

            {/* Mode édition */}
            <div className="flex items-center gap-2">
              <Switch
                id="edit-mode"
                checked={editMode}
                onCheckedChange={setEditMode}
              />
              <Label htmlFor="edit-mode">Éditer</Label>
            </div>

            {editMode && (
              <>
                <Button variant="outline" size="sm" onClick={handleReset}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Réorganiser
                </Button>
                <Button
                  size="sm"
                  onClick={handleSave}
                  disabled={!hasChanges || saving}
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? "Sauvegarde..." : "Sauvegarder"}
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid gap-6 lg:grid-cols-[1fr_250px]">
          {/* Plan */}
          <Card>
            <CardHeader>
              <CardTitle>
                Vue du jardin
                {planches.length > 0 && (
                  <span className="text-sm font-normal text-muted-foreground ml-2">
                    ({planches.length} planches)
                  </span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="h-96 flex items-center justify-center text-muted-foreground">
                  Chargement...
                </div>
              ) : planches.length === 0 ? (
                <div className="h-96 flex flex-col items-center justify-center text-muted-foreground">
                  <MapIcon className="h-12 w-12 mb-4 opacity-50" />
                  <p>Aucune planche configurée</p>
                  <Link href="/planches/new">
                    <Button variant="link">Créer une planche</Button>
                  </Link>
                </div>
              ) : (
                <GardenView
                  planches={planches}
                  editable={editMode}
                  onPlancheMove={handlePlancheMove}
                  scale={scale}
                />
              )}
            </CardContent>
          </Card>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* Légende */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Cultures en cours</CardTitle>
              </CardHeader>
              <CardContent>
                {legendItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Aucune culture active
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {legendItems.map(item => (
                      <li key={item.name} className="flex items-center gap-2 text-sm">
                        <div
                          className="w-4 h-4 rounded"
                          style={{ backgroundColor: item.color }}
                        />
                        {item.name}
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {/* Instructions */}
            {editMode && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm">Mode édition</CardTitle>
                </CardHeader>
                <CardContent className="text-sm text-muted-foreground space-y-2">
                  <p>• Glissez les planches pour les positionner</p>
                  <p>• La grille est de 0.5m</p>
                  <p>• Cliquez "Sauvegarder" pour enregistrer</p>
                  <p>• "Réorganiser" place les planches en grille</p>
                </CardContent>
              </Card>
            )}

            {/* Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Statistiques</CardTitle>
              </CardHeader>
              <CardContent className="text-sm space-y-1">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Planches</span>
                  <span className="font-medium">{planches.length}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Cultivées</span>
                  <span className="font-medium">
                    {planches.filter(p => p.cultures.length > 0).length}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Surface totale</span>
                  <span className="font-medium">
                    {planches
                      .reduce((sum, p) => sum + (p.largeur || 0) * (p.longueur || 0), 0)
                      .toFixed(1)} m²
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  )
}
