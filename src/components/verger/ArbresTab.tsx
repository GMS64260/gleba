"use client"

/**
 * Onglet Arbres - Liste des arbres avec filtres par type et dialog d'ajout
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import { ColumnDef } from "@tanstack/react-table"
import { TreeDeciduous, Leaf, Cherry, Fence, Flower2, Shrub } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DataTable } from "@/components/tables/DataTable"
import { Combobox } from "@/components/ui/combobox"
import { useToast } from "@/hooks/use-toast"

const TYPES_ARBRES = [
  { value: "all", label: "Tous", icon: TreeDeciduous },
  { value: "fruitier", label: "Fruitiers", icon: Cherry },
  { value: "petit_fruit", label: "Petits fruits", icon: Shrub },
  { value: "forestier", label: "Forestiers", icon: Leaf },
  { value: "ornement", label: "Ornementaux", icon: Flower2 },
  { value: "haie", label: "Haies", icon: Fence },
] as const

const TYPES_ARBRES_FORM = [
  { value: "fruitier", label: "Fruitier" },
  { value: "petit_fruit", label: "Petit fruit" },
  { value: "forestier", label: "Forestier" },
  { value: "ornement", label: "Ornemental" },
  { value: "haie", label: "Haie" },
]

const ETATS_ARBRE = [
  { value: "excellent", label: "Excellent" },
  { value: "bon", label: "Bon" },
  { value: "moyen", label: "Moyen" },
  { value: "mauvais", label: "Mauvais" },
]

const TYPE_LABELS: Record<string, string> = {
  fruitier: "Fruitier",
  petit_fruit: "Petit fruit",
  forestier: "Forestier",
  ornement: "Ornemental",
  haie: "Haie",
}

const etatColors: Record<string, string> = {
  excellent: "bg-green-100 text-green-700",
  bon: "bg-lime-100 text-lime-700",
  moyen: "bg-yellow-100 text-yellow-700",
  mauvais: "bg-red-100 text-red-700",
}

interface Arbre {
  id: number
  nom: string
  type: string
  espece: string | null
  variete: string | null
  datePlantation: string | null
  etat: string | null
  productif: boolean
  fournisseur?: string | null
}

const columns: ColumnDef<Arbre>[] = [
  {
    accessorKey: "nom",
    header: "Nom",
    cell: ({ getValue }) => <span className="font-medium">{getValue() as string}</span>,
  },
  {
    accessorKey: "type",
    header: "Type",
    cell: ({ getValue }) => {
      const type = getValue() as string
      return (
        <Badge variant="outline" className="text-xs">
          {TYPE_LABELS[type] || type}
        </Badge>
      )
    },
  },
  {
    accessorKey: "espece",
    header: "Espece",
    cell: ({ getValue }) => getValue() || "-",
  },
  {
    accessorKey: "variete",
    header: "Variete",
    cell: ({ getValue }) => getValue() || "-",
  },
  {
    accessorKey: "datePlantation",
    header: "Plantation",
    cell: ({ getValue }) => {
      const date = getValue() as string | null
      return date ? new Date(date).toLocaleDateString("fr-FR") : "-"
    },
  },
  {
    accessorKey: "etat",
    header: "Etat",
    cell: ({ getValue }) => {
      const etat = getValue() as string | null
      if (!etat) return "-"
      return (
        <Badge variant="outline" className={etatColors[etat] || ""}>
          {etat}
        </Badge>
      )
    },
  },
  {
    accessorKey: "productif",
    header: "Productif",
    cell: ({ getValue }) => (getValue() ? "Oui" : "Non"),
  },
]

export function ArbresTab() {
  const router = useRouter()
  const { toast } = useToast()
  const [data, setData] = React.useState<Arbre[]>([])
  const [filteredData, setFilteredData] = React.useState<Arbre[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [selectedType, setSelectedType] = React.useState("all")
  const [showDialog, setShowDialog] = React.useState(false)
  const [newArbre, setNewArbre] = React.useState({
    nom: "",
    type: "fruitier",
    espece: "",
    variete: "",
    fournisseur: "",
    dateAchat: "",
    prixAchat: "",
    datePlantation: "",
    etat: "bon",
  })

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch("/api/arbres")
      if (!response.ok) throw new Error("Erreur")
      const items = await response.json()
      setData(items)
      setFilteredData(items)
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les arbres" })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  React.useEffect(() => {
    if (selectedType === "all") {
      setFilteredData(data)
    } else {
      setFilteredData(data.filter((a) => a.type === selectedType))
    }
  }, [selectedType, data])

  const especeOptions = React.useMemo(() => {
    const unique = [...new Set(data.map(a => a.espece).filter(Boolean))] as string[]
    return unique.sort().map(v => ({ value: v, label: v }))
  }, [data])

  const varieteOptions = React.useMemo(() => {
    const unique = [...new Set(data.map(a => a.variete).filter(Boolean))] as string[]
    return unique.sort().map(v => ({ value: v, label: v }))
  }, [data])

  const fournisseurOptions = React.useMemo(() => {
    const unique = [...new Set(data.map((a: any) => a.fournisseur).filter(Boolean))] as string[]
    return unique.sort().map(v => ({ value: v, label: v }))
  }, [data])

  const resetForm = () => {
    setNewArbre({
      nom: "",
      type: "fruitier",
      espece: "",
      variete: "",
      fournisseur: "",
      dateAchat: "",
      prixAchat: "",
      datePlantation: "",
      etat: "bon",
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newArbre.nom.trim()) {
      toast({ title: "Le nom est requis", variant: "destructive" })
      return
    }

    try {
      const res = await fetch("/api/arbres", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nom: newArbre.nom,
          type: newArbre.type,
          espece: newArbre.espece || null,
          variete: newArbre.variete || null,
          fournisseur: newArbre.fournisseur || null,
          dateAchat: newArbre.dateAchat || null,
          prixAchat: newArbre.prixAchat || null,
          datePlantation: newArbre.datePlantation || null,
          etat: newArbre.etat,
        }),
      })

      if (res.ok) {
        setShowDialog(false)
        resetForm()
        toast({ title: "Arbre ajoute" })
        fetchData()
      } else {
        const error = await res.json()
        toast({ title: "Erreur", description: error.error, variant: "destructive" })
      }
    } catch {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-4">
      <Tabs value={selectedType} onValueChange={setSelectedType}>
        <TabsList className="flex-wrap h-auto gap-1">
          {TYPES_ARBRES.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="flex items-center gap-1">
              <Icon className="h-4 w-4" />
              <span className="hidden sm:inline">{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      <DataTable
        columns={columns}
        data={filteredData}
        isLoading={isLoading}
        showPagination={true}
        pageSize={50}
        onAdd={() => setShowDialog(true)}
        onRefresh={fetchData}
        onRowClick={(row) => router.push(`/arbres/${row.id}`)}
        onRowEdit={(row) => router.push(`/arbres/${row.id}`)}
        onRowDelete={async (row) => {
          if (!confirm(`Supprimer l'arbre "${row.nom}" ?`)) return
          try {
            await fetch(`/api/arbres/${row.id}`, { method: "DELETE" })
            toast({ title: "Arbre supprime" })
            fetchData()
          } catch {
            toast({ variant: "destructive", title: "Erreur" })
          }
        }}
        searchPlaceholder="Rechercher un arbre..."
        emptyMessage="Aucun arbre trouve."
      />

      {/* Dialog nouvel arbre */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un arbre</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Nom *</Label>
              <Input
                value={newArbre.nom}
                onChange={(e) => setNewArbre({ ...newArbre, nom: e.target.value })}
                placeholder="Ex: Pommier du verger nord"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Type *</Label>
                <Select
                  value={newArbre.type}
                  onValueChange={(v) => setNewArbre({ ...newArbre, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES_ARBRES_FORM.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Etat</Label>
                <Select
                  value={newArbre.etat}
                  onValueChange={(v) => setNewArbre({ ...newArbre, etat: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ETATS_ARBRE.map((e) => (
                      <SelectItem key={e.value} value={e.value}>
                        {e.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Espece</Label>
                <Combobox
                  value={newArbre.espece}
                  onValueChange={(v) => setNewArbre({ ...newArbre, espece: v })}
                  options={especeOptions}
                  placeholder="Ex: Pommier, Chene..."
                />
              </div>
              <div>
                <Label>Variete</Label>
                <Combobox
                  value={newArbre.variete}
                  onValueChange={(v) => setNewArbre({ ...newArbre, variete: v })}
                  options={varieteOptions}
                  placeholder="Ex: Golden, Sessile..."
                />
              </div>
            </div>
            <div>
              <Label>Fournisseur / Pepiniere</Label>
              <Combobox
                value={newArbre.fournisseur}
                onValueChange={(v) => setNewArbre({ ...newArbre, fournisseur: v })}
                options={fournisseurOptions}
                placeholder="Ex: Pepiniere du Morvan"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date d'achat</Label>
                <Input
                  type="date"
                  value={newArbre.dateAchat}
                  onChange={(e) => setNewArbre({ ...newArbre, dateAchat: e.target.value })}
                />
              </div>
              <div>
                <Label>Prix d'achat (EUR)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={newArbre.prixAchat}
                  onChange={(e) => setNewArbre({ ...newArbre, prixAchat: e.target.value })}
                  placeholder="0.00"
                />
              </div>
            </div>
            <div>
              <Label>Date de plantation</Label>
              <Input
                type="date"
                value={newArbre.datePlantation}
                onChange={(e) => setNewArbre({ ...newArbre, datePlantation: e.target.value })}
              />
            </div>
            <Button type="submit" className="w-full">
              Ajouter l'arbre
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
