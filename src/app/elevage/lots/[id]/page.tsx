"use client"

/**
 * QA Julien 2026-05-15 — Bug #11 : fiche lot (v1 minimale).
 *
 * Header : nom, espèce de base, race-ish (espèce affichée), date arrivée,
 * effectif, parcelle. Tab Animaux : liste avec identifiants, race, sexe,
 * statut, poids.
 *
 * v2 (ticket à créer) : onglets Production (œufs/lait), Soins, KPI lot,
 * ajout/sortie d'animal.
 */

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useParams, useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import {
  ArrowLeft,
  Bird,
  Calendar,
  Map as MapIcon,
  Settings,
  Users,
  Wallet,
  TrendingDown,
  TrendingUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { UserMenu } from "@/components/auth/UserMenu"
import { ModulesNav } from "@/components/auth/ModulesNav"
import { especeBaseLabel } from "@/lib/elevage/espece-base"

interface AnimalLite {
  id: number
  identifiant: string | null
  nom: string | null
  race: string | null
  sexe: string | null
  statut: string
  poidsActuel: number | null
  dateNaissance: string | null
  especeAnimale: { id: string; nom: string; couleur: string | null }
}

interface LotDetail {
  id: number
  nom: string | null
  statut: string
  dateArrivee: string | null
  quantiteInitiale: number
  quantiteActuelle: number
  effectifReel: number
  animauxNominatifsActifs: number
  effectifCollectif: number
  provenance: string | null
  prixAchatTotal: number | null
  prixAchatParAnimal: number | null
  notes: string | null
  especeAnimale: { id: string; nom: string; type: string; couleur: string | null }
  parcelleGeo: { id: string; nom: string } | null
  animaux: AnimalLite[]
  mouvementsEconomiques: Array<{
    id: string
    date: string
    type: "depense" | "recette"
    libelle: string
    montant: number
  }>
  totauxEconomiques: { depenses: number; recettes: number }
  _count: { animaux: number; productionsOeufs: number; soins: number }
}

const STATUT_COLORS: Record<string, string> = {
  actif: "bg-green-100 text-green-800",
  vendu: "bg-blue-100 text-blue-800",
  abattu: "bg-amber-100 text-amber-800",
  mort: "bg-red-100 text-red-800",
}

const euro = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" })

export default function LotDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { data: session } = useSession()
  const lotId = params.id as string

  const [lot, setLot] = React.useState<LotDetail | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const res = await fetch(`/api/elevage/lots/${lotId}`)
        if (!res.ok) {
          setError(res.status === 404 ? "Lot introuvable" : "Erreur de chargement")
          return
        }
        const json = await res.json()
        if (!cancelled) setLot(json.data)
      } catch {
        if (!cancelled) setError("Erreur réseau")
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [lotId])

  return (
    <div className="min-h-screen bg-slate-50 aurora-bg-subtle">
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" aria-hidden="true" />

      {/* Header global */}
      <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-2.5 flex items-center justify-between gap-2 max-w-[1600px]">
          <Link href="/" className="flex items-center hover:opacity-90 transition-opacity">
            <Image src="/gleba-logo.png" alt="Gleba" width={120} height={80} className="h-10 w-auto rounded-lg" priority />
          </Link>
          <div className="flex items-center gap-2">
            <ModulesNav current="elevage" />
            <Link href="/parametres">
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
            {session?.user && <UserMenu user={session.user} />}
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-[1600px] space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => router.push("/elevage?tab=animaux")}>
            <ArrowLeft className="h-4 w-4 mr-1" />
            Retour
          </Button>
        </div>

        {isLoading ? (
          <>
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-64 w-full" />
          </>
        ) : error ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">{error}</CardContent>
          </Card>
        ) : lot ? (
          <>
            {/* Header lot */}
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Bird className="h-5 w-5 text-amber-600" />
                      <CardTitle className="text-2xl">{lot.nom || `Lot #${lot.id}`}</CardTitle>
                      <Badge className={STATUT_COLORS[lot.statut] || ""}>{lot.statut}</Badge>
                    </div>
                    <div className="text-sm text-muted-foreground flex items-center gap-3 flex-wrap">
                      <span className="flex items-center gap-1">
                        {lot.especeAnimale.couleur && (
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: lot.especeAnimale.couleur }} />
                        )}
                        {especeBaseLabel(lot.especeAnimale.id)} · <span className="text-slate-500">{lot.especeAnimale.nom}</span>
                      </span>
                      {lot.dateArrivee && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Depuis le {new Date(lot.dateArrivee).toLocaleDateString("fr-FR")}
                        </span>
                      )}
                      {lot.parcelleGeo && (
                        <Link href={`/jardin/carte?parcelle=${lot.parcelleGeo.id}`} className="flex items-center gap-1 text-amber-700 hover:underline">
                          <MapIcon className="h-3 w-3" />
                          {lot.parcelleGeo.nom}
                        </Link>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-3xl font-bold text-amber-700">{lot.effectifReel}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 justify-end">
                      <Users className="h-3 w-3" />
                      effectif actuel
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      sur {lot.quantiteInitiale} initiaux
                    </div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {lot.animauxNominatifsActifs} nominatif(s) · {lot.effectifCollectif} collectif(s)
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 space-y-1 text-sm">
                <p>
                  <span className="text-muted-foreground">Provenance :</span>{" "}
                  {lot.provenance || "Non renseignée"}
                </p>
                {lot.notes && <p className="text-muted-foreground italic">{lot.notes}</p>}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Wallet className="h-5 w-5 text-blue-600" />
                    Économie du lot
                  </CardTitle>
                  <Button asChild variant="outline" size="sm">
                    <Link href="/elevage/economie">Voir l&apos;analyse globale</Link>
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-lg border bg-slate-50 p-3">
                    <p className="text-xs text-muted-foreground">Prix d&apos;achat total</p>
                    <p className="text-xl font-semibold">
                      {lot.prixAchatTotal != null ? euro.format(lot.prixAchatTotal) : "Non renseigné"}
                    </p>
                  </div>
                  <div className="rounded-lg border bg-slate-50 p-3">
                    <p className="text-xs text-muted-foreground">Prix par animal à l&apos;achat</p>
                    <p className="text-xl font-semibold">
                      {lot.prixAchatParAnimal != null ? euro.format(lot.prixAchatParAnimal) : "Non calculable"}
                    </p>
                    <p className="text-xs text-muted-foreground">sur {lot.quantiteInitiale} animal(aux) initiaux</p>
                  </div>
                  <div className="rounded-lg border bg-red-50 p-3">
                    <p className="flex items-center gap-1 text-xs text-red-700">
                      <TrendingDown className="h-3.5 w-3.5" />
                      Dépenses liées
                    </p>
                    <p className="text-xl font-semibold text-red-700">{euro.format(lot.totauxEconomiques.depenses)}</p>
                  </div>
                  <div className="rounded-lg border bg-emerald-50 p-3">
                    <p className="flex items-center gap-1 text-xs text-emerald-700">
                      <TrendingUp className="h-3.5 w-3.5" />
                      Recettes liées
                    </p>
                    <p className="text-xl font-semibold text-emerald-700">{euro.format(lot.totauxEconomiques.recettes)}</p>
                  </div>
                </div>

                <div className="rounded-lg border">
                  <div className="border-b px-3 py-2 text-sm font-medium">Mouvements économiques</div>
                  {lot.mouvementsEconomiques.length === 0 ? (
                    <p className="p-4 text-sm text-muted-foreground">
                      Aucun mouvement comptable lié à ce lot.
                    </p>
                  ) : (
                    <ul className="divide-y">
                      {lot.mouvementsEconomiques.map((mouvement) => (
                        <li key={mouvement.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 text-sm">
                          <span className="w-24 text-xs text-muted-foreground">
                            {new Date(mouvement.date).toLocaleDateString("fr-FR")}
                          </span>
                          <span className="min-w-0 flex-1">{mouvement.libelle}</span>
                          <span className={`font-semibold ${mouvement.type === "recette" ? "text-emerald-700" : "text-red-700"}`}>
                            {mouvement.type === "recette" ? "+" : "−"} {euro.format(mouvement.montant)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Animaux du lot */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Animaux du lot ({lot.animaux.length})</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                {lot.animaux.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Aucun animal nominatif dans ce lot (lot anonyme / cheptel collectif).
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Identifiant</TableHead>
                        <TableHead>Nom</TableHead>
                        <TableHead>Race</TableHead>
                        <TableHead>Sexe</TableHead>
                        <TableHead>Statut</TableHead>
                        <TableHead className="text-right">Poids</TableHead>
                        <TableHead>Né le</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {lot.animaux.map((a) => (
                        <TableRow
                          key={a.id}
                          className="cursor-pointer hover:bg-muted/50"
                          onClick={() => router.push(`/elevage/animaux/${a.id}`)}
                        >
                          <TableCell className="font-medium">{a.identifiant || "-"}</TableCell>
                          <TableCell>{a.nom || "-"}</TableCell>
                          <TableCell>{a.race || "-"}</TableCell>
                          <TableCell>{a.sexe === "femelle" ? "♀" : a.sexe === "male" ? "♂" : "-"}</TableCell>
                          <TableCell>
                            <Badge className={STATUT_COLORS[a.statut] || ""}>{a.statut}</Badge>
                          </TableCell>
                          <TableCell className="text-right">{a.poidsActuel ? `${a.poidsActuel} kg` : "-"}</TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            {a.dateNaissance ? new Date(a.dateNaissance).toLocaleDateString("fr-FR") : "-"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>

          </>
        ) : null}
      </main>
    </div>
  )
}
