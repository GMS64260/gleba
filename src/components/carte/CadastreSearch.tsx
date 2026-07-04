"use client"

/**
 * Panel de recherche cadastrale
 * Permet de chercher une parcelle par commune, section et numero
 * puis de l'importer dans la carte
 */

import { useState, useCallback, type FormEvent } from "react"
import { Search, Loader2, MapPin, ChevronDown, ChevronUp } from "lucide-react"

import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

/** Resultat d'une recherche cadastrale retourne par l'API */
export interface CadastreResult {
  id: string
  commune: string
  codeCommune: string
  section: string
  numero: string
  contenance: number | null // surface en m2
  geometry: string // GeoJSON string
}

interface CadastreSearchProps {
  onImport?: (result: CadastreResult) => void
}

export default function CadastreSearch({ onImport }: CadastreSearchProps) {
  const [commune, setCommune] = useState("")
  const [section, setSection] = useState("")
  const [numero, setNumero] = useState("")
  const [results, setResults] = useState<CadastreResult[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  const handleSearch = useCallback(
    async (e: FormEvent) => {
      e.preventDefault()

      if (!commune.trim()) {
        setError("Veuillez saisir un nom de commune.")
        return
      }

      setLoading(true)
      setError(null)
      setResults([])

      try {
        // L'API cadastre attend un code INSEE (5 chiffres). Si l'utilisateur
        // a saisi un nom de commune, on le résout d'abord via /communes.
        // (Audit 2026-07, #23 : avant, le nom était envoyé tel quel → 400.)
        const saisie = commune.trim()
        let codeInsee = saisie
        let nomCommune = saisie
        if (!/^\d{5}$/.test(saisie)) {
          const rc = await fetch(`/api/carte/communes?q=${encodeURIComponent(saisie)}`)
          if (!rc.ok) {
            const d = await rc.json().catch(() => null)
            throw new Error(d?.error || "Impossible de rechercher la commune.")
          }
          const communes: Array<{ nom: string; code: string }> = await rc.json()
          if (!Array.isArray(communes) || communes.length === 0) {
            setError("Aucune commune trouvée pour ce nom. Essayez le code INSEE (5 chiffres).")
            return
          }
          codeInsee = communes[0].code
          nomCommune = communes[0].nom
        }

        // Construction des parametres de requete
        const params = new URLSearchParams({ commune: codeInsee })
        if (section.trim()) params.set("section", section.trim())
        if (numero.trim()) params.set("numero", numero.trim())

        const response = await fetch(`/api/carte/cadastre?${params.toString()}`)

        if (!response.ok) {
          const data = await response.json().catch(() => null)
          throw new Error(
            data?.error || `Erreur serveur (${response.status})`
          )
        }

        // L'API renvoie un FeatureCollection GeoJSON — on mappe features[]
        // vers CadastreResult[] (avant, le client lisait .length sur l'objet
        // → toujours vide, aucun résultat ni erreur affichés).
        const geojson: {
          features?: Array<{
            geometry: unknown
            properties: Record<string, unknown>
          }>
        } = await response.json()

        const features = geojson.features ?? []
        const mapped: CadastreResult[] = features.map((f, idx) => {
          const p = f.properties || {}
          const sec = String(p.section ?? "")
          const num = String(p.numero ?? "")
          return {
            id: String(p.idu ?? `${codeInsee}-${sec}-${num}-${idx}`),
            commune: nomCommune,
            codeCommune: String(p.code_insee ?? codeInsee),
            section: sec,
            numero: num,
            contenance: typeof p.contenance === "number" ? p.contenance : null,
            geometry: JSON.stringify(f.geometry),
          }
        })

        if (mapped.length === 0) {
          setError("Aucune parcelle trouvée pour cette recherche.")
        }

        setResults(mapped)
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erreur lors de la recherche."
        setError(message)
      } finally {
        setLoading(false)
      }
    },
    [commune, section, numero]
  )

  const handleImport = useCallback(
    (result: CadastreResult) => {
      if (onImport) {
        onImport(result)
      }
    },
    [onImport]
  )

  /**
   * Formatte la surface en hectares ou m2 selon la taille
   */
  const formatSurface = (contenance: number | null): string => {
    if (!contenance) return "N/A"
    if (contenance >= 10000) {
      return `${(contenance / 10000).toFixed(2)} ha`
    }
    return `${contenance.toLocaleString("fr-FR")} m\u00B2`
  }

  return (
    <div className="absolute top-3 left-3 z-[1000] w-80">
      <div className="rounded-lg bg-white shadow-lg border border-slate-200 overflow-hidden">
        {/* En-tete avec bouton plier/deplier */}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          className="flex w-full items-center justify-between px-3 py-2 bg-slate-50 hover:bg-slate-100 transition-colors"
        >
          <span className="flex items-center gap-2 text-sm font-medium text-slate-700">
            <Search className="h-4 w-4" />
            Recherche cadastrale
          </span>
          {collapsed ? (
            <ChevronDown className="h-4 w-4 text-slate-500" />
          ) : (
            <ChevronUp className="h-4 w-4 text-slate-500" />
          )}
        </button>

        {!collapsed && (
          <div className="p-3 space-y-3">
            {/* Formulaire de recherche */}
            <form onSubmit={handleSearch} className="space-y-2">
              <Input
                placeholder="Commune (ex: Aurillac)"
                value={commune}
                onChange={(e) => setCommune(e.target.value)}
                className="text-sm"
              />
              <div className="flex gap-2">
                <Input
                  placeholder="Section"
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  className="text-sm w-1/2"
                />
                <Input
                  placeholder="Numero"
                  value={numero}
                  onChange={(e) => setNumero(e.target.value)}
                  className="text-sm w-1/2"
                />
              </div>
              <Button
                type="submit"
                size="sm"
                disabled={loading}
                className="w-full"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Recherche...
                  </>
                ) : (
                  <>
                    <Search className="h-4 w-4" />
                    Rechercher
                  </>
                )}
              </Button>
            </form>

            {/* Message d'erreur */}
            {error && (
              <p className="text-xs text-red-600 bg-red-50 rounded p-2">
                {error}
              </p>
            )}

            {/* Liste des resultats */}
            {results.length > 0 && (
              <div className="max-h-60 overflow-y-auto space-y-1">
                <p className="text-xs text-slate-500">
                  {results.length} parcelle{results.length > 1 ? "s" : ""} trouvee
                  {results.length > 1 ? "s" : ""}
                </p>
                {results.map((result) => (
                  <div
                    key={result.id}
                    className="flex items-center justify-between rounded border border-slate-100 p-2 hover:bg-slate-50 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-800 truncate">
                        {result.commune} - {result.section} {result.numero}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatSurface(result.contenance)}
                      </p>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleImport(result)}
                      title="Importer cette parcelle"
                      className="ml-2 flex-shrink-0"
                    >
                      <MapPin className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
