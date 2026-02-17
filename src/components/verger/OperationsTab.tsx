"use client"

/**
 * Onglet Operations - Liste des operations avec filtres et dialog d'ajout
 */

import * as React from "react"
import { ColumnDef } from "@tanstack/react-table"
import { Wrench, ListTodo, Check, CheckCircle } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { DataTable } from "@/components/tables/DataTable"
import { useToast } from "@/hooks/use-toast"

const FILTER_STATES = [
  { value: "all", label: "Toutes", icon: Wrench },
  { value: "afaire", label: "A faire", icon: ListTodo },
  { value: "fait", label: "Realisees", icon: CheckCircle },
] as const

const TYPES_OPERATIONS = [
  { value: "taille", label: "Taille" },
  { value: "greffe", label: "Greffe" },
  { value: "traitement", label: "Traitement" },
  { value: "fertilisation", label: "Fertilisation" },
  { value: "autre", label: "Autre" },
]

interface Arbre {
  id: number
  nom: string
  type: string
}

interface OperationArbre {
  id: number
  arbreId: number
  date: string
  type: string
  description: string | null
  produit: string | null
  quantite: number | null
  unite: string | null
  cout: number | null
  datePrevue: string | null
  fait: boolean
  notes: string | null
  arbre: Arbre
}

function createColumns(
  onToggleFait: (op: OperationArbre) => void
): ColumnDef<OperationArbre>[] {
  return [
    {
      id: "fait_toggle",
      header: "Fait",
      cell: ({ row }) => {
        const op = row.original
        return (
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation()
              onToggleFait(op)
            }}
          >
            {op.fait ? (
              <Check className="h-4 w-4 text-green-600" />
            ) : (
              <div className="h-4 w-4 border-2 rounded" />
            )}
          </Button>
        )
      },
    },
    {
      accessorKey: "date",
      header: "Date",
      cell: ({ getValue }) => new Date(getValue() as string).toLocaleDateString("fr-FR"),
    },
    {
      accessorKey: "arbre.nom",
      header: "Arbre",
      cell: ({ row }) => <span className="font-medium">{row.original.arbre.nom}</span>,
    },
    {
      accessorKey: "type",
      header: "Type",
      cell: ({ getValue }) => (
        <Badge variant="outline" className="text-xs capitalize">
          {getValue() as string}
        </Badge>
      ),
    },
    {
      accessorKey: "description",
      header: "Description",
      cell: ({ getValue }) => getValue() || "-",
    },
    {
      accessorKey: "produit",
      header: "Produit",
      cell: ({ getValue }) => getValue() || "-",
    },
    {
      id: "quantiteUnite",
      header: "Qte",
      cell: ({ row }) => {
        const op = row.original
        if (!op.quantite) return "-"
        return `${op.quantite}${op.unite ? ` ${op.unite}` : ""}`
      },
    },
    {
      accessorKey: "cout",
      header: "Cout",
      cell: ({ getValue }) => {
        const val = getValue() as number | null
        return val ? `${val} EUR` : "-"
      },
    },
  ]
}

