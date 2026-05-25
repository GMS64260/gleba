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
  provenance: string | null
  prixAchatTotal: number | null
  notes: string | null
  especeAnimale: { id: string; nom: string; type: string; couleur: string | null }
  parcelleGeo: { id: string; nom: string } | null
  animaux: AnimalLite[]
  _count: { animaux: number; productionsOeufs: number; soins: number }
}

const STATUT_COLORS: Record<string, string> = {
  actif: "bg-green-100 text-green-800",
  vendu: "bg-blue-100 text-blue-800",
  abattu: "bg-amber-100 text-amber-800",
  mort: "bg-red-100 text-red-800",
}

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
                  </div>
                </div>
              </CardHeader>
              {(lot.provenance || lot.notes) && (
                <CardContent className="pt-0 space-y-1 text-sm">
                  {lot.provenance && <p><span className="text-muted-foreground">Provenance :</span> {lot.provenance}</p>}
                  {lot.notes && <p className="text-muted-foreground italic">{lot.notes}</p>}
                </CardContent>
              )}
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
