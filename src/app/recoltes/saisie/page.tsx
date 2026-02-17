"use client"

/**
 * Page de saisie rapide des récoltes
 */

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, BarChart3, Save, Plus } from "lucide-react"
import { format, differenceInDays } from "date-fns"
import { fr } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { estimerRendement } from "@/lib/assistant-helpers"

interface Culture {
  id: number
  especeId: string
  varieteId: string | null
  plancheId: string | null
  dateRecolte: string | null
  finRecolte: string | null
  terminee: string | null
  espece: { id: string; rendement: number | null }
  variete: { id: string } | null
  planche: { id: string; nom?: string; longueur: number | null; largeur: number | null; surface: number | null } | null
  totalRecolte: number
}

/** Vérifie si une culture est prête à récolter (dateRecolte dans ±14 jours) */
function estPreteARecolter(culture: Culture): boolean {
  if (!culture.dateRecolte) return false
  const dateRecolte = new Date(culture.dateRecolte)
  const aujourdHui = new Date()
  const diff = differenceInDays(dateRecolte, aujourdHui)
  return diff >= -14 && diff <= 14
}

/** Formate une date de récolte pour l'affichage dans le sélecteur */
function formaterDateRecolte(dateStr: string | null): string {
  if (!dateStr) return ""
  const date = new Date(dateStr)
  return format(date, "d MMM", { locale: fr })
}

