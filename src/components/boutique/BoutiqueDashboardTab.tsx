"use client"

/**
 * Tableau de bord boutique : KPI ventes, calendrier de préparation, top produits, alertes stock.
 */

import * as React from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import {
  Euro,
  ShoppingBag,
  TrendingUp,
  Clock,
  CalendarClock,
  Package,
  AlertTriangle,
  Trophy,
  XCircle,
  ArrowRight,
  Lightbulb,
} from "lucide-react"

interface Stats {
  kpi: {
    ca: { jour: number; semaine: number; mois: number; annee: number }
    commandes: { jour: number; semaine: number; mois: number; annee: number }
    panierMoyen: number
    enAttente: number
  }
  preparation: Array<{
    date: string
    dateLabel: string
    commandes: number
    total: number
    produits: Array<{ nom: string; unite: string; quantite: number }>
  }>
  topProduits: Array<{ nom: string; unite: string; quantite: number; total: number; count: number }>
  stockBas: Array<{ id: number; nom: string; stockDispo: number; unite: string; categorie: string | null }>
  ruptures: Array<{ id: number; nom: string; categorie: string | null }>
}

export function BoutiqueDashboardTab() {
  const [stats, setStats] = React.useState<Stats | null>(null)
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    fetch("/api/boutique/stats")
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setStats(d))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div className="text-center py-12 text-muted-foreground">Chargement...</div>
  }
  if (!stats) {
    return <div className="text-center py-12 text-muted-foreground">Erreur de chargement</div>
  }

  const eur = (n: number) =>
    n.toLocaleString("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 2 })

  return (
    <div className="space-y-6">
      {/* KPI */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3">Indicateurs de vente</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">CA aujourd'hui</p>
                  <p className="text-2xl font-bold text-teal-700">{eur(stats.kpi.ca.jour)}</p>
                  <p className="text-xs text-muted-foreground">{stats.kpi.commandes.jour} commande{stats.kpi.commandes.jour > 1 ? "s" : ""}</p>
                </div>
                <Euro className="h-8 w-8 text-teal-300" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">CA 7 jours</p>
                  <p className="text-2xl font-bold text-emerald-700">{eur(stats.kpi.ca.semaine)}</p>
                  <p className="text-xs text-muted-foreground">{stats.kpi.commandes.semaine} commande{stats.kpi.commandes.semaine > 1 ? "s" : ""}</p>
                </div>
                <TrendingUp className="h-8 w-8 text-emerald-300" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">CA mois en cours</p>
                  <p className="text-2xl font-bold text-amber-700">{eur(stats.kpi.ca.mois)}</p>
                  <p className="text-xs text-muted-foreground">{stats.kpi.commandes.mois} commande{stats.kpi.commandes.mois > 1 ? "s" : ""}</p>
                </div>
                <ShoppingBag className="h-8 w-8 text-amber-300" />
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Panier moyen ({new Date().getFullYear()})</p>
                  <p className="text-2xl font-bold text-blue-700">{eur(stats.kpi.panierMoyen)}</p>
                  <p className="text-xs text-muted-foreground">{eur(stats.kpi.ca.annee)} sur l&apos;année</p>
                  <Link
                    href="/comptabilite/transactions?module=boutique"
                    className="text-[11px] text-blue-600 hover:text-blue-800 underline inline-flex items-center gap-0.5 mt-1"
                  >
                    Voir dans la comptabilité <ArrowRight className="h-3 w-3" />
                  </Link>
                </div>
                <Trophy className="h-8 w-8 text-blue-300" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Indicateur de cohérence Boutique <-> Compta */}
        <div className="mt-3 flex items-start gap-2 text-xs text-muted-foreground px-1">
          <Lightbulb className="h-3.5 w-3.5 text-amber-500 mt-0.5 flex-shrink-0" />
          <p>
            Les commandes au statut « livrée » sont automatiquement comptées dans votre{' '}
            <Link
              href="/comptabilite/transactions"
              className="text-blue-600 hover:text-blue-800 underline"
            >
              comptabilité
            </Link>
            .
          </p>
        </div>
      </div>

      {/* Alerte commandes en attente */}
      {stats.kpi.enAttente > 0 && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 flex items-center gap-3">
            <Clock className="h-5 w-5 text-amber-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-900">
                {stats.kpi.enAttente} commande{stats.kpi.enAttente > 1 ? "s" : ""} en attente de confirmation
              </p>
              <p className="text-xs text-amber-700">
                Passez-les en "Confirmée" depuis l'onglet Commandes après contact client.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* À préparer cette semaine */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
          <CalendarClock className="h-4 w-4" />
          À préparer dans les 7 prochains jours
        </h3>
        {stats.preparation.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-sm text-muted-foreground">
              Aucune commande à préparer pour le moment.
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {stats.preparation.map((day) => (
              <Card key={day.date}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <p className="font-semibold capitalize">{day.dateLabel}</p>
                      <p className="text-xs text-muted-foreground">
                        {day.commandes} commande{day.commandes > 1 ? "s" : ""} · {eur(day.total)}
                      </p>
                    </div>
                    <Badge variant="secondary">{day.produits.length} reference{day.produits.length > 1 ? "s" : ""}</Badge>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                    {day.produits.map((p, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between bg-slate-50 px-3 py-2 rounded-lg border text-sm"
                      >
                        <span className="truncate">{p.nom}</span>
                        <span className="font-semibold text-teal-700 ml-2 whitespace-nowrap">
                          {p.quantite} {p.unite}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Top produits + Alertes stock côte à côte */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top produits */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <Trophy className="h-4 w-4" />
            Top produits (30 derniers jours)
          </h3>
          <Card>
            <CardContent className="p-0">
              {stats.topProduits.length === 0 ? (
                <p className="p-6 text-center text-sm text-muted-foreground">Aucune vente sur les 30 derniers jours</p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {stats.topProduits.map((p, idx) => (
                      <tr key={idx} className="border-b last:border-0 hover:bg-slate-50">
                        <td className="p-3 w-8 text-center text-muted-foreground">{idx + 1}</td>
                        <td className="p-3">
                          <p className="font-medium">{p.nom}</p>
                          <p className="text-xs text-muted-foreground">
                            {p.quantite} {p.unite} · {p.count} commande{p.count > 1 ? "s" : ""}
                          </p>
                        </td>
                        <td className="p-3 text-right font-semibold text-teal-700 whitespace-nowrap">
                          {eur(p.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Alertes stock */}
        <div>
          <h3 className="text-sm font-medium text-muted-foreground mb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            Alertes stock
          </h3>
          <div className="space-y-2">
            {stats.ruptures.length > 0 && (
              <Card className="border-red-200 bg-red-50">
                <CardContent className="p-4">
                  <p className="text-sm font-medium text-red-900 mb-2 flex items-center gap-2">
                    <XCircle className="h-4 w-4" />
                    {stats.ruptures.length} rupture{stats.ruptures.length > 1 ? "s" : ""} de stock
                  </p>
                  <div className="space-y-1 text-xs">
                    {stats.ruptures.map((p) => (
                      <div key={p.id} className="flex items-center justify-between text-red-700">
                        <span>{p.nom}</span>
                        {p.categorie && <Badge variant="outline" className="text-[10px]">{p.categorie}</Badge>}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
            {stats.stockBas.length > 0 ? (
              <Card className="border-amber-200 bg-amber-50">
                <CardContent className="p-4">
                  <p className="text-sm font-medium text-amber-900 mb-2 flex items-center gap-2">
                    <Package className="h-4 w-4" />
                    Stock bas ({stats.stockBas.length})
                  </p>
                  <div className="space-y-1 text-xs">
                    {stats.stockBas.map((p) => (
                      <div key={p.id} className="flex items-center justify-between text-amber-800">
                        <span>{p.nom}</span>
                        <Badge variant="outline" className="text-[10px] bg-white">
                          {p.stockDispo} {p.unite}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            ) : (
              stats.ruptures.length === 0 && (
                <Card>
                  <CardContent className="p-6 text-center text-sm text-muted-foreground">
                    ✓ Tous les stocks sont au-dessus du seuil d'alerte
                  </CardContent>
                </Card>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
