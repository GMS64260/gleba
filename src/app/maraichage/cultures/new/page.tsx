"use client"

/**
 * Page de création d'une nouvelle culture
 */

import * as React from "react"
import { useSession } from "next-auth/react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Sprout, Save } from "lucide-react"
import { formatSemaine } from "@/lib/assistant-helpers"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { format } from "date-fns"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useToast } from "@/hooks/use-toast"
import { AppHeader, PageToolbar } from "@/components/shell/AppHeader"
import { cultureFormSchema, type CreateCultureInput } from "@/lib/validations"
import { estimerNombrePlantsStrict } from "@/lib/assistant-helpers"
import { RotationAdviceCompact } from "@/components/planche"
import { EspeceCombobox, type EspeceOption } from "@/components/especes/EspeceCombobox"
import { AdjacenceAdvisor } from "@/components/cultures/AdjacenceAdvisor"
import {
  DASHBOARD_YEAR_STORAGE_KEY,
  resolveDashboardYear,
} from "@/lib/dashboard-year"
import { nomAffichableItp, nomAffichableItpAvecFenetre } from "@/lib/itp-label"
import { badgeOrigine } from "@/lib/referentiel-communaute"
import { datesDepuisItp, recolteApresDebut, semaineSemisEffective } from "@/lib/cultures/dates-itp"
import { Checkbox } from "@/components/ui/checkbox"
import { cocherApresSaisieManuelle, etapeDejaRealisable } from "@/lib/cultures/deja-fait"

// Bug #1 — payload de violation renvoyé par POST /api/cultures (status 409).
type RotationViolation = {
  rotationId: string
  etapeAttendue: number
  familleAttendue: string | null
  familleDemandee: string | null
  message: string
}

interface ITPData {
  id: string
  nom: string | null
  // null = catalogue Gleba officiel ; renseigné = libellé saisi par un membre,
  // que `nomAffichableItp` rend alors tel quel (QA cmswxyuoi).
  userId: string | null
  especeId: string | null
  semaineSemis: number | null
  semainePlantation: number | null
  semaineRecolte: number | null
  // QA cmsfxvbab — 173 ITP du référentiel (mesclun INRAE, etc.)
  // n'ont ni semaine de semis ni semaine de plantation : leur fenêtre
  // d'implantation est le seul jalon de début de cycle exploitable.
  semaineImplantationDebut: number | null
  semaineImplantationFin: number | null
  dureeCulture: number | null
  /** Arbres fruitiers : années entre plantation et première récolte. */
  delaiPremiereRecolteAnnees: number | null
  dureeRecolte: number | null
  nbRangs: number | null
  espacement: number | null
  espacementRangs: number | null
}