export default function SaisieRecoltePage() {
  const router = useRouter()
  const { toast } = useToast()
  const [cultures, setCultures] = React.useState<Culture[]>([])
  const [selectedCulture, setSelectedCulture] = React.useState<string>("")
  const [quantite, setQuantite] = React.useState<string>("")
  const [date, setDate] = React.useState<string>(format(new Date(), "yyyy-MM-dd"))
  const [datePeremption, setDatePeremption] = React.useState<string>("")
  const [notes, setNotes] = React.useState<string>("")
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [recentRecoltes, setRecentRecoltes] = React.useState<{especeId: string; cultureId: number; quantite: number}[]>([])

  // Charger les cultures actives (en cours de récolte ou plantées)
  React.useEffect(() => {
    fetch("/api/cultures?pageSize=200")
      .then((r) => r.json())
      .then((data) => {
        // Filtrer pour garder les cultures actives (non terminées)
        const actives = (data.data || []).filter(
          (c: Culture) => !c.terminee
        )
        // Trier : prêtes à récolter en premier, puis par date de récolte
        actives.sort((a: Culture, b: Culture) => {
          const aPretes = estPreteARecolter(a)
          const bPretes = estPreteARecolter(b)
          if (aPretes && !bPretes) return -1
          if (!aPretes && bPretes) return 1
          // Au sein du même groupe, trier par date de récolte (les plus proches d'abord)
          if (a.dateRecolte && b.dateRecolte) {
            return new Date(a.dateRecolte).getTime() - new Date(b.dateRecolte).getTime()
          }
          if (a.dateRecolte && !b.dateRecolte) return -1
          if (!a.dateRecolte && b.dateRecolte) return 1
          return 0
        })
        setCultures(actives)
      })
      .catch(() => setCultures([]))
  }, [])

  const selectedCultureData = cultures.find((c) => c.id.toString() === selectedCulture)

  // Estimation du rendement restant pour la culture sélectionnée
  const estimation = React.useMemo(() => {
    if (!selectedCultureData) return null

    const rendementM2 = selectedCultureData.espece.rendement
    const planche = selectedCultureData.planche
    if (!rendementM2 || !planche) return null

    // Surface de la planche : utiliser surface si disponible, sinon longueur x largeur
    const surface = planche.surface
      ?? ((planche.longueur ?? 0) * (planche.largeur ?? 0))
    if (surface <= 0) return null

    const rendementTotal = estimerRendement(rendementM2, surface)
    if (rendementTotal <= 0) return null

    // Soustraire les récoltes déjà effectuées (de la session en cours + de la DB)
    const dejaRecolteSessions = recentRecoltes
      .filter((r) => r.cultureId === selectedCultureData.id)
      .reduce((sum, r) => sum + r.quantite, 0)
    const dejaRecolteDB = selectedCultureData.totalRecolte || 0
    const restant = Math.max(0, rendementTotal - dejaRecolteDB - dejaRecolteSessions)

    return {
      rendementTotal: Math.round(rendementTotal * 100) / 100,
      dejaRecolte: Math.round((dejaRecolteDB + dejaRecolteSessions) * 100) / 100,
      restant: Math.round(restant * 100) / 100,
      surface: Math.round(surface * 100) / 100,
      rendementM2,
    }
  }, [selectedCultureData, recentRecoltes])

  // Pré-remplir la quantité quand on change de culture (si estimation disponible)
  const prevSelectedCulture = React.useRef(selectedCulture)
  React.useEffect(() => {
    if (selectedCulture !== prevSelectedCulture.current) {
      prevSelectedCulture.current = selectedCulture
      if (estimation && estimation.restant > 0) {
        setQuantite(estimation.restant.toString())
      } else {
        setQuantite("")
      }
    }
  }, [selectedCulture, estimation])

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
          datePeremption: datePeremption ? new Date(datePeremption) : null,
          notes: notes || null,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erreur lors de l'enregistrement")
      }

      // Ajouter aux récoltes récentes
      setRecentRecoltes((prev) => [
        { especeId: cultureData.especeId, cultureId: cultureData.id, quantite: parseFloat(quantite) },
        ...prev.slice(0, 4),
      ])

      toast({
        title: "Récolte enregistrée",
        description: `${quantite} kg de ${cultureData.especeId}`,
      })

      // Réinitialiser le formulaire (garder la culture sélectionnée)
      setQuantite("")
      setDatePeremption("")
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium">Date récolte</label>
                  <Input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Péremption</label>
                  <Input
                    type="date"
                    value={datePeremption}
                    onChange={(e) => setDatePeremption(e.target.value)}
                    className="mt-1"
                    placeholder="Optionnel"
                  />
                </div>
              </div>

              {/* Culture */}
              <div>
                <label className="text-sm font-medium">Culture *</label>
                <Select value={selectedCulture} onValueChange={setSelectedCulture}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Sélectionner une culture" />
                  </SelectTrigger>
                  <SelectContent>
                    {(() => {
                      const pretes = cultures.filter(estPreteARecolter)
                      const autres = cultures.filter((c) => !estPreteARecolter(c))
                      return (
                        <>
                          {pretes.length > 0 && (
                            <SelectGroup>
                              <SelectLabel className="text-green-700 flex items-center gap-1.5">
                                <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
                                {`Prêtes à récolter (${pretes.length})`}
                              </SelectLabel>
                              {pretes.map((c) => (
                                <SelectItem key={c.id} value={c.id.toString()}>
                                  <span className="flex items-center gap-2">
                                    <span className="inline-block h-2 w-2 rounded-full bg-green-500 shrink-0" />
                                    <span>
                                      {c.espece.id}
                                      {c.variete && ` - ${c.variete.id}`}
                                      {c.planche && ` (${c.planche.nom || c.planche.id})`}
                                    </span>
                                    {c.dateRecolte && (
                                      <span className="ml-auto text-xs text-green-600 font-medium shrink-0">
                                        {formaterDateRecolte(c.dateRecolte)}
                                      </span>
                                    )}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          )}
                          {pretes.length > 0 && autres.length > 0 && (
                            <SelectSeparator />
                          )}
                          {autres.length > 0 && (
                            <SelectGroup>
                              <SelectLabel className="text-muted-foreground">
                                Autres cultures
                              </SelectLabel>
                              {autres.map((c) => (
                                <SelectItem key={c.id} value={c.id.toString()}>
                                  <span className="flex items-center gap-2">
                                    <span className="inline-block h-2 w-2 rounded-full bg-gray-300 shrink-0" />
                                    <span>
                                      {c.espece.id}
                                      {c.variete && ` - ${c.variete.id}`}
                                      {c.planche && ` (${c.planche.nom || c.planche.id})`}
                                    </span>
                                    {c.dateRecolte && (
                                      <span className="ml-auto text-xs text-muted-foreground shrink-0">
                                        {formaterDateRecolte(c.dateRecolte)}
                                      </span>
                                    )}
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          )}
                        </>
                      )
                    })()}
                  </SelectContent>
                </Select>
                {selectedCultureData && (
                  <div className="mt-1 space-y-1">
                    <p className="text-sm text-muted-foreground">
                      Culture #{selectedCultureData.id}
                      {selectedCultureData.dateRecolte && (
                        <span>
                          {" — Récolte prévue : "}
                          {format(new Date(selectedCultureData.dateRecolte), "d MMMM yyyy", { locale: fr })}
                          {estPreteARecolter(selectedCultureData) && (
                            <Badge variant="outline" className="ml-2 text-green-700 border-green-300 bg-green-50">
                              Prête
                            </Badge>
                          )}
                        </span>
                      )}
                    </p>
                    {estimation && (
                      <div className="text-xs bg-blue-50 border border-blue-200 rounded-md px-3 py-2 space-y-0.5">
                        <p className="font-medium text-blue-700">
                          Estimation : {estimation.rendementTotal} kg
                          <span className="font-normal text-blue-600">
                            {" "}({estimation.rendementM2} kg/m² x {estimation.surface} m²)
                          </span>
                        </p>
                        {estimation.dejaRecolte > 0 && (
                          <p className="text-blue-600">
                            Déjà récolté : {estimation.dejaRecolte} kg
                          </p>
                        )}
                        <p className="text-blue-700 font-medium">
                          Restant estimé : {estimation.restant} kg
                        </p>
                      </div>
                    )}
                    {selectedCultureData && !estimation && selectedCultureData.planche && (
                      <p className="text-xs text-muted-foreground italic">
                        Pas de rendement renseigné pour cette espèce
                      </p>
                    )}
                  </div>
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
