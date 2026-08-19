"use client"

/**
 * Page edition d'un ITP
 */

import * as React from "react"
import Link from "next/link"
import { useRouter, useParams } from "next/navigation"
import { ArrowLeft, Route, Save, Trash2, ExternalLink, ShieldCheck, AlertTriangle } from "lucide-react"
import { useSession } from "next-auth/react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { confirmDialog } from "@/lib/global-dialog"
import { updateITPSchema, type UpdateITPInput, ITP_TYPE_PLANCHE } from "@/lib/validations/itp"
import { decalageItpPourLecteur, decalerSemaine, labelZone } from "@/lib/calendrier-climat"
import { nomAffichableItp } from "@/lib/itp-label"
import { badgeOrigine, origineReferentiel } from "@/lib/referentiel-communaute"
import type { ZoneClimat } from "@/lib/terroir"
import { AppHeader, PageToolbar } from "@/components/shell/AppHeader"

interface Espece {
  id: string
  nom: string | null
  type: string
  famille: { id: string } | null
}

interface ITPData {
  id: string
  nom: string | null
  userId: string | null
  especeId: string | null
  semaineSemis: number | null
  semainePlantation: number | null
  semaineRecolte: number | null
  semaineImplantationDebut: number | null
  semaineImplantationFin: number | null
  semaineRecolteFin: number | null
  dureeRecolte: number | null
  dureePepiniere: number | null
  dureeCulture: number | null
  nbRangs: number | null
  espacement: number | null
  notes: string | null
  typePlanche: string | null
  decalageMax: number | null
  espacementRangs: number | null
  nbGrainesPlant: number | null
  doseSemis: number | null
  implantation: string | null
  forcage: boolean | null
  contexteClimatique: string | null
  sourceReference: string | null
  sourceUrl: string | null
  sourceRecordId: string | null
  sourceVersion: string | null
  actif: boolean
  zoneClimat: string | null
  sourceLicence: string | null
  statutValidation: string
  derniereRevision: string | null
  commentaireAgronome: string | null
  delaiPremiereRecolteAnnees: number | null
  espece: { id: string; famille: { id: string } | null } | null
  _count: { cultures: number; rotationsDetails: number }
}

