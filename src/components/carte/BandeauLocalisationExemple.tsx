"use client"

/**
 * Bandeau de recalage de la parcelle d'exemple, autonome.
 *
 * La parcelle « Potager » des comptes créés avant la refonte de l'onboarding
 * (2026-08-17) est géolocalisée en dur à Paris 4ᵉ : météo, ET0, pluie qui annule
 * un arrosage et piézomètres Hub'Eau sont tous calés sur Paris. 83 comptes en
 * production au 2026-08-17, dont 26 déjà passés par l'onboarding — ceux-là ne
 * repasseront jamais par le parcours qui recale, il faut donc les rattraper ici.
 *
 * Deux corrections par rapport à la version du 2026-08-14 :
 *   - le bandeau CORRIGE au lieu de donner une consigne. Il embarque la
 *     recherche de commune et recale la parcelle en un clic — l'ancienne
 *     version renvoyait vers l'outil « Déplacer » de la carte, donc vers une
 *     manipulation que personne n'a faite (suivi du 2026-08-16 : deux sessions
 *     du compte visé ont redéclenché les appels Hub'Eau parisiens sans jamais
 *     voir le bandeau, monté sur la seule page qu'il ne visite pas) ;
 *   - il s'affiche dès que le décor est présent (`surDecorExemple`), pas
 *     seulement quand le compte l'a dépassé : depuis la refonte, un centroïde
 *     parisien ne peut plus être qu'un héritage, donc une donnée fausse.
 *
 * Il se referme pour la session, jamais définitivement : le problème, lui, ne
 * disparaît qu'une fois la parcelle déplacée.
 */

import * as React from "react"
import { Loader2, MapPin, Search, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useToast } from "@/hooks/use-toast"

export interface LocalisationExempleInfo {
  aRecaler: boolean
  surDecorExemple?: boolean
  parcelleId: string | null
  parcelleNom: string | null
  nbPlanches: number
  nbCultures: number
}

interface CommuneApi {
  nom: string
  code: string
  codesPostaux?: string[]
  centre?: { type: string; coordinates: [number, number] }
}

interface BandeauLocalisationExempleProps {
  info: LocalisationExempleInfo | null
  /** Recalage effectué : au parent de rafraîchir ses données (carte, météo…). */
  onRecale?: () => void
  /** Repli optionnel : ouvrir la parcelle sur la carte pour un ajustement fin. */
  onOuvrirSurCarte?: (parcelleId: string) => void
}

export default function BandeauLocalisationExemple({
  info,
  onRecale,
  onOuvrirSurCarte,
}: BandeauLocalisationExempleProps) {
  const { toast } = useToast()
  const [masque, setMasque] = React.useState(false)
  const [recherche, setRecherche] = React.useState("")
  const [suggestions, setSuggestions] = React.useState<CommuneApi[]>([])
  const [cherche, setCherche] = React.useState(false)
  const [enregistre, setEnregistre] = React.useState(false)

  // Auto-complétion commune, même source que le parcours d'onboarding.
  React.useEffect(() => {
    const q = recherche.trim()
    if (q.length < 2) {
      setSuggestions([])
      return
    }
    setCherche(true)
    const t = setTimeout(() => {
      fetch(`/api/carte/communes?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((rows: CommuneApi[]) => setSuggestions(Array.isArray(rows) ? rows.slice(0, 6) : []))
        .catch(() => setSuggestions([]))
        .finally(() => setCherche(false))
    }, 300)
    return () => clearTimeout(t)
  }, [recherche])

  const recaler = async (c: CommuneApi) => {
    const [lng, lat] = c.centre?.coordinates ?? [null, null]
    if (lat == null || lng == null || !info?.parcelleId) {
      toast({ variant: "destructive", title: "Commune sans coordonnées", description: "Choisissez une autre commune." })
      return
    }
    setEnregistre(true)
    try {
      const res = await fetch("/api/carte/localisation-exemple/recaler", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parcelleId: info.parcelleId,
          commune: { nom: c.nom, codePostal: c.codesPostaux?.[0] ?? null, lat, lng },
        }),
      })
      const j = await res.json().catch(() => null)
      if (!res.ok) {
        toast({ variant: "destructive", title: "Recalage impossible", description: j?.error || "Réessayez." })
        return
      }
      toast({
        title: `Parcelle recalée à ${c.nom}`,
        description: "Météo, arrosage et relevés de nappe utilisent désormais ce point. Affinez le contour depuis la carte quand vous voulez.",
      })
      setMasque(true)
      onRecale?.()
    } finally {
      setEnregistre(false)
    }
  }

  const visible = info?.surDecorExemple ?? info?.aRecaler
  if (!visible || !info?.parcelleId || masque) return null

  const nom = info.parcelleNom || "Potager"
  const volumes = [
    info.nbPlanches > 0 ? `${info.nbPlanches} planche${info.nbPlanches > 1 ? "s" : ""}` : null,
    info.nbCultures > 0 ? `${info.nbCultures} culture${info.nbCultures > 1 ? "s" : ""}` : null,
  ]
    .filter(Boolean)
    .join(" et ")

  return (
    <div className="border-b border-amber-300 bg-amber-50 px-4 py-3 text-amber-950">
      <div className="flex items-start gap-3">
        <MapPin className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium">
            La parcelle « {nom} » est encore à son emplacement d&apos;exemple, à Paris.
          </p>
          <p className="mt-1 text-sm text-amber-900">
            {info.aRecaler && volumes ? `Vous y avez rattaché ${volumes}. ` : ""}
            La météo, les prévisions de pluie qui annulent un arrosage et les relevés de
            nappe sont calculés à cet endroit : tant qu&apos;elle n&apos;est pas déplacée,
            ces conseils décrivent le climat parisien, pas le vôtre.
          </p>
          <div className="mt-2">
            <label className="block text-xs font-medium text-amber-900 mb-1">
              Indiquez votre commune — le recalage est immédiat
            </label>
            <div className="relative max-w-md">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-amber-600" />
              <Input
                className="h-9 pl-8 bg-white border-amber-300"
                value={recherche}
                onChange={(e) => setRecherche(e.target.value)}
                placeholder="Périgueux, Saint-Denis, Bayonne…"
                autoComplete="off"
                disabled={enregistre}
              />
              {(cherche || enregistre) && (
                <Loader2 className="absolute right-2.5 top-2.5 h-4 w-4 animate-spin text-amber-600" />
              )}
              {suggestions.length > 0 && !enregistre && (
                <div className="absolute z-20 mt-1 w-full rounded-md border border-amber-200 bg-white shadow-md">
                  {suggestions.map((c) => (
                    <button
                      key={c.code}
                      type="button"
                      onClick={() => recaler(c)}
                      className="block w-full text-left px-3 py-2 text-sm text-slate-800 hover:bg-amber-50"
                    >
                      {c.nom}
                      {c.codesPostaux?.[0] ? (
                        <span className="text-muted-foreground"> — {c.codesPostaux[0]}</span>
                      ) : null}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {onOuvrirSurCarte && (
              <Button
                variant="link"
                size="sm"
                className="mt-1 h-auto p-0 text-xs text-amber-800"
                onClick={() => onOuvrirSurCarte(info.parcelleId as string)}
              >
                ou dessiner le contour exact sur la carte
              </Button>
            )}
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-7 w-7 flex-shrink-0 p-0 text-amber-700 hover:bg-amber-100"
          onClick={() => setMasque(true)}
          aria-label="Masquer ce rappel"
          title="Masquer pour cette session"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  )
}
