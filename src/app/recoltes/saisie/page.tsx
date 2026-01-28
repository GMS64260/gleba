"use client"

/**
 * Page de saisie rapide des récoltes
 */

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, BarChart3, Save, Plus } from "lucide-react"
import { format } from "date-fns"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"

interface Culture {
  id: number
  especeId: string
  varieteId: string | null
  plancheId: string | null
  espece: { id: string }
  variete: { id: string } | null
  planche: { id: string } | null
}

export default function SaisieRecoltePage() {
  const router = useRouter()
  const { toast } = useToast()
  const [cultures, setCultures] = React.useState<Culture[]>([])
  const [selectedCulture, setSelectedCulture] = React.useState<string>("")
  const [quantite, setQuantite] = React.useState<string>("")
  const [date, setDate] = React.useState<string>(format(new Date(), "yyyy-MM-dd"))
  const [notes, setNotes] = React.useState<string>("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [recentRecoltes, setRecentRecoltes] = React.useState<{especeId: string; quantite: number}[]>([])

  // Charger les cultures actives (en cours de récolte ou plantées)
  React.useEffect(() => {
    fetch("/api/cultures?pageSize=200")
      .then((r) => r.json())
      .then((data) => {
        // Filtrer pour garder les cultures actives
        const actives = (data.data || []).filter(
          (c: Culture & { terminee: string | null }) => !c.terminee
        )
        setCultures(actives)
      })
      .catch(() => setCultures([]))
  }, [])

  const selectedCultureData = cultures.find((c) => c.id.toString() === selectedCulture)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedCulture || !quantite) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Veuillez sélectionner une culture et indiquer une quantité",
      })
      return
    }

    const cultureData = cultures.find((c) => c.id.toString() === selectedCulture)
    if (!cultureData) return

    setIsSubmitting(true)
    try {
      const response = await fetch("/api/recoltes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          especeId: cultureData.especeId,
          cultureId: cultureData.id,
          quantite: parseFloat(quantite),
          date: new Date(date),
          notes: notes || null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erreur lors de l'enregistrement")
      }

      // Ajouter aux récoltes récentes
      setRecentRecoltes((prev) => [
        { especeId: cultureData.especeId, quantite: parseFloat(quantite) },
        ...prev.slice(0, 4),
      ])

      toast({
        title: "Récolte enregistrée",
        description: `${quantite} kg de ${cultureData.especeId}`,
      })

      // Réinitialiser le formulaire (garder la culture sélectionnée)
      setQuantite("")
      setNotes("")
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur inconnue",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  // Raccourcis pour les quantités courantes
  const quickQuantities = [0.5, 1, 2, 5, 10]

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center gap-4">
          <Link href="/recoltes">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            <h1 className="text-xl font-bold">Saisie récolte</h1>
          </div>
        </div>
      </header>

      {/* Form */}
      <main className="container mx-auto px-4 py-6 max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Nouvelle récolte</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Date */}
              <div>
                <label className="text-sm font-medium">Date</label>
                <Input
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="mt-1"
                />
              </div>

              {/* Culture */}
              <div>
                <label className="text-sm font-medium">Culture *</label>
                <Select value={selectedCulture} onValueChange={setSelectedCulture}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Sélectionner une culture" />
                  </SelectTrigger>
                  <SelectContent>
                    {cultures.map((c) => (
                      <SelectItem key={c.id} value={c.id.toString()}>
                        {c.espece.id}
                        {c.variete && ` - ${c.variete.id}`}
                        {c.planche && ` (${c.planche.id})`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {selectedCultureData && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Culture #{selectedCultureData.id}
                  </p>
                )}
              </div>

              {/* Quantité */}
              <div>
                <label className="text-sm font-medium">Quantité (kg) *</label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={quantite}
                  onChange={(e) => setQuantite(e.target.value)}
                  placeholder="0.00"
                  className="mt-1 text-2xl h-14 text-center"
                />
                {/* Raccourcis */}
                <div className="flex gap-2 mt-2">
                  {quickQuantities.map((q) => (
                    <Button
                      key={q}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setQuantite(q.toString())}
                    >
                      {q} kg
                    </Button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="text-sm font-medium">Notes (optionnel)</label>
                <Input
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Qualité, remarques..."
                  className="mt-1"
                />
              </div>
            </CardContent>
          </Card>

          <Button
            type="submit"
            className="w-full h-14 text-lg"
            disabled={isSubmitting || !selectedCulture || !quantite}
          >
            <Save className="h-5 w-5 mr-2" />
            {isSubmitting ? "Enregistrement..." : "Enregistrer la récolte"}
          </Button>
        </form>

        {/* Récoltes récentes de cette session */}
        {recentRecoltes.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="text-sm">Récoltes de cette session</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {recentRecoltes.map((r, i) => (
                  <li key={i} className="flex justify-between text-sm">
                    <span>{r.especeId}</span>
                    <span className="font-medium text-green-600">{r.quantite} kg</span>
                  </li>
                ))}
              </ul>
              <div className="border-t mt-3 pt-3 flex justify-between font-medium">
                <span>Total session</span>
                <span className="text-green-600">
                  {recentRecoltes.reduce((sum, r) => sum + r.quantite, 0).toFixed(2)} kg
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
