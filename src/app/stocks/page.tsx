"use client"

/**
 * Page de gestion des stocks
 * Semences, Plants, Fertilisants, Recoltes
 */

import * as React from "react"
import Link from "next/link"
import {
  ArrowLeft,
  Package,
  Sprout,
  Leaf,
  Apple,
  Save,
  RefreshCw,
  Search
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/hooks/use-toast"

interface VarieteStock {
  id: string
  especeId: string
  stockGraines: number | null
  stockPlants: number | null
  dateStock: string | null
  nbGrainesG: number | null
  fournisseurId: string | null
}

interface FertilisantStock {
  id: string
  type: string | null
  stock: number | null
  dateStock: string | null
  prix: number | null
}

interface EspeceStock {
  id: string
  familleId: string | null
  inventaire: number | null
  dateInventaire: string | null
  couleur: string | null
}

interface StockData {
  graines: VarieteStock[]
  plants: VarieteStock[]
  fertilisants: FertilisantStock[]
  recoltes: EspeceStock[]
}

// Composant pour editer un stock inline
function StockInput({
  value,
  onChange,
  onSave,
  unit = "",
  isInteger = false,
}: {
  value: number | null
  onChange: (val: number | null) => void
  onSave: () => void
  unit?: string
  isInteger?: boolean
}) {
  const [editing, setEditing] = React.useState(false)
  const [localValue, setLocalValue] = React.useState(value?.toString() || "")
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    setLocalValue(value?.toString() || "")
  }, [value])

  const handleBlur = () => {
    setEditing(false)
    const numVal = isInteger
      ? parseInt(localValue) || null
      : parseFloat(localValue) || null
    if (numVal !== value) {
      onChange(numVal)
      onSave()
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      inputRef.current?.blur()
    }
    if (e.key === "Escape") {
      setLocalValue(value?.toString() || "")
      setEditing(false)
    }
  }

  if (editing) {
    return (
      <Input
        ref={inputRef}
        type="number"
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className="w-24 h-8"
        step={isInteger ? 1 : 0.1}
        autoFocus
      />
    )
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="px-2 py-1 rounded hover:bg-gray-100 min-w-[60px] text-left"
    >
      {value !== null ? `${value} ${unit}` : "-"}
    </button>
  )
}

