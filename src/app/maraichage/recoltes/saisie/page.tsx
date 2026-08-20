"use client"

/**
 * Page de saisie rapide des recoltes
 */

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, BarChart3, Save, Plus } from "lucide-react"
import { format, differenceInDays } from "date-fns"
import { fr } from "date-fns/locale"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useToast } from "@/hooks/use-toast"
import { AppHeader, PageToolbar } from "@/components/shell/AppHeader"
import {
  libelleUniteQuantite,
  rendementParM2,
  uniteQuantiteRecolte,
  type UniteQuantite,
} from "@/lib/recolte/projection"
import {
  ajouterQuantite,
  formatQuantiteParUnite,
  type QuantiteParUnite,
} from "@/lib/recolte/quantites"
import { libelleUniteRendement } from "@/lib/validations/espece"
import { surfaceCultureM2 } from "@/lib/culture-surface"

interface Culture {
  id: number
  especeId: string
  varieteId: string | null
  plancheId: string | null
  /** Longueur cultivée (m) : portion de la planche occupée par CETTE culture. */
  longueur: number | null
  dateRecolte: string | null
  finRecolte: string | null
  terminee: string | null
  espece: { id: string; nom: string | null; rendement: number | null; uniteRendement: string | null }
  variete: { id: string; nom: string | null } | null
  planche: { id: string; nom?: string; longueur: number | null; largeur: number | null; surface: number | null } | null
  totalRecolte: number
  totalRecolteParUnite?: Partial<Record<UniteQuantite, number>>
}

/** Vérifie si une culture est prête à récolter (dateRecolte dans ±14 jours). */
function estPreteARecolter(culture: Culture, reference = new Date()): boolean {
  if (!culture.dateRecolte) return false
  const dateRecolte = new Date(culture.dateRecolte)
  const diff = differenceInDays(dateRecolte, reference)
  return diff >= -14 && diff <= 14
}

/** Formate une date de recolte pour l'affichage dans le sélecteur */
function formaterDateRecolte(dateStr: string | null): string {
  if (!dateStr) return ""
  const date = new Date(dateStr)
  return format(date, "d MMM", { locale: fr })
}

