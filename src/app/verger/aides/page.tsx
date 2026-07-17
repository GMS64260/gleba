"use client"

/**
 * Page Aides à la plantation forestière
 * Catalogue éditorial des dispositifs d'aide.
 */

import * as React from "react"
import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  ArrowLeft,
  ExternalLink,
  HelpCircle,
  Search,
  Building2,
  Globe,
  MapPin,
  Trees,
  Coins,
} from "lucide-react"
import { AIDES_PLANTATION, NIVEAU_LIBELLE, type DispositifAide } from "@/data/aides-plantation"
import { AppHeader, PageToolbar } from "@/components/shell/AppHeader"

const TYPES_LABEL: Record<string, string> = {
  forestier_futaie: "Futaie forestière",
  forestier_taillis: "Taillis forestier",
  agroforesterie: "Agroforesterie",
  haie: "Haie",
  verger: "Verger",
  bosquet: "Bosquet",
  maraichage: "Maraîchage",
  polyculture: "Polyculture",
}

const PUBLIC_LABEL: Record<string, string> = {
  particuliers: "Particuliers",
  agriculteurs: "Agriculteurs",
  collectivites: "Collectivités",
  tous: "Tous publics",
}

const NIVEAU_ICON: Record<DispositifAide["niveau"], React.ComponentType<{ className?: string }>> = {
  national: Globe,
  regional: MapPin,
  europeen: Globe,
  departemental: MapPin,
}