export default function StocksPage() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = React.useState(true)
  const [isSaving, setIsSaving] = React.useState(false)
  const [data, setData] = React.useState<StockData>({
    graines: [],
    plants: [],
    fertilisants: [],
    recoltes: [],
  })
  const [search, setSearch] = React.useState("")
  const [pendingChanges, setPendingChanges] = React.useState<Map<string, any>>(new Map())

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/stocks")
      if (!response.ok) throw new Error("Erreur chargement")
      const result = await response.json()
      setData(result)
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de charger les stocks",
      })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const saveStock = async (type: string, id: string, stock: number | null) => {
    setIsSaving(true)
    try {
      const response = await fetch("/api/stocks", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id, stock }),
      })
      if (!response.ok) throw new Error("Erreur sauvegarde")
      toast({
        title: "Stock mis a jour",
        description: `Le stock a ete enregistre`,
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de sauvegarder le stock",
      })
    } finally {
      setIsSaving(false)
    }
  }

  const updateLocalStock = (
    type: "graines" | "plants" | "fertilisants" | "recoltes",
    id: string,
    field: string,
    value: number | null
  ) => {
    setData(prev => {
      const newData = { ...prev }
      if (type === "graines" || type === "plants") {
        const idx = newData.graines.findIndex(v => v.id === id)
        if (idx >= 0) {
          newData.graines = [...newData.graines]
          newData.graines[idx] = { ...newData.graines[idx], [field]: value }
        }
        // Aussi mettre a jour dans plants si applicable
        const idxPlants = newData.plants.findIndex(v => v.id === id)
        if (idxPlants >= 0) {
          newData.plants = [...newData.plants]
          newData.plants[idxPlants] = { ...newData.plants[idxPlants], [field]: value }
        }
      } else if (type === "fertilisants") {
        const idx = newData.fertilisants.findIndex(f => f.id === id)
        if (idx >= 0) {
          newData.fertilisants = [...newData.fertilisants]
          newData.fertilisants[idx] = { ...newData.fertilisants[idx], [field]: value }
        }
      } else if (type === "recoltes") {
        const idx = newData.recoltes.findIndex(e => e.id === id)
        if (idx >= 0) {
          newData.recoltes = [...newData.recoltes]
          newData.recoltes[idx] = { ...newData.recoltes[idx], [field]: value }
        }
      }
      return newData
    })
  }

  // Filtrer par recherche
  const filterBySearch = <T extends { id: string; especeId?: string }>(items: T[]) => {
    if (!search) return items
    const s = search.toLowerCase()
    return items.filter(item =>
      item.id.toLowerCase().includes(s) ||
      (item.especeId && item.especeId.toLowerCase().includes(s))
    )
  }

  const filterFertilisants = (items: FertilisantStock[]) => {
    if (!search) return items
    const s = search.toLowerCase()
    return items.filter(item =>
      item.id.toLowerCase().includes(s) ||
      (item.type && item.type.toLowerCase().includes(s))
    )
  }

  const filterRecoltes = (items: EspeceStock[]) => {
    if (!search) return items
    const s = search.toLowerCase()
    return items.filter(item =>
      item.id.toLowerCase().includes(s) ||
      (item.familleId && item.familleId.toLowerCase().includes(s))
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="border-b bg-white sticky top-0 z-50">
          <div className="container mx-auto px-4 py-4">
            <Skeleton className="h-8 w-64" />
          </div>
        </header>
        <main className="container mx-auto px-4 py-6">
          <Skeleton className="h-96 w-full" />
        </main>
      </div>
    )
  }

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
              <Package className="h-6 w-6 text-purple-600" />
              <h1 className="text-xl font-bold">Gestion des stocks</h1>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Rechercher..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 w-[200px]"
              />
            </div>
            <Button variant="outline" size="sm" onClick={fetchData}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Actualiser
            </Button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="container mx-auto px-4 py-6">
        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4 mb-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Sprout className="h-4 w-4 text-orange-600" />
                Semences
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{data.graines.length}</p>
              <p className="text-sm text-muted-foreground">varietes en stock</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Leaf className="h-4 w-4 text-green-600" />
                Plants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{data.plants.length}</p>
              <p className="text-sm text-muted-foreground">varietes en stock</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Package className="h-4 w-4 text-amber-600" />
                Fertilisants
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{data.fertilisants.length}</p>
              <p className="text-sm text-muted-foreground">produits</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground flex items-center gap-2">
                <Apple className="h-4 w-4 text-red-600" />
                Recoltes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{data.recoltes.length}</p>
              <p className="text-sm text-muted-foreground">especes en stock</p>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="graines" className="space-y-4">
          <TabsList>
            <TabsTrigger value="graines" className="flex items-center gap-2">
              <Sprout className="h-4 w-4" />
              Semences ({data.graines.length})
            </TabsTrigger>
            <TabsTrigger value="plants" className="flex items-center gap-2">
              <Leaf className="h-4 w-4" />
              Plants ({data.plants.length})
            </TabsTrigger>
            <TabsTrigger value="fertilisants" className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Fertilisants ({data.fertilisants.length})
            </TabsTrigger>
            <TabsTrigger value="recoltes" className="flex items-center gap-2">
              <Apple className="h-4 w-4" />
              Recoltes ({data.recoltes.length})
            </TabsTrigger>
          </TabsList>

          {/* Semences */}
          <TabsContent value="graines">
            <Card>
              <CardHeader>
                <CardTitle>Stock de semences</CardTitle>
                <CardDescription>
                  Cliquez sur une valeur pour la modifier. Les modifications sont sauvegardees automatiquement.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Variete</TableHead>
                      <TableHead>Espece</TableHead>
                      <TableHead>Graines/g</TableHead>
                      <TableHead>Stock (g)</TableHead>
                      <TableHead>Fournisseur</TableHead>
                      <TableHead>Date MAJ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filterBySearch(data.graines).map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">{v.id}</TableCell>
                        <TableCell>{v.especeId}</TableCell>
                        <TableCell>{v.nbGrainesG || "-"}</TableCell>
                        <TableCell>
                          <StockInput
                            value={v.stockGraines}
                            onChange={(val) => updateLocalStock("graines", v.id, "stockGraines", val)}
                            onSave={() => saveStock("graines", v.id, v.stockGraines)}
                            unit="g"
                          />
                        </TableCell>
                        <TableCell>{v.fournisseurId || "-"}</TableCell>
                        <TableCell>
                          {v.dateStock
                            ? new Date(v.dateStock).toLocaleDateString("fr-FR")
                            : "-"
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                    {filterBySearch(data.graines).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                          Aucune semence en stock
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Plants */}
          <TabsContent value="plants">
            <Card>
              <CardHeader>
                <CardTitle>Stock de plants</CardTitle>
                <CardDescription>
                  Cliquez sur une valeur pour la modifier. Les modifications sont sauvegardees automatiquement.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Variete</TableHead>
                      <TableHead>Espece</TableHead>
                      <TableHead>Stock (plants)</TableHead>
                      <TableHead>Fournisseur</TableHead>
                      <TableHead>Date MAJ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filterBySearch(data.plants).map((v) => (
                      <TableRow key={v.id}>
                        <TableCell className="font-medium">{v.id}</TableCell>
                        <TableCell>{v.especeId}</TableCell>
                        <TableCell>
                          <StockInput
                            value={v.stockPlants}
                            onChange={(val) => updateLocalStock("plants", v.id, "stockPlants", val)}
                            onSave={() => saveStock("plants", v.id, v.stockPlants)}
                            isInteger
                          />
                        </TableCell>
                        <TableCell>{v.fournisseurId || "-"}</TableCell>
                        <TableCell>
                          {v.dateStock
                            ? new Date(v.dateStock).toLocaleDateString("fr-FR")
                            : "-"
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                    {filterBySearch(data.plants).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Aucun plant en stock
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Fertilisants */}
          <TabsContent value="fertilisants">
            <Card>
              <CardHeader>
                <CardTitle>Stock de fertilisants</CardTitle>
                <CardDescription>
                  Cliquez sur une valeur pour la modifier. Les modifications sont sauvegardees automatiquement.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fertilisant</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Stock (kg/L)</TableHead>
                      <TableHead>Prix (euro/kg)</TableHead>
                      <TableHead>Date MAJ</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filterFertilisants(data.fertilisants).map((f) => (
                      <TableRow key={f.id}>
                        <TableCell className="font-medium">{f.id}</TableCell>
                        <TableCell>{f.type || "-"}</TableCell>
                        <TableCell>
                          <StockInput
                            value={f.stock}
                            onChange={(val) => updateLocalStock("fertilisants", f.id, "stock", val)}
                            onSave={() => saveStock("fertilisant", f.id, f.stock)}
                            unit="kg"
                          />
                        </TableCell>
                        <TableCell>{f.prix ? `${f.prix} euro` : "-"}</TableCell>
                        <TableCell>
                          {f.dateStock
                            ? new Date(f.dateStock).toLocaleDateString("fr-FR")
                            : "-"
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                    {filterFertilisants(data.fertilisants).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          Aucun fertilisant enregistre
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Recoltes */}
          <TabsContent value="recoltes">
            <Card>
              <CardHeader>
                <CardTitle>Inventaire des recoltes</CardTitle>
                <CardDescription>
                  Stock de recoltes en conservation. Cliquez sur une valeur pour la modifier.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Espece</TableHead>
                      <TableHead>Famille</TableHead>
                      <TableHead>Stock (kg)</TableHead>
                      <TableHead>Date inventaire</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filterRecoltes(data.recoltes).map((e) => (
                      <TableRow key={e.id}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            {e.couleur && (
                              <div
                                className="w-3 h-3 rounded-full"
                                style={{ backgroundColor: e.couleur }}
                              />
                            )}
                            {e.id}
                          </div>
                        </TableCell>
                        <TableCell>{e.familleId || "-"}</TableCell>
                        <TableCell>
                          <StockInput
                            value={e.inventaire}
                            onChange={(val) => updateLocalStock("recoltes", e.id, "inventaire", val)}
                            onSave={() => saveStock("recolte", e.id, e.inventaire)}
                            unit="kg"
                          />
                        </TableCell>
                        <TableCell>
                          {e.dateInventaire
                            ? new Date(e.dateInventaire).toLocaleDateString("fr-FR")
                            : "-"
                          }
                        </TableCell>
                      </TableRow>
                    ))}
                    {filterRecoltes(data.recoltes).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                          Aucune recolte en stock
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}