function libelleCulture(culture: Culture): string {
  const espece = culture.espece.nom ?? culture.espece.id
  const variete = culture.variete
    ? ` - ${culture.variete.nom ?? culture.variete.id}`
    : ""
  const planche = culture.planche
    ? ` (${culture.planche.nom || culture.planche.id})`
    : ""
  const recolte = culture.dateRecolte
    ? ` · ${formaterDateRecolte(culture.dateRecolte)}`
    : ""
  return `#${culture.id} · ${espece}${variete}${planche}${recolte}`
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
  const [recentRecoltes, setRecentRecoltes] = React.useState<{especeId: string; especeNom?: string; cultureId: number; quantite: number; unite: UniteQuantite}[]>([])

  // Charger les cultures actives (en cours de recolte ou plantées)
  React.useEffect(() => {
    fetch("/api/cultures?pageSize=200")
      .then((r) => r.json())
      .then((data) => {
        // Filtrer pour garder les cultures actives (non terminées)
        const actives = (data.data || []).filter(
          (c: Culture) => !c.terminee
        )
        // Trier : prêtes à récolter en premier, puis par date de recolte
        actives.sort((a: Culture, b: Culture) => {
          const aPretes = estPreteARecolter(a)
          const bPretes = estPreteARecolter(b)
          if (aPretes && !bPretes) return -1
          if (!aPretes && bPretes) return 1
          // Au sein du même groupe, trier par date de recolte (les plus proches d'abord)
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

  /**
   * Unité de la culture sélectionnée — celle du rendement effectif de l'espèce
   * (surcharge de la ferme comprise, résolue par l'API des cultures).
   * La saisie s'exprime dans cette unité et la récolte enregistrée la porte.
   */
  const uniteCulture = uniteQuantiteRecolte(selectedCultureData?.espece.uniteRendement)
  const libelleUnite = libelleUniteQuantite(uniteCulture)

  // Estimation du rendement restant pour la culture sélectionnée
  const estimation = React.useMemo(() => {
    if (!selectedCultureData) return null

    // Le rendement du référentiel n'est pas toujours en kg/m² (kg/arbre pour
    // un fruitier, t/ha pour un engrais vert, tiges/m² pour une fleur coupée) :
    // on le ramène d'abord au m² DANS SON UNITÉ, et on n'estime rien quand il
    // ne s'y ramène pas. `rendementParM2` remplace ici `rendementKgParM2`, qui
    // rendait null pour une espèce comptée en tiges — l'écran n'affichait alors
    // aucune estimation à un maraîcher-fleuriste.
    const parM2 = rendementParM2(
      selectedCultureData.espece.rendement,
      selectedCultureData.espece.uniteRendement,
    )
    const planche = selectedCultureData.planche
    if (!parM2 || !planche) return null

    // QA cmswu7zfb — la surface de la culture, pas de la planche entière :
    // une culture de 5 m sur une planche de 10 m était estimée à 12 kg au
    // lieu de 6 (SSOT surfaceCultureM2 : la longueur cultivée prime).
    const surface = surfaceCultureM2({ longueur: selectedCultureData.longueur, planche })
    if (surface <= 0) return null

    const rendementTotal = parM2 * surface
    if (rendementTotal <= 0) return null

    // Soustraire les recoltes déjà effectuées (de la session en cours + de la
    // DB). Côté DB on prend la part de l'unité courante : `totalRecolteParUnite`
    // est ventilé, additionner les autres unités serait faux.
    const dejaRecolteSessions = recentRecoltes
      .filter((r) => r.cultureId === selectedCultureData.id)
      .reduce((sum, r) => sum + r.quantite, 0)
    const dejaRecolteDB =
      selectedCultureData.totalRecolteParUnite?.[uniteCulture] ??
      (uniteCulture === 'kg' ? selectedCultureData.totalRecolte || 0 : 0)
    const restant = Math.max(0, rendementTotal - dejaRecolteDB - dejaRecolteSessions)

    const decimales = uniteCulture === 'kg' ? 2 : 0
    const arrondi = (valeur: number) =>
      Math.round(valeur * 10 ** decimales) / 10 ** decimales

    return {
      rendementTotal: arrondi(rendementTotal),
      dejaRecolte: arrondi(dejaRecolteDB + dejaRecolteSessions),
      restant: arrondi(restant),
      surface: Math.round(surface * 100) / 100,
      rendementM2: Math.round(parM2 * 1000) / 1000,
    }
  }, [selectedCultureData, recentRecoltes, uniteCulture])

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

      // Ajouter aux recoltes récentes
      const especeNom = cultureData.espece.nom ?? cultureData.especeId
      setRecentRecoltes((prev) => [
        {
          especeId: cultureData.especeId,
          especeNom,
          cultureId: cultureData.id,
          quantite: parseFloat(quantite),
          // L'unité voyage avec la ligne : la session peut enchaîner une carotte
          // au kilo et un dahlia à la tige.
          unite: uniteQuantiteRecolte(cultureData.espece.uniteRendement),
        },
        ...prev.slice(0, 4),
      ])

      toast({
        title: "Récolte enregistrée",
        description: `${quantite} ${libelleUnite} de ${especeNom}`,
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
  // Des kilos se pèsent au demi, des tiges ou des bottes se comptent : proposer
  // « 0,5 tige » n'aurait pas de sens.
  const quickQuantities = uniteCulture === 'kg' ? [0.5, 1, 2, 5, 10] : [5, 10, 25, 50, 100]

  return (
    <div className="min-h-screen bg-slate-50 aurora-bg-subtle">
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" aria-hidden="true" />
      {/* Header */}
      <AppHeader current="maraichage" showLune />
      <PageToolbar>
        <div className="flex items-center gap-4">
          <Link href="/maraichage/recoltes">
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
      </PageToolbar>

      {/* Form */}
      {/* QA cmsbu4f00 — pb-24 : les pastilles flottantes (Assistant IA,
          Feedback) recouvraient le bouton « Enregistrer la récolte » en bas
          de page sur mobile. Même pattern que /taches (pb-20). */}
      <main className="container mx-auto px-4 py-6 pb-24 max-w-lg">
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
                {(() => {
                  // Un select natif garde une sélection fiable, y compris
                  // avec une longue liste et les navigateurs mobiles. Le
                  // regroupement se base sur la date saisie dans le formulaire
                  // plutôt que sur la date du jour.
                  const reference = date
                    ? new Date(`${date}T12:00:00`)
                    : new Date()
                  const pretes = cultures.filter((c) => estPreteARecolter(c, reference))
                  const autres = cultures.filter((c) => !estPreteARecolter(c, reference))
                  return (
                    <select
                      value={selectedCulture}
                      onChange={(event) => setSelectedCulture(event.target.value)}
                      className="mt-1 flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm focus:outline-none focus:ring-1 focus:ring-ring"
                    >
                      <option value="">Sélectionner une culture</option>
                      {pretes.length > 0 && (
                        <optgroup label={`Prêtes à récolter (${pretes.length})`}>
                          {pretes.map((culture) => (
                            <option key={culture.id} value={culture.id.toString()}>
                              {libelleCulture(culture)}
                            </option>
                          ))}
                        </optgroup>
                      )}
                      {autres.length > 0 && (
                        <optgroup label="Autres cultures">
                          {autres.map((culture) => (
                            <option key={culture.id} value={culture.id.toString()}>
                              {libelleCulture(culture)}
                            </option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  )
                })()}
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
                          Estimation : {estimation.rendementTotal} {libelleUnite}
                          <span className="font-normal text-blue-600">
                            {" "}({estimation.rendementM2}{" "}
                            {libelleUniteRendement(selectedCultureData?.espece.uniteRendement)} x{" "}
                            {estimation.surface} m²)
                          </span>
                        </p>
                        {estimation.dejaRecolte > 0 && (
                          <p className="text-blue-600">
                            Déjà récolté : {estimation.dejaRecolte} {libelleUnite}
                          </p>
                        )}
                        <p className="text-blue-700 font-medium">
                          Restant estimé : {estimation.restant} {libelleUnite}
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
                <label className="text-sm font-medium">Quantité ({libelleUnite}) *</label>
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
                      {q} {libelleUnite}
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

          {/* scroll-mb-28 : un scrollIntoView (agent, clavier mobile) ne doit
              pas caler le bouton sous les pastilles fixed feedback/IA qui
              occupent la bande basse du viewport (cmsoazhyy). */}
          <Button
            type="submit"
            className="w-full h-14 text-lg scroll-mb-28"
            disabled={isSubmitting || !quantite}
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
                    <span>{r.especeNom ?? r.especeId}</span>
                    <span className="font-medium text-green-600">
                      {r.quantite} {libelleUniteQuantite(r.unite, r.quantite)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="border-t mt-3 pt-3 flex justify-between font-medium">
                <span>Total session</span>
                {/* Une session peut mêler des kilos et des tiges : on ventile
                    plutôt que d'additionner. */}
                <span className="text-green-600">
                  {formatQuantiteParUnite(
                    recentRecoltes.reduce<QuantiteParUnite>(
                      (acc, r) => ajouterQuantite(acc, r.unite, r.quantite),
                      {},
                    ),
                  )}
                </span>
              </div>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  )
}