export function OperationsTab() {
  const { toast } = useToast()
  const [data, setData] = React.useState<OperationArbre[]>([])
  const [arbres, setArbres] = React.useState<Arbre[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [filterFait, setFilterFait] = React.useState("all")
  const [showDialog, setShowDialog] = React.useState(false)
  const [newOperation, setNewOperation] = React.useState({
    arbreId: "",
    date: new Date().toISOString().split("T")[0],
    type: "taille",
    description: "",
    produit: "",
    quantite: "",
    unite: "",
    cout: "",
    datePrevue: "",
    fait: true,
    notes: "",
  })

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    try {
      const [opsRes, arbresRes] = await Promise.all([
        fetch("/api/arbres/operations"),
        fetch("/api/arbres"),
      ])
      if (opsRes.ok) setData(await opsRes.json())
      if (arbresRes.ok) setArbres(await arbresRes.json())
    } catch {
      toast({ variant: "destructive", title: "Erreur", description: "Impossible de charger les operations" })
    } finally {
      setIsLoading(false)
    }
  }, [toast])

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const filteredData = React.useMemo(() => {
    if (filterFait === "fait") return data.filter((op) => op.fait)
    if (filterFait === "afaire") return data.filter((op) => !op.fait)
    return data
  }, [data, filterFait])

  const totalCout = data.reduce((sum, o) => sum + (o.cout || 0), 0)

  const handleToggleFait = React.useCallback(
    async (op: OperationArbre) => {
      try {
        const res = await fetch(`/api/arbres/operations/${op.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fait: !op.fait }),
        })
        if (res.ok) {
          setData((prev) =>
            prev.map((o) => (o.id === op.id ? { ...o, fait: !op.fait } : o))
          )
          toast({ title: !op.fait ? "Fait !" : "Annule" })
        }
      } catch {
        toast({ variant: "destructive", title: "Erreur" })
      }
    },
    [toast]
  )

  const columns = React.useMemo(() => createColumns(handleToggleFait), [handleToggleFait])

  const resetForm = () => {
    setNewOperation({
      arbreId: "",
      date: new Date().toISOString().split("T")[0],
      type: "taille",
      description: "",
      produit: "",
      quantite: "",
      unite: "",
      cout: "",
      datePrevue: "",
      fait: true,
      notes: "",
    })
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const res = await fetch("/api/arbres/operations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          arbreId: parseInt(newOperation.arbreId),
          date: newOperation.date,
          type: newOperation.type,
          description: newOperation.description || null,
          produit: newOperation.produit || null,
          quantite: newOperation.quantite ? parseFloat(newOperation.quantite) : null,
          unite: newOperation.unite || null,
          cout: newOperation.cout ? parseFloat(newOperation.cout) : null,
          datePrevue: newOperation.datePrevue || null,
          fait: newOperation.fait,
          notes: newOperation.notes || null,
        }),
      })

      if (res.ok) {
        setShowDialog(false)
        resetForm()
        toast({ title: "Operation enregistree" })
        fetchData()
      }
    } catch {
      toast({ title: "Erreur", variant: "destructive" })
    }
  }

  return (
    <div className="space-y-4">
      {/* Stats cout total */}
      <Card>
        <CardContent className="pt-4 pb-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Cout total des operations</p>
            <p className="text-xl font-bold">{totalCout.toFixed(2)} EUR</p>
          </div>
        </CardContent>
      </Card>

      {/* Filtres */}
      <Tabs value={filterFait} onValueChange={setFilterFait}>
        <TabsList className="flex-wrap h-auto gap-1">
          {FILTER_STATES.map(({ value, label, icon: Icon }) => (
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
        onRowDelete={async (row) => {
          if (!confirm("Supprimer cette operation ?")) return
          try {
            await fetch(`/api/arbres/operations/${row.id}`, { method: "DELETE" })
            toast({ title: "Operation supprimee" })
            fetchData()
          } catch {
            toast({ variant: "destructive", title: "Erreur" })
          }
        }}
        searchPlaceholder="Rechercher une operation..."
        emptyMessage="Aucune operation trouvee."
      />

      {/* Dialog nouvelle operation */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Enregistrer une operation</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Arbre *</Label>
                <Select
                  value={newOperation.arbreId}
                  onValueChange={(v) => setNewOperation({ ...newOperation, arbreId: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selectionner" />
                  </SelectTrigger>
                  <SelectContent>
                    {arbres.map((a) => (
                      <SelectItem key={a.id} value={a.id.toString()}>
                        {a.nom}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Type *</Label>
                <Select
                  value={newOperation.type}
                  onValueChange={(v) => setNewOperation({ ...newOperation, type: v })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TYPES_OPERATIONS.map((t) => (
                      <SelectItem key={t.value} value={t.value}>
                        {t.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Date realisation</Label>
                <Input
                  type="date"
                  value={newOperation.date}
                  onChange={(e) => setNewOperation({ ...newOperation, date: e.target.value })}
                />
              </div>
              <div>
                <Label>Date prevue</Label>
                <Input
                  type="date"
                  value={newOperation.datePrevue}
                  onChange={(e) => setNewOperation({ ...newOperation, datePrevue: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Description</Label>
              <Input
                value={newOperation.description}
                onChange={(e) => setNewOperation({ ...newOperation, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Produit utilise</Label>
                <Input
                  value={newOperation.produit}
                  onChange={(e) => setNewOperation({ ...newOperation, produit: e.target.value })}
                  placeholder="Ex: Bouillie bordelaise"
                />
              </div>
              <div>
                <Label>Quantite</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={newOperation.quantite}
                  onChange={(e) => setNewOperation({ ...newOperation, quantite: e.target.value })}
                />
              </div>
              <div>
                <Label>Unite</Label>
                <Input
                  value={newOperation.unite}
                  onChange={(e) => setNewOperation({ ...newOperation, unite: e.target.value })}
                  placeholder="L, kg, g"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Cout (EUR)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={newOperation.cout}
                  onChange={(e) => setNewOperation({ ...newOperation, cout: e.target.value })}
                />
              </div>
              <div className="flex items-end pb-2">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="fait"
                    checked={newOperation.fait}
                    onCheckedChange={(checked) =>
                      setNewOperation({ ...newOperation, fait: !!checked })
                    }
                  />
                  <Label htmlFor="fait">Operation realisee</Label>
                </div>
              </div>
            </div>
            <div>
              <Label>Notes</Label>
              <Input
                value={newOperation.notes}
                onChange={(e) => setNewOperation({ ...newOperation, notes: e.target.value })}
              />
            </div>
            <Button type="submit" className="w-full">
              Enregistrer
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