export default function NewCulturePage() {
  const { data: session } = useSession()
  const currentUserId = (session?.user as { id?: string } | undefined)?.id ?? null
  const router = useRouter()
  const { toast } = useToast()
  // Bug #12 — charger aussi le type d'espèce pour le combobox filtrable.
  const [especes, setEspeces] = React.useState<EspeceOption[]>([])
  const [varietes, setVarietes] = React.useState<{ id: string; nom: string | null; especeId: string }[]>([])
  const [itps, setItps] = React.useState<ITPData[]>([])
  const [planches, setPlanches] = React.useState<{ id: string; nom?: string; longueur: number | null }[]>([])
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  // QA cmsp5927v — un refus d'occupation de planche n'existait que dans un toast
  // de 5 s : l'utilisateur revoyait un formulaire vide sans savoir pourquoi.
  const [submitError, setSubmitError] = React.useState<string | null>(null)
  // Bug #1 — modale violation rotation (renvoyée par le backend en 409).
  const [rotationWarning, setRotationWarning] = React.useState<{
    payload: CreateCultureInput
    violation: RotationViolation
  } | null>(null)
  // Bug #33 — message informatif quand la date ITP a été dépassée et rectifiée.
  const [dateSemisInfo, setDateSemisInfo] = React.useState<string | null>(null)

  const form = useForm<CreateCultureInput>({
    // QA cmsfxvbab — schéma formulaire : bloque récolte < semis AVANT le POST,
    // avec message inline sous le champ (le refus 400 de l'API n'apparaissait
    // que dans un toast éphémère, perçu comme un échec silencieux).
    resolver: zodResolver(cultureFormSchema),
    defaultValues: {
      especeId: "",
      varieteId: null,
      itpId: null,
      plancheId: null,
      annee: new Date().getFullYear(),
      dateSemis: null,
      datePlantation: null,
      dateRecolte: null,
      semisFait: false,
      plantationFaite: false,
      recolteFaite: false,
      terminee: null,
      quantite: null,
      nbRangs: null,
      longueur: null,
      espacement: null,
      notes: null,
    },
  })

  React.useEffect(() => {
    let storedYear: string | null = null
    try {
      storedYear = localStorage.getItem(DASHBOARD_YEAR_STORAGE_KEY)
    } catch {
      // Stockage indisponible : le deep-link ou l'année courante suffisent.
    }

    const queryYear = new URLSearchParams(window.location.search).get("annee")
    form.setValue("annee", resolveDashboardYear({
      queryValue: queryYear,
      storedValue: storedYear,
      fallbackYear: new Date().getFullYear(),
    }))
  }, [form])

  const selectedEspece = form.watch("especeId")
  const selectedPlanche = form.watch("plancheId")
  // QA cmsjhc0cx — le SelectBubbleInput de Radix renvoie onValueChange("")
  // quand la valeur du deep-link arrive dans le même commit que la liste des
  // planches : le <select> natif caché reçoit la valeur avant que ses <option>
  // ne soient enregistrées, retombe sur "" et le change est répercuté au
  // formulaire. On ré-affirme donc le deep-link tant que l'utilisateur n'a pas
  // fait de choix lui-même ; au tour suivant les options existent et la
  // valeur tient.
  const deepLinkPlancheRef = React.useRef<string | null>(null)
  React.useEffect(() => {
    const wanted = deepLinkPlancheRef.current
    if (!wanted) return
    if (selectedPlanche && selectedPlanche !== wanted) {
      // Choix manuel divergent : on n'interfère plus jamais.
      deepLinkPlancheRef.current = null
      return
    }
    if (!selectedPlanche) {
      form.setValue("plancheId", wanted, { shouldDirty: false })
    }
  }, [selectedPlanche, form])
  const selectedAnnee = form.watch("annee")
  const selectedItp = form.watch("itpId")
  const watchedNbRangs = form.watch("nbRangs")
  const watchedLongueur = form.watch("longueur")
  const watchedEspacement = form.watch("espacement")
  // QA cmsw8z9jt — même défaut Radix que le deep-link planche ci-dessus, pour
  // l'ITP auto-sélectionné : la valeur posée dans le même commit que la liste
  // retombe à "" via le SelectBubbleInput. Le champ affichait « Sélectionner
  // un ITP » pendant que les dates de l'ITP fantôme restaient appliquées, et
  // la culture partait avec itpId null. On ré-affirme l'auto-sélection tant
  // que l'utilisateur n'a pas fait de choix lui-même.
  const autoItpRef = React.useRef<string | null>(null)
  React.useEffect(() => {
    const wanted = autoItpRef.current
    if (!wanted) return
    if (selectedItp && selectedItp !== wanted) {
      // Choix manuel divergent : on n'interfère plus jamais.
      autoItpRef.current = null
      return
    }
    if (!selectedItp) {
      form.setValue("itpId", wanted, { shouldDirty: false })
    }
  }, [selectedItp, form])

  // Charger les données de reference
  React.useEffect(() => {
    Promise.all([
      fetch("/api/especes?pageSize=500").then((r) => r.json()),
      fetch("/api/planches?pageSize=500").then((r) => r.json()),
    ])
      .then(([especesData, planchesData]) => {
        const loadedPlanches = planchesData.data || []
        setEspeces(especesData.data || [])
        setPlanches(loadedPlanches)

        // Le raccourci « + Nouvelle culture » d'une fiche planche transmet
        // son identifiant dans l'URL. On ne l'appliquait jamais au formulaire.
        const requestedPlancheId = new URLSearchParams(window.location.search).get("plancheId")
        if (
          requestedPlancheId &&
          loadedPlanches.some((planche: { id: string }) => planche.id === requestedPlancheId)
        ) {
          deepLinkPlancheRef.current = requestedPlancheId
          form.setValue("plancheId", requestedPlancheId, { shouldDirty: false })
        }
      })
      .catch(() => {
        setEspeces([])
        setPlanches([])
      })
  }, [form])

  // Charger les varietes et ITPs quand l'espece change
  React.useEffect(() => {
    if (selectedEspece) {
      Promise.all([
        fetch(`/api/especes/${encodeURIComponent(selectedEspece)}`).then((r) => r.json()),
        fetch(`/api/itps?especeId=${encodeURIComponent(selectedEspece)}&pageSize=1000&applicable=1&calibre=1&sortBy=confiance`).then((r) => r.json()),
      ])
        .then(([especeData, itpsData]) => {
          setVarietes(especeData.varietes || [])
          // La variété de l'espèce PRÉCÉDENTE restait sélectionnée au changement
          // d'espèce : la culture partait « Carotte / Tomate Marmande ». Le
          // serveur refuse désormais cette combinaison — encore faut-il que le
          // formulaire ne la produise plus tout seul.
          form.setValue("varieteId", null)
          const loadedItps = itpsData.data || []
          setItps(loadedItps)
          // Auto-sélectionner le premier ITP disponible
          if (loadedItps.length > 0) {
            autoItpRef.current = loadedItps[0].id
            form.setValue("itpId", loadedItps[0].id)
          } else {
            autoItpRef.current = null
            form.setValue("itpId", null)
          }
        })
        .catch(() => {
          setVarietes([])
          setItps([])
          autoItpRef.current = null
          form.setValue("itpId", null)
        })
    } else {
      setVarietes([])
      setItps([])
    }
  }, [selectedEspece, form])

  // Dernier début de cycle APPLIQUÉ (par l'effet ITP ou par l'utilisateur).
  // Sert au recalage de la récolte : seul un CHANGEMENT de début le déclenche,
  // jamais une édition de la seule récolte ni le remplissage initial de l'ITP.
  const debutCycleRef = React.useRef<string | null>(null)

  // PROMPT 20b — Auto-remplissage ITP → dates de culture
  // L'année est dans les deps : changer d'année recalcule les dates si ITP fixé.
  const selectedYear = form.watch("annee")
  React.useEffect(() => {
    // QA cmsw8z9jt — ITP vidé ⇒ purger le bandeau « fenêtre dépassée », sinon
    // le message de l'ITP fantôme restait affiché indéfiniment.
    if (!selectedItp) {
      setDateSemisInfo(null)
      return
    }
    const itp = itps.find((i) => i.id === selectedItp)
    if (!itp) return

    const year = selectedYear || new Date().getFullYear()
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    setDateSemisInfo(null)

    // Bug #33 + bug Ail #509 — Calculer les dates ITP brutes et, si la première
    // jalon (semis ou plantation) est passée pour l'année courante, décaler
    // l'ENSEMBLE du cycle uniformément. Sinon on cassait le cycle : ex. semis
    // remplacé par today, plantation par today, récolte laissée à la date ITP
    // qui tombait par hasard sur today → cycle d'1 jour.
    // Chronologie : une étape antérieure au semis tombe l'année suivante (ITP
    // chevauchant deux années, ex. semis août → récolte janvier).
    // QA cmsfxvbab — l'ancrage est délégué à datesDepuisItp, qui gère les ITP
    // « implantation seule » (sans semaine de semis ni de plantation, leur
    // récolte était posée en absolu, donc éventuellement avant le semis).
    const cycle = datesDepuisItp(year, itp)
    let semisDate = cycle.dateSemis
    let plantationDate = cycle.datePlantation
    let recolteDate = cycle.dateRecolte

    if (year === today.getFullYear()) {
      const firstAnchor = semisDate ?? plantationDate
      if (firstAnchor && firstAnchor < today) {
        // Audit fuseaux #76 : décalage en JOURS calendaires (setDate), pas en
        // millisecondes. L'ajout d'un offset ms qui traverse le passage à
        // l'heure d'été (mars) décalait les dates d'1h → un jour de trop près
        // de minuit. setDate préserve l'heure locale et gère le DST.
        const decalageJours = Math.ceil((today.getTime() - firstAnchor.getTime()) / 86400000)
        const addJours = (d: Date | null) => {
          if (!d) return d
          const r = new Date(d)
          r.setDate(r.getDate() + decalageJours)
          return r
        }
        semisDate = addJours(semisDate)
        plantationDate = addJours(plantationDate)
        recolteDate = addJours(recolteDate)
        const semaineAncrage = semaineSemisEffective(itp) ?? itp.semainePlantation
        const semaineLabel = semaineAncrage ? formatSemaine(semaineAncrage) : ""
        setDateSemisInfo(
          `Fenêtre ITP ${semaineLabel} dépassée — cycle décalé de ${decalageJours} j (semis/plantation/récolte alignés).`
        )
      }
    }

    if (semisDate) form.setValue("dateSemis", semisDate)
    if (plantationDate) form.setValue("datePlantation", plantationDate)
    if (recolteDate) form.setValue("dateRecolte", recolteDate)
    // Le cycle ITP vient d'être posé en bloc : mémoriser son début pour que
    // l'effet de recalage ne réécrive pas la récolte calculée par datesDepuisItp.
    const debutCycle = plantationDate ?? semisDate
    if (debutCycle) debutCycleRef.current = debutCycle.toISOString()
    if (itp.nbRangs) {
      form.setValue("nbRangs", itp.nbRangs)
    }
    // Bug #29 — Pré-remplir espacement depuis l'ITP. Fallback sur espacementRangs
    // si espacement (sur le rang) absent, pour ne pas laisser le champ vide alors
    // que le calcul "Quantité plants" l'utilise.
    const espVal = itp.espacement ?? itp.espacementRangs
    if (espVal) {
      form.setValue("espacement", Math.round(espVal))
    }
  }, [selectedItp, selectedYear, itps, form])

  // QA cmsfxvbab + friction 2026-08-14 — la date de récolte SUIT le début de
  // cycle saisi. Les dates n'étaient recalculées qu'au changement d'ITP : un
  // ail planté le 05/03 gardait la récolte de l'ancrage ITP d'automne
  // (11/07 de l'année suivante), et une récolte restée ANTÉRIEURE au début
  // partait dans un payload que l'API refuse en 400. À chaque changement de
  // semis/plantation, la récolte est recalée en préservant la durée du cycle
  // ITP (`recolteApresDebut`, source unique). Éditer la seule récolte ne
  // déclenche rien : le choix manuel tient tant que le début ne bouge plus.
  const watchedDateSemis = form.watch("dateSemis")
  const watchedDatePlantation = form.watch("datePlantation")
  React.useEffect(() => {
    const debutRaw = watchedDatePlantation ?? watchedDateSemis
    if (!debutRaw) return
    const debut = new Date(debutRaw)
    if (Number.isNaN(debut.getTime())) return
    const debutKey = debut.toISOString()
    const debutChange = debutCycleRef.current !== null && debutCycleRef.current !== debutKey
    debutCycleRef.current = debutKey

    const recolteRaw = form.getValues("dateRecolte")
    if (!recolteRaw) return // une récolte volontairement vide n'est jamais re-remplie ici
    const recolte = new Date(recolteRaw)
    if (Number.isNaN(recolte.getTime())) return
    const recolteIncoherente = recolte <= debut
    if (!debutChange && !recolteIncoherente) return

    const itp = itps.find((i) => i.id === selectedItp)
    if (!itp) return
    const nouvelleRecolte = recolteApresDebut(debut, itp)
    if (!nouvelleRecolte || nouvelleRecolte.getTime() === recolte.getTime()) return
    form.setValue("dateRecolte", nouvelleRecolte)
  }, [watchedDateSemis, watchedDatePlantation, selectedItp, itps, form])

  // Friction 2026-08-23 — « déjà fait » à la création (cf. lib/cultures/
  // deja-fait.ts). La case ne survit pas à une date devenue future ou vidée,
  // quel que soit le chemin qui a déplacé la date (saisie, préremplissage ITP,
  // changement d'année) : une étape faite ne peut pas être datée dans le futur.
  React.useEffect(() => {
    if (form.getValues("semisFait") && !etapeDejaRealisable(watchedDateSemis)) {
      form.setValue("semisFait", false)
    }
  }, [watchedDateSemis, form])
  React.useEffect(() => {
    if (form.getValues("plantationFaite") && !etapeDejaRealisable(watchedDatePlantation)) {
      form.setValue("plantationFaite", false)
    }
  }, [watchedDatePlantation, form])

  // Mettre à jour la longueur quand la planche change
  React.useEffect(() => {
    if (selectedPlanche) {
      const planche = planches.find((p) => p.id === selectedPlanche)
      if (planche?.longueur) {
        form.setValue("longueur", planche.longueur)
      }
    }
  }, [selectedPlanche, planches, form])

  // Auto-calculer la quantité de plants (BUG-10 : null si inputs incomplets).
  React.useEffect(() => {
    const quantite = estimerNombrePlantsStrict(
      watchedLongueur ?? null,
      watchedNbRangs ?? null,
      watchedEspacement ?? null
    )
    form.setValue("quantite", quantite)
  }, [watchedNbRangs, watchedLongueur, watchedEspacement, form])

  /**
   * Bug #1 — Soumission avec gestion du 409 rotationViolation.
   * Si `confirmRotation` est true, on bypass le warning et flag rotationViolee
   * côté serveur. Sinon, on ouvre la modale et on attend l'arbitrage user.
   */
  const submitCulture = async (data: CreateCultureInput, confirmRotation = false) => {
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      const response = await fetch("/api/cultures", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...data, confirmRotation }),
      })

      // QA cmsp5927v — le corps était lu deux fois sur un 409 sans
      // `rotationViolation` (le second appel jette « body already read »), ce
      // qui transformait un refus métier explicite en erreur incompréhensible.
      // Une seule lecture, réutilisée ensuite.
      const payload = await response.json().catch(() => null)

      if (response.status === 409 && payload?.rotationViolation) {
        setRotationWarning({ payload: data, violation: payload.rotationViolation })
        return
      }

      if (!response.ok) {
        // Les refus d'occupation de planche arrivent avec des suggestions
        // d'ajustement : elles ne servent à rien dans un toast de 5 s.
        const suggestions: string[] = Array.isArray(payload?.suggestions) ? payload.suggestions : []
        const message = [payload?.error || "Erreur lors de la création", ...suggestions].join(" · ")
        setSubmitError(message)
        throw new Error(message)
      }

      const culture = payload
      toast({
        title: "Culture créée",
        description: `La culture #${culture.id} a été créée avec succès`,
      })
      // Audit Marc 2026-05-14 — Bug 04 : afficher les warnings ITP non
      // bloquants ("Semis le 01/06 hors fenêtre ITP recommandée mars–avril")
      if (Array.isArray(culture.warnings) && culture.warnings.length > 0) {
        for (const w of culture.warnings) {
          toast({
            variant: "default",
            title: "Avertissement agronomique",
            description: w,
          })
        }
      }
      router.push("/maraichage/cultures")
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

  const onSubmit = (data: CreateCultureInput) => submitCulture(data, false)

  return (
    <div className="min-h-screen bg-slate-50 aurora-bg-subtle">
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" aria-hidden="true" />
      {/* Header */}
      <AppHeader current="maraichage" showLune />
      <PageToolbar>
        <div className="flex items-center gap-4">
          <Link href="/maraichage/cultures">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Retour
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Sprout className="h-6 w-6 text-green-600" />
            <h1 className="text-xl font-bold">Nouvelle culture</h1>
          </div>
        </div>
      </PageToolbar>

      {/* Form */}
      {/* QA cmsbu4f00 — pb-24 : les pastilles flottantes ne doivent pas
          recouvrir les boutons de soumission en bas de formulaire mobile. */}
      <main className="container mx-auto px-4 py-6 pb-24 max-w-2xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Plante et emplacement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="especeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Espèce *</FormLabel>
                      <FormControl>
                        {/* Bug #12 + Bug #31 — Combobox searchable, défaut = types
                            potager (le verger reste accessible via l'onglet). */}
                        <EspeceCombobox
                          options={especes}
                          value={field.value || null}
                          onChange={(id) => field.onChange(id || "")}
                          defaultTypes={["legume", "aromatique", "fleur", "engrais_vert"]}
                          recentStorageKey="espece-recents-maraichage"
                          placeholder="Rechercher une espèce…"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="varieteId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Variété</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || undefined}
                        disabled={!selectedEspece || varietes.length === 0}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={varietes.length === 0 ? "Aucune variété" : "Sélectionner"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {varietes.map((v) => (
                            <SelectItem key={v.id} value={v.id}>
                              {v.nom ?? v.id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="itpId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Itinéraire technique (ITP)</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || undefined}
                        disabled={!selectedEspece || itps.length === 0}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder={itps.length === 0 ? "Aucun ITP" : "Sélectionner un ITP"} />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {itps.map((itp) => (
                            <SelectItem key={itp.id} value={itp.id}>
                              <span className="flex items-center gap-2">
                                {nomAffichableItpAvecFenetre(itp)}
                                {/* Origine dite dans la liste elle-même : sans
                                    elle, la contribution d'un membre ne se
                                    distinguait pas d'une référence du catalogue. */}
                                {(() => {
                                  const badge = badgeOrigine(itp, currentUserId)
                                  return badge ? (
                                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${badge.cls}`}>
                                      {badge.label}
                                    </span>
                                  ) : null
                                })()}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="plancheId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Planche</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value || undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner une planche" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {planches.map((p) => (
                            <SelectItem key={p.id} value={p.id}>
                              {p.nom || p.id}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Conseils de rotation. Planche adressée par son identifiant et
                    non par son nom : l'enregistrement contrôle la rotation sur
                    l'id, donc passer le libellé exposait les deux verdicts à un
                    repli de résolution différent (et cassait au renommage). */}
                {selectedPlanche && (
                  <RotationAdviceCompact
                    plancheId={selectedPlanche}
                    especeId={selectedEspece || undefined}
                    year={selectedAnnee || undefined}
                  />
                )}

                {/* Bug #10 — Compatibilités voisinage (planches du même îlot). */}
                {selectedEspece && selectedPlanche && (
                  <AdjacenceAdvisor especeId={selectedEspece} plancheId={selectedPlanche} />
                )}

                <FormField
                  control={form.control}
                  name="annee"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Année</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="2000"
                          max="2100"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) =>
                            field.onChange(
                              e.target.value ? parseInt(e.target.value) : null
                            )
                          }
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Dates prévisionnelles</CardTitle>
                {selectedItp && (() => {
                  const itp = itps.find((i) => i.id === selectedItp)
                  if (!itp || (!itp.semaineSemis && !itp.semainePlantation && !itp.semaineRecolte)) return null
                  return (
                    <div className="flex items-center justify-between gap-2 text-xs text-slate-600 bg-blue-50 border border-blue-100 rounded p-2 mt-2">
                      <span>
                        💡 Dates pré-remplies depuis l&apos;ITP <strong>{nomAffichableItp(itp)}</strong> (
                        {[
                          itp.semaineSemis ? `${formatSemaine(itp.semaineSemis)} semis` : null,
                          // QA cmsfxvbab — ITP sans jalon semis/plantation : la
                          // fenêtre d'implantation sert de semis proposé.
                          !itp.semaineSemis && !itp.semainePlantation && itp.semaineImplantationDebut
                            ? `${formatSemaine(itp.semaineImplantationDebut)} implantation (semis proposé)`
                            : null,
                          itp.semainePlantation ? `${formatSemaine(itp.semainePlantation)} plantation` : null,
                          itp.semaineRecolte ? `${formatSemaine(itp.semaineRecolte)} récolte` : null,
                        ].filter(Boolean).join(" · ")}). Modifiable.
                      </span>
                      <button
                        type="button"
                        className="text-blue-700 underline hover:text-blue-900"
                        onClick={() => {
                          const year = form.getValues("annee") || new Date().getFullYear()
                          // QA cmsfxvbab — même ancrage que l'auto-remplissage :
                          // le bouton posait les trois dates sur `year` sans
                          // cascade, donc une récolte antérieure au semis sur un
                          // ITP à cheval sur deux années.
                          const cycle = datesDepuisItp(year, itp)
                          if (cycle.dateSemis) form.setValue("dateSemis", cycle.dateSemis)
                          if (cycle.datePlantation) form.setValue("datePlantation", cycle.datePlantation)
                          if (cycle.dateRecolte) form.setValue("dateRecolte", cycle.dateRecolte)
                        }}
                      >
                        Resynchroniser
                      </button>
                    </div>
                  )
                })()}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="dateSemis"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date semis</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            value={field.value ? format(new Date(field.value), "yyyy-MM-dd") : ""}
                            onChange={(e) => {
                              const date = e.target.value ? new Date(e.target.value) : null
                              field.onChange(date)
                              setDateSemisInfo(null)
                              // Antidater est le geste de qui enregistre un
                              // semis déjà en terre : la case suit la saisie.
                              if (cocherApresSaisieManuelle(date)) {
                                form.setValue("semisFait", true)
                              }
                            }}
                          />
                        </FormControl>
                        {dateSemisInfo && (
                          <p className="text-xs text-amber-700 mt-1">{dateSemisInfo}</p>
                        )}
                        {etapeDejaRealisable(field.value) && (
                          <FormField
                            control={form.control}
                            name="semisFait"
                            render={({ field: fait }) => (
                              <label className="flex items-center gap-2 mt-1 text-xs text-muted-foreground cursor-pointer">
                                <Checkbox
                                  checked={fait.value}
                                  onCheckedChange={(v) => fait.onChange(v === true)}
                                />
                                Semis déjà réalisé
                              </label>
                            )}
                          />
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="datePlantation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date plantation</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            value={field.value ? format(new Date(field.value), "yyyy-MM-dd") : ""}
                            onChange={(e) => {
                              const date = e.target.value ? new Date(e.target.value) : null
                              field.onChange(date)
                              if (cocherApresSaisieManuelle(date)) {
                                form.setValue("plantationFaite", true)
                              }
                            }}
                          />
                        </FormControl>
                        {etapeDejaRealisable(field.value) && (
                          <FormField
                            control={form.control}
                            name="plantationFaite"
                            render={({ field: fait }) => (
                              <label className="flex items-center gap-2 mt-1 text-xs text-muted-foreground cursor-pointer">
                                <Checkbox
                                  checked={fait.value}
                                  onCheckedChange={(v) => fait.onChange(v === true)}
                                />
                                Plantation déjà réalisée
                              </label>
                            )}
                          />
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dateRecolte"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Date récolte</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            {...field}
                            value={field.value ? format(new Date(field.value), "yyyy-MM-dd") : ""}
                            onChange={(e) =>
                              field.onChange(e.target.value ? new Date(e.target.value) : null)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Quantités</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="longueur"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Longueur (m)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value ? parseFloat(e.target.value) : null
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="nbRangs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nb rangs</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value ? parseInt(e.target.value) : null
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="espacement"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Espacement (cm)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="1"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value ? parseInt(e.target.value) : null
                              )
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="quantite"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel
                          title="Formule : nbRangs × ⌊longueur (cm) ÷ espacement⌋. Si vous modifiez ce champ, la valeur n'est plus recalculée."
                          className="cursor-help"
                        >
                          Quantité / plants (auto) ⓘ
                        </FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            step="0.1"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(
                                e.target.value ? parseFloat(e.target.value) : null
                              )
                            }
                          />
                        </FormControl>
                        {/* Bug #2 — formule active pour rendre transparent
                            l'origine du chiffre et lever l'impression
                            d'une valeur figée depuis l'ITP. */}
                        {watchedLongueur && watchedNbRangs && watchedEspacement && watchedEspacement > 0 && (
                          <p className="text-xs text-slate-500">
                            = {watchedNbRangs} rang(s) × ⌊{watchedLongueur} m ÷ {watchedEspacement} cm⌋
                            = {Math.floor((watchedLongueur * 100) / watchedEspacement) * watchedNbRangs}
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <FormField
                  control={form.control}
                  name="notes"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <Textarea
                          placeholder="Notes sur cette culture..."
                          rows={3}
                          {...field}
                          value={field.value || ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {submitError && (
              <p role="alert" className="text-sm text-red-600">{submitError}</p>
            )}

            <div className="flex justify-end gap-4">
              <Link href="/maraichage/cultures">
                <Button variant="outline">Annuler</Button>
              </Link>
              <Button type="submit" disabled={isSubmitting}>
                <Save className="h-4 w-4 mr-2" />
                {isSubmitting ? "Enregistrement..." : "Enregistrer"}
              </Button>
            </div>
          </form>
        </Form>
      </main>

      {/* Bug #1 — Modale alerte violation de rotation. */}
      <Dialog
        open={rotationWarning !== null}
        onOpenChange={(open) => {
          if (!open) setRotationWarning(null)
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              ⚠️ Plan de rotation non respecté
            </DialogTitle>
            <DialogDescription>
              Cette planche suit un plan de rotation qui prévoit une autre famille botanique cette année.
            </DialogDescription>
          </DialogHeader>
          {rotationWarning && (
            <div className="space-y-3 text-sm">
              <div className="rounded-md bg-amber-50 border border-amber-200 p-3 text-amber-900">
                {rotationWarning.violation.message}
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-muted-foreground">Famille attendue</div>
                  <div className="font-medium">
                    {rotationWarning.violation.familleAttendue ?? "—"}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">Famille demandée</div>
                  <div className="font-medium">
                    {rotationWarning.violation.familleDemandee ?? "—"}
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                Si vous continuez, la culture sera créée mais marquée « rotation violée » pour traçabilité.
              </p>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => setRotationWarning(null)}>
              Annuler
            </Button>
            {rotationWarning && (
              <Link
                href={`/maraichage/rotations/${encodeURIComponent(rotationWarning.violation.rotationId)}`}
                target="_blank"
              >
                <Button variant="outline">Voir la rotation</Button>
              </Link>
            )}
            <Button
              variant="default"
              onClick={() => {
                if (!rotationWarning) return
                const payload = rotationWarning.payload
                setRotationWarning(null)
                void submitCulture(payload, true)
              }}
              disabled={isSubmitting}
            >
              Continuer quand même
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