export default function EditITPPage() {
  const router = useRouter()
  const params = useParams()
  const id = decodeURIComponent(params.id as string)
  const { toast } = useToast()
  const { data: session } = useSession()

  const [isLoading, setIsLoading] = React.useState(true)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [especes, setEspeces] = React.useState<Espece[]>([])
  // Zone de l'exploitation : sert à dire, sous les semaines de la source, ce
  // que la planification appliquera réellement (une seule vérité, énoncée).
  const [zoneUser, setZoneUser] = React.useState<ZoneClimat | null>(null)
  const [itpData, setItpData] = React.useState<ITPData | null>(null)

  const form = useForm<UpdateITPInput>({
    resolver: zodResolver(updateITPSchema),
  })

  // Charger les especes et l'ITP
  React.useEffect(() => {
    async function loadData() {
      try {
        const [especesRes, itpRes, climatRes] = await Promise.all([
          fetch("/api/especes?pageSize=500"),
          fetch(`/api/itps/${encodeURIComponent(id)}`),
          fetch("/api/calendrier-climat"),
        ])

        if (climatRes.ok) {
          const climat = await climatRes.json()
          setZoneUser((climat?.zone ?? null) as ZoneClimat | null)
        }

        if (especesRes.ok) {
          const especesData = await especesRes.json()
          setEspeces(especesData.data)
        }

        if (!itpRes.ok) {
          throw new Error("ITP non trouve")
        }

        const itp: ITPData = await itpRes.json()
        setItpData(itp)

        // Remplir le formulaire
        form.reset({
          nom: itp.nom ?? itp.id,
          especeId: itp.especeId,
          semaineSemis: itp.semaineSemis,
          semainePlantation: itp.semainePlantation,
          semaineRecolte: itp.semaineRecolte,
          semaineImplantationDebut: itp.semaineImplantationDebut,
          semaineImplantationFin: itp.semaineImplantationFin,
          semaineRecolteFin: itp.semaineRecolteFin,
          dureeRecolte: itp.dureeRecolte,
          dureePepiniere: itp.dureePepiniere,
          dureeCulture: itp.dureeCulture,
          nbRangs: itp.nbRangs,
          espacement: itp.espacement,
          notes: itp.notes,
          typePlanche: itp.typePlanche,
          decalageMax: itp.decalageMax,
          espacementRangs: itp.espacementRangs,
          nbGrainesPlant: itp.nbGrainesPlant,
          doseSemis: itp.doseSemis,
          implantation: itp.implantation,
          forcage: itp.forcage,
          contexteClimatique: itp.contexteClimatique,
          delaiPremiereRecolteAnnees: itp.delaiPremiereRecolteAnnees,
        })
      } catch {
        toast({
          variant: "destructive",
          title: "Erreur",
          description: "Impossible de charger l'ITP",
        })
        router.push("/maraichage/itps")
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [id, form, toast, router])

  const onSubmit = async (data: UpdateITPInput, event?: React.BaseSyntheticEvent) => {
    setIsSubmitting(true)
    try {
      // QA cmswxy73g — même filet qu'à la création : le <select> natif caché de
      // Radix fait foi si l'état React n'a pas reçu le choix d'espèce.
      const formulaire = event?.target
      const especeSoumise =
        formulaire instanceof HTMLFormElement
          ? String(new FormData(formulaire).get("especeId") || "").trim()
          : ""
      const payload: UpdateITPInput = {
        ...data,
        especeId:
          data.especeId ?? (especeSoumise && especeSoumise !== "_none" ? especeSoumise : null),
      }
      const response = await fetch(`/api/itps/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erreur lors de la mise a jour")
      }

      const maj = await response.json().catch(() => null)
      const doublon = maj?.doublonPotentiel as { id: string; nom: string } | undefined
      // On nomme l'itinéraire, pas son identifiant technique : pour un ITP
      // personnel, `id` est un cuid opaque qui ne dit rien à personne.
      const libelle = payload.nom ?? itpData?.nom ?? id
      toast({
        title: "Itinéraire mis à jour",
        description:
          `« ${libelle} » a été modifié.` +
          (doublon
            ? ` Attention : « ${doublon.nom} » porte désormais le même nom dans le catalogue visible.`
            : ""),
      })
      router.push("/maraichage/itps")
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error instanceof Error ? error.message : "Erreur lors de la mise à jour",
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleDelete = async () => {
    if (!itpData) return

    if (itpData._count.cultures > 0 || itpData._count.rotationsDetails > 0) {
      toast({
        variant: "destructive",
        title: "Impossible de supprimer",
        description: `Cet ITP est utilise dans ${itpData._count.cultures} culture(s) et ${itpData._count.rotationsDetails} rotation(s)`,
      })
      return
    }

    if (!(await confirmDialog(`Supprimer l'ITP "${id}" ?`))) return

    try {
      const response = await fetch(`/api/itps/${encodeURIComponent(id)}`, {
        method: "DELETE",
      })

      if (!response.ok) {
        throw new Error("Erreur lors de la suppression")
      }

      toast({
        title: "ITP supprime",
        description: `L'ITP "${id}" a été supprimé`,
      })
      router.push("/maraichage/itps")
    } catch {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible de supprimer l'ITP",
      })
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader current="maraichage" showLune />
        <PageToolbar>
          <Skeleton className="h-8 w-64" />
        </PageToolbar>
        <main className="container mx-auto px-4 py-6 max-w-3xl space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-32 w-full" />
        </main>
      </div>
    )
  }

  const currentUserId = (session?.user as { id?: string } | undefined)?.id
  const decalageAffiche = itpData
    ? decalageItpPourLecteur(itpData, zoneUser, currentUserId ?? null)
    : 0
  const canEdit =
    !itpData?.sourceRecordId &&
    (session?.user?.role === "ADMIN" ||
      (!!itpData?.userId && !!currentUserId && itpData.userId === currentUserId))

  return (
    <div className="min-h-screen bg-slate-50 aurora-bg-subtle">
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" aria-hidden="true" />
      <AppHeader current="maraichage" showLune />
      <PageToolbar>
        <div className="flex items-center gap-4">
          <Link href="/maraichage/itps">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              ITPs
            </Button>
          </Link>
          <div className="flex items-center gap-2">
            <Route className="h-6 w-6 text-indigo-600" />
            <h1 className="text-xl font-bold">{itpData ? nomAffichableItp(itpData) : id}</h1>
            {itpData &&
              (() => {
                const badge = badgeOrigine(itpData, currentUserId)
                return badge ? (
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${badge.cls}`}>
                    {badge.label}
                  </span>
                ) : null
              })()}
          </div>
        </div>
        {itpData && (
          <div className="flex items-center gap-2">
            <Badge variant="outline">
              {itpData._count.rotationsDetails} rotation(s)
            </Badge>
            <Badge variant="outline">
              {itpData._count.cultures} culture(s)
            </Badge>
          </div>
        )}
      </PageToolbar>

      {/* Content */}
      <main className="container mx-auto px-4 py-6 max-w-3xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            {itpData?.sourceReference && (
              <Card
                className={
                  itpData.statutValidation === "source_documentee"
                    ? "border-emerald-200 bg-emerald-50/50"
                    : "border-amber-200 bg-amber-50/50"
                }
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    {itpData.statutValidation === "source_documentee" ? (
                      <ShieldCheck className="h-5 w-5 text-emerald-700" />
                    ) : (
                      <AlertTriangle className="h-5 w-5 text-amber-700" />
                    )}
                    Provenance agronomique
                  </CardTitle>
                  <CardDescription>
                    {itpData.statutValidation === "source_documentee"
                      ? "Scénario directement documenté par la source ci-dessous."
                      : "Repère conservé, mais encore à confirmer par une source ligne par ligne."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p>{itpData.sourceReference}</p>
                  <div className="flex flex-wrap gap-2">
                    {itpData.contexteClimatique && (
                      <Badge variant="outline">Climat source : {itpData.contexteClimatique}</Badge>
                    )}
                    {itpData.sourceVersion && (
                      <Badge variant="outline">Version {itpData.sourceVersion}</Badge>
                    )}
                    {itpData.sourceLicence && (
                      <Badge variant="outline">{itpData.sourceLicence}</Badge>
                    )}
                  </div>
                  {itpData.sourceUrl && (
                    <a
                      href={itpData.sourceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 font-medium text-emerald-700 hover:underline"
                    >
                      Ouvrir la publication source
                      <ExternalLink className="h-4 w-4" />
                    </a>
                  )}
                  <div className="border-t pt-3 text-xs text-muted-foreground">
                    {itpData.sourceRecordId && <p>Ligne stable : {itpData.sourceRecordId}</p>}
                    {itpData.derniereRevision && (
                      <p>
                        Intégration révisée le{" "}
                        {new Date(itpData.derniereRevision).toLocaleDateString("fr-FR")}
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {itpData && !itpData.actif && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
                <p className="font-medium">Itinéraire retiré du service</p>
                <p className="mt-1">
                  Les semaines publiées par la source sortent de l&apos;intervalle ISO 1–52 : cet
                  itinéraire est conservé pour audit mais n&apos;est plus proposé à la planification
                  ni à la création d&apos;une culture.
                </p>
              </div>
            )}

            {!canEdit && itpData && (
              <div className="rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-600">
                {/* Le message annonçait « Cette référence officielle » pour TOUT
                    itinéraire non modifiable — donc aussi pour la contribution
                    d'un autre membre, présentée au lecteur comme une référence
                    du catalogue. */}
                {origineReferentiel(itpData, currentUserId) === 'communaute'
                  ? "Itinéraire proposé par un membre de la communauté : consultable, non vérifié par Gleba et non modifiable ici. Créez votre propre itinéraire pour l'adapter à votre ferme."
                  : "Référence du catalogue Gleba : consultable mais non modifiable. Créez un ITP personnel pour l'adapter à votre ferme."}
              </div>
            )}

            <fieldset disabled={!canEdit} className="space-y-6 disabled:opacity-90">
            {/* Identification */}
            <Card>
              <CardHeader>
                <CardTitle>Identification</CardTitle>
                <CardDescription>Nom affiché et espèce associée</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-3 bg-slate-100 rounded-md">
                  <span className="text-sm text-slate-500">Identifiant technique : </span>
                  <span className="font-medium">{id}</span>
                </div>

                {/* Le nom est un affichage, pas une clé : il reste corrigeable
                    sans toucher à l'identifiant, qui porte les cultures et les
                    rotations déjà rattachées. */}
                <FormField
                  control={form.control}
                  name="nom"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Nom</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="Nom de l'itinéraire"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormDescription>
                        Tel qu&apos;il apparaîtra partout dans l&apos;application. Corriger le nom ne
                        casse aucune culture ni aucune rotation.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="especeId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Espèce</FormLabel>
                      <Select
                        name="especeId"
                        onValueChange={(value) => field.onChange(value === "_none" ? null : value)}
                        value={field.value || "_none"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner une espèce" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="_none">Aucune</SelectItem>
                          {especes.map((espece) => (
                            <SelectItem key={espece.id} value={espece.id}>
                              {espece.nom ?? espece.id} {espece.famille ? `(${espece.famille.id})` : ""}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>

            {/* Calendrier */}
            <Card>
              <CardHeader>
                <CardTitle>Calendrier</CardTitle>
                <CardDescription>
                  Semaines de semis, plantation et récolte (1-52), telles que les donne la source
                  {itpData?.zoneClimat ? ` (climat de calage : ${labelZone(itpData.zoneClimat as ZoneClimat)})` : ""}
                </CardDescription>
                {decalageAffiche !== 0 && (
                  <p className="mt-2 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
                    Dans votre zone ({labelZone(zoneUser)}), la planification et la création
                    d&apos;une culture utilisent{" "}
                    {[
                      itpData?.semaineSemis
                        ? `semis S${decalerSemaine(itpData.semaineSemis, decalageAffiche)}`
                        : null,
                      itpData?.semainePlantation
                        ? `plantation S${decalerSemaine(itpData.semainePlantation, decalageAffiche)}`
                        : null,
                      itpData?.semaineRecolte
                        ? `récolte S${decalerSemaine(itpData.semaineRecolte, decalageAffiche)}`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}{" "}
                    ({decalageAffiche > 0 ? "+" : "−"}
                    {Math.abs(decalageAffiche)} semaine
                    {Math.abs(decalageAffiche) > 1 ? "s" : ""}).
                  </p>
                )}
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="semaineSemis"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Semaine semis</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={52}
                            placeholder="1-52"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="semainePlantation"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Semaine plantation</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={52}
                            placeholder="1-52"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="semaineRecolte"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Semaine récolte</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={52}
                            placeholder="1-52"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
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
                    name="semaineImplantationDebut"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Début fenêtre d&apos;implantation</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={52}
                            placeholder="1-52"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(e.target.value ? parseInt(e.target.value) : null)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="semaineImplantationFin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fin fenêtre d&apos;implantation</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={52}
                            placeholder="1-52"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(e.target.value ? parseInt(e.target.value) : null)
                            }
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="semaineRecolteFin"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fin fenêtre de récolte</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={52}
                            placeholder="1-52"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) =>
                              field.onChange(e.target.value ? parseInt(e.target.value) : null)
                            }
                          />
                        </FormControl>
                        <FormDescription>
                          La semaine de récolte ci-dessus est le début de fenêtre.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="dureeRecolte"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Durée récolte (semaines)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            max={52}
                            placeholder="Ex: 4"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="decalageMax"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Décalage max (semaines)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            max={52}
                            placeholder="Flexibilité"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                          />
                        </FormControl>
                        <FormDescription>Flexibilité de planification</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Durees */}
            <Card>
              <CardHeader>
                <CardTitle>Durées</CardTitle>
                <CardDescription>Durées en jours</CardDescription>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="dureePepiniere"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Durée pépinière (jours)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min={0}
                          max={365}
                          placeholder="Jours en pépinière"
                          {...field}
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                        />
                      </FormControl>
                      <FormDescription>Entre semis et plantation</FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="dureeCulture"
                  render={({ field }) => {
                    // Bug feedback testeur 2026-05-25 (cmpljz6s9) — pour
                    // détecter l'incohérence entre Durée culture et les
                    // semaines plantation/récolte, on calcule l'écart en
                    // jours et on l'affiche en aide.
                    const sP = form.watch("semainePlantation")
                    const sR = form.watch("semaineRecolte")
                    let diffJours: number | null = null
                    if (sP && sR) {
                      const semaines = sR > sP ? sR - sP : (52 - sP) + sR
                      diffJours = semaines * 7
                    }
                    const ecartImportant =
                      diffJours !== null &&
                      typeof field.value === "number" &&
                      Math.abs(field.value - diffJours) > 14
                    return (
                      <FormItem>
                        <FormLabel>Durée culture (jours)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            max={365}
                            placeholder="Jours en planche"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                          />
                        </FormControl>
                        <FormDescription>
                          Entre plantation et fin.
                          {diffJours !== null && (
                            <span className={ecartImportant ? "text-amber-600 font-medium block mt-1" : "block mt-1"}>
                              {ecartImportant ? "⚠ " : ""}
                              Plantation→récolte ≈ {diffJours} j (S{sP}→S{sR}).
                              {ecartImportant && " La durée culture saisie diverge — vérifier."}
                            </span>
                          )}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )
                  }}
                />
              </CardContent>
            </Card>

            {/* Parametres de plantation */}
            <Card>
              <CardHeader>
                <CardTitle>Paramètres de plantation</CardTitle>
                <CardDescription>Configuration des rangs et espacements</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="typePlanche"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Type de planche</FormLabel>
                      <Select
                        onValueChange={(value) => field.onChange(value === "_none" ? null : value)}
                        value={field.value || "_none"}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="_none">Non spécifié</SelectItem>
                          {ITP_TYPE_PLANCHE.map((t) => (
                            <SelectItem key={t} value={t}>
                              {t}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-3 gap-4">
                  <FormField
                    control={form.control}
                    name="nbRangs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nombre de rangs</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={20}
                            placeholder="Rangs par planche"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="espacement"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Espacement plants (cm)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={200}
                            step={0.5}
                            placeholder="Sur le rang"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="espacementRangs"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Espacement rangs (cm)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={1}
                            max={200}
                            placeholder="Entre rangs"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? parseInt(e.target.value) : null)}
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
                    name="nbGrainesPlant"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Graines par plant</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step={0.1}
                            placeholder="Ex: 2"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                          />
                        </FormControl>
                        <FormDescription>Pour calcul semences</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="doseSemis"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Dose semis (g/m2)</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min={0}
                            step={0.1}
                            placeholder="Ex: 3"
                            {...field}
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : null)}
                          />
                        </FormControl>
                        <FormDescription>Semis direct</FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Notes */}
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
                          placeholder="Notes, conseils, particularites..."
                          className="min-h-[100px]"
                          {...field}
                          value={field.value ?? ""}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
            </fieldset>

            {/* Actions */}
            <div className="flex justify-between">
              {canEdit ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={handleDelete}
                  disabled={!itpData || itpData._count.cultures > 0 || itpData._count.rotationsDetails > 0}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </Button>
              ) : <span />}
              <div className="flex gap-4">
                <Link href="/maraichage/itps">
                  <Button variant="outline" type="button">
                    {canEdit ? "Annuler" : "Retour"}
                  </Button>
                </Link>
                {canEdit && (
                  <Button type="submit" disabled={isSubmitting}>
                    <Save className="h-4 w-4 mr-2" />
                    {isSubmitting ? "Enregistrement..." : "Enregistrer"}
                  </Button>
                )}
              </div>
            </div>
          </form>
        </Form>
      </main>
    </div>
  )
}