export default function AidesPage() {
  const [search, setSearch] = React.useState("")
  const [filterType, setFilterType] = React.useState<string>("all")
  const [filterNiveau, setFilterNiveau] = React.useState<string>("all")
  // PROMPT 13 — filtres AB & région
  const [filterCumulAB, setFilterCumulAB] = React.useState<"all" | "oui" | "non">("all")
  const [filterRegion, setFilterRegion] = React.useState<string>("all")

  // Liste dynamique des régions présentes dans le référentiel.
  const regionsDispo = React.useMemo(() => {
    const set = new Set<string>()
    for (const a of AIDES_PLANTATION) for (const r of a.regions ?? []) set.add(r)
    return [...set].sort()
  }, [])

  const aidesFiltrees = AIDES_PLANTATION.filter((a) => {
    if (!a.actif) return false
    if (filterType !== "all" && !a.typesEligibles.includes(filterType)) return false
    if (filterNiveau !== "all" && a.niveau !== filterNiveau) return false
    if (filterCumulAB === "oui" && !a.cumulAB) return false
    if (filterCumulAB === "non" && a.cumulAB) return false
    if (filterRegion !== "all") {
      // Si l'aide n'a pas de liste de régions, on la considère nationale
      // → toujours affichée. Sinon on filtre par région exacte.
      if (a.regions && a.regions.length > 0 && !a.regions.includes(filterRegion)) return false
    }
    if (search) {
      const s = search.toLowerCase()
      if (
        !a.nom.toLowerCase().includes(s) &&
        !a.organisme.toLowerCase().includes(s) &&
        !a.description.toLowerCase().includes(s)
      )
        return false
    }
    return true
  })

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader current="verger" />
      <PageToolbar>
        <div className="flex items-center gap-3">
          <Link href="/verger">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Retour Verger & Forêt
            </Button>
          </Link>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Coins className="h-5 w-5 text-amber-600" />
            Aides à la plantation
          </h1>
        </div>
      </PageToolbar>

      <main className="container mx-auto px-4 py-6 max-w-[1200px] space-y-6">
        {/* Intro */}
        <Card>
          <CardContent className="p-4">
            <div className="flex gap-3">
              <HelpCircle className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium mb-1">Comment financer votre plantation ?</p>
                <p className="text-muted-foreground">
                  Catalogue des principaux dispositifs d'aide à la plantation forestière, agroforestière, bocagère et fruitière en France.
                  Les conditions évoluent régulièrement : consultez toujours le site de l'organisme avant de monter un dossier.
                  De nombreuses aides sont cumulables (national + régional).
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Note : les montants et taux indiqués sont donnés à titre indicatif et peuvent varier selon votre situation.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Filtres */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher une aide..."
              className="pl-8 h-9"
            />
          </div>
          <Select value={filterType} onValueChange={setFilterType}>
            <SelectTrigger className="w-[200px] h-9">
              <SelectValue placeholder="Type de projet" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous types</SelectItem>
              {Object.entries(TYPES_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterNiveau} onValueChange={setFilterNiveau}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Niveau" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tous niveaux</SelectItem>
              <SelectItem value="national">National</SelectItem>
              <SelectItem value="regional">Régional</SelectItem>
              <SelectItem value="europeen">Européen</SelectItem>
              <SelectItem value="departemental">Départemental</SelectItem>
            </SelectContent>
          </Select>
          {/* PROMPT 13 — Filtres AB & région */}
          <Select value={filterCumulAB} onValueChange={(v) => setFilterCumulAB(v as "all" | "oui" | "non")}>
            <SelectTrigger className="w-[180px] h-9">
              <SelectValue placeholder="Cumul AB" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Cumul AB : tous</SelectItem>
              <SelectItem value="oui">Cumulable AB</SelectItem>
              <SelectItem value="non">Non cumulable AB</SelectItem>
            </SelectContent>
          </Select>
          {regionsDispo.length > 0 && (
            <Select value={filterRegion} onValueChange={setFilterRegion}>
              <SelectTrigger className="w-[180px] h-9">
                <SelectValue placeholder="Région" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes régions</SelectItem>
                {regionsDispo.map((r) => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Badge variant="outline" className="ml-auto">{aidesFiltrees.length} aide{aidesFiltrees.length > 1 ? "s" : ""}</Badge>
        </div>

        {/* Liste des aides */}
        <div className="space-y-3">
          {aidesFiltrees.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Aucune aide ne correspond à vos critères.
              </CardContent>
            </Card>
          ) : (
            aidesFiltrees.map((aide) => {
              const NivIcon = NIVEAU_ICON[aide.niveau]
              return (
                <Card key={aide.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-5 space-y-3">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold text-lg">{aide.nom}</h3>
                        <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
                          <Building2 className="h-3.5 w-3.5" />
                          {aide.organisme}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <Badge variant="outline">
                          <NivIcon className="h-3 w-3 mr-1" />
                          {NIVEAU_LIBELLE[aide.niveau]}
                        </Badge>
                        <Badge variant="secondary">{PUBLIC_LABEL[aide.publicCible] || aide.publicCible}</Badge>
                        {/* PROMPT 13 — Badge AB-compatible */}
                        {aide.abCompatible && (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200">
                            🌱 AB-compatible
                          </Badge>
                        )}
                      </div>
                    </div>

                    {/* Types éligibles */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <Trees className="h-3.5 w-3.5 text-muted-foreground" />
                      {aide.typesEligibles.map((t) => (
                        <Badge key={t} variant="outline" className="text-xs">
                          {TYPES_LABEL[t] || t}
                        </Badge>
                      ))}
                    </div>

                    {/* Description */}
                    <p className="text-sm">{aide.description}</p>

                    {/* Taux / Plafond */}
                    {(aide.tauxAide || aide.plafond) && (
                      <div className="bg-amber-50 border border-amber-200 rounded-md p-3 space-y-1">
                        {aide.tauxAide && (
                          <p className="text-sm">
                            <span className="font-medium">Taux d'aide :</span> {aide.tauxAide}
                          </p>
                        )}
                        {aide.plafond && (
                          <p className="text-sm">
                            <span className="font-medium">Plafond :</span> {aide.plafond}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Conditions */}
                    {aide.conditions.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Conditions principales :</p>
                        <ul className="text-xs space-y-0.5 list-disc list-inside text-muted-foreground">
                          {aide.conditions.map((c, i) => (
                            <li key={i}>{c}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* PROMPT 13 — Pièces à fournir + échéance */}
                    {aide.piecesAFournir && aide.piecesAFournir.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Pièces à fournir :</p>
                        <ul className="text-xs space-y-0.5 list-disc list-inside text-muted-foreground">
                          {aide.piecesAFournir.map((p, i) => (
                            <li key={i}>{p}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {aide.echeance && (
                      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1 inline-block">
                        📅 {aide.echeance}
                      </p>
                    )}

                    {/* Lien */}
                    <div className="pt-2">
                      <a href={aide.url} target="_blank" rel="noopener noreferrer">
                        <Button variant="outline" size="sm">
                          <ExternalLink className="h-3.5 w-3.5 mr-1" />
                          Portail de dépôt / En savoir plus
                        </Button>
                      </a>
                    </div>
                  </CardContent>
                </Card>
              )
            })
          )}
        </div>

        {/* Footer info */}
        <Card className="bg-slate-100">
          <CardContent className="p-4 text-xs text-muted-foreground space-y-1">
            <p><strong>Ressources utiles complémentaires :</strong></p>
            <ul className="list-disc list-inside space-y-0.5">
              <li><a href="https://www.cnpf.fr/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">CNPF</a> — Centre National de la Propriété Forestière (conseil aux propriétaires)</li>
              <li><a href="https://www.onf.fr/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">ONF</a> — Office National des Forêts</li>
              <li><a href="https://afac-agroforesteries.fr/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">AFAC-Agroforesteries</a> — Réseau plantation et gestion bocage</li>
              <li><a href="https://www.vegetal-local.fr/" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">Végétal Local</a> — Plants d'origine locale labellisés</li>
            </ul>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
