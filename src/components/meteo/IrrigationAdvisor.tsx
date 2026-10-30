"use client"

import * as React from "react"
import {
  Droplets,
  CheckCircle2,
  Loader2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Waves,
  TrendingUp,
  TrendingDown,
  Minus,
  Info,
} from "lucide-react"
import Link from "next/link"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { LigneRegistre } from "@/components/accueil/LigneRegistre"
import { PastilleEtat, type EtatRegistre } from "@/components/accueil/PastilleEtat"
import { formatNombre } from "@/lib/format-utils"
import { libelleIrrigation } from "@/lib/planches/libelle-irrigation"
import { annulerArrosage, noterArrosage } from "@/lib/irrigation/noter-arrosage"
import { aideQuantite, detailArrosageNote, lireLitres, litresConseilles } from "@/lib/irrigation/quantite-versee"
import { afficheMesuresMeteo, bandeauMeteoIndisponible, type CauseSansMeteo } from "@/lib/irrigation/meteo-indisponible"
import { notifierEnregistrement } from "@/lib/notifications-ecran"

// ============================================================
// TYPES
// ============================================================

interface RecommandationIrrigation {
  cultureId: number
  cultureIds: number[]
  cultureCount: number
  cultureName: string
  plancheId: string
  plancheName: string
  urgence: "critique" | "haute" | "moyenne" | "faible" | "aucune"
  bilanHydrique7j: number
  pluiePrevue48h: number
  conseilQuantite: number
  conseilMessage: string
  prochainePluie: string | null
  joursSansPluie: number
  joursDepuisIrrigation: number | null
  varietyName: string | null
  etatCulture: string
  derniereIrrigation: string | null
  irrigationSysteme: string | null
  /** null : type de planche non renseigné. */
  sousAbri: boolean | null
  surfaceM2: number
  /** Champs de la planche à renseigner pour un conseil sûr (« type », « sol »). */
  plancheACompleter: string[]
  /** Conseil au repli, sans bilan hydrique : météo muette ou parcelle à géolocaliser. */
  sansMeteo?: CauseSansMeteo | null
}

interface IrrigationData {
  recommandations: RecommandationIrrigation[]
  total: number
  totalCultures?: number
  urgentes: number
  /** Zones sans météo et panne totale (revue du 2026-10-28). */
  zonesIndisponibles?: number
  culturesSansMeteo?: number
  indisponible?: boolean
  cached: boolean
  cachedAt: string
  cacheAgeMinutes: number
}

// ============================================================
// COMPOSANT
// ============================================================

interface NappeData {
  station: { code: string; commune: string; departement: string; distance_km: number }
  nappe: {
    niveauActuel: number | null
    profondeurActuelle: number | null
    tendance: "hausse" | "baisse" | "stable" | "inconnue"
    variationMensuelle: number | null
    dateReleve: string | null
  }
}

interface ParcelleMeteo {
  centroidLat?: number | null
  centroidLng?: number | null
}

interface IrrigationAdvisorProps {
  parcelleId?: string
  lat?: number
  lng?: number
  /**
   * Nom de la parcelle quand l'encart est filtré (QA cmsiny9fd, 2026-08-07).
   * Sans périmètre affiché, le même titre « Conseils irrigation » annonçait
   * 9 urgentes sur Maraîchage (toute l'exploitation) et 3 sur Météo (la
   * parcelle sélectionnée) : les deux compteurs se lisaient comme
   * contradictoires alors qu'ils ne comptent pas la même chose.
   */
  scopeLabel?: string
}

export function IrrigationAdvisor({ parcelleId, lat, lng, scopeLabel }: IrrigationAdvisorProps) {
  const { toast } = useToast()
  const [data, setData] = React.useState<IrrigationData | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [collapsed, setCollapsed] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [showAll, setShowAll] = React.useState(false)
  const [nappeData, setNappeData] = React.useState<NappeData | null>(null)
  // Production 2026-09-04 (exploitation réelle, bien localisée) : les 10 stations Hub'Eau trouvées
  // dans les 50 km avaient toutes des relevés antérieurs à 2005 ; l'API rend
  // 404 et le bloc nappe disparaissait sans un mot. On le dit, sobrement.
  const [nappeIndisponible, setNappeIndisponible] = React.useState(false)
  const [savingPlancheId, setSavingPlancheId] = React.useState<string | null>(null)

  const fetchRecos = React.useCallback(async (forceRefresh = false) => {
    try {
      if (forceRefresh) setRefreshing(true)
      else setLoading(true)

      let url = "/api/meteo/irrigation"
      const params = new URLSearchParams()
      if (parcelleId) params.set('parcelleId', parcelleId)
      if (forceRefresh) params.set('refresh', '1')
      if (params.toString()) url += `?${params}`

      const res = await fetch(url)
      if (!res.ok) throw new Error("Erreur API")
      setData(await res.json())
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erreur API")
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [parcelleId])

  // Ticket QA cmv3japsf : « Noter » demande la quantité versée. Avec elle, le
  // bilan retranche ces litres ; « Quantité inconnue » (litres null) compte un
  // arrosage complet, comme avant. Même route que les autres écrans.
  const marquerArrosee = React.useCallback(async (reco: RecommandationIrrigation, litres: number | null) => {
    setSavingPlancheId(reco.plancheId)
    try {
      const resultat = await noterArrosage(reco.cultureIds, null, litres, "advisor")
      if (!resultat.ok) throw new Error(resultat.erreur)
      await fetchRecos(true)
      // QA cmsioeku5 — l'arrosage est tracé : on dit où le retrouver.
      notifierEnregistrement({
        titre: "Arrosage noté",
        detail: detailArrosageNote(reco.plancheName, litres),
        // L'annulation émet « gleba:irrigation-updated » : le conseil se recharge.
        annuler: async () => {
          const annule = await annulerArrosage(resultat.annulation)
          if (!annule.ok) throw new Error(annule.erreur)
        },
      })
      return true
    } catch (e) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: e instanceof Error && e.message ? e.message : "Impossible de noter l’arrosage.",
      })
      return false
    } finally {
      setSavingPlancheId(null)
    }
  }, [fetchRecos, toast])

  React.useEffect(() => {
    fetchRecos()
  }, [fetchRecos])

  React.useEffect(() => {
    const handleIrrigationUpdated = (event: Event) => {
      const source = (event as CustomEvent<{ source?: string }>).detail?.source
      if (source !== "advisor") void fetchRecos(true)
    }
    window.addEventListener("gleba:irrigation-updated", handleIrrigationUpdated)
    return () => window.removeEventListener("gleba:irrigation-updated", handleIrrigationUpdated)
  }, [fetchRecos])

  // Fetch donnees nappe phreatique
  React.useEffect(() => {
    if (!lat || !lng) {
      fetch("/api/carte")
        .then((r) => r.json())
        .then((parcelles) => {
          const arr: ParcelleMeteo[] = Array.isArray(parcelles?.data)
            ? parcelles.data
            : Array.isArray(parcelles)
              ? parcelles
              : []
          const first = arr.find((p) => p.centroidLat && p.centroidLng)
          if (first) {
            chargerNappe(first.centroidLat as number, first.centroidLng as number)
          }
        })
        .catch(() => {})
    } else {
      chargerNappe(lat, lng)
    }

    function chargerNappe(latitude: number, longitude: number) {
      fetch(`/api/meteo/nappe?lat=${latitude}&lng=${longitude}`)
        .then((r) => {
          if (r.ok) return r.json()
          // 404 = aucune station exploitable dans le rayon ; les autres
          // indisponibilités maîtrisées (timeout Hub'Eau) affichent le même
          // état sobre au lieu de faire disparaître le bloc sans explication.
          if (r.status === 404 || r.status === 503) setNappeIndisponible(true)
          return null
        })
        .then((d) => d && setNappeData(d))
        .catch(() => {})
    }
  }, [lat, lng])

  if (loading) {
    return (
      <div className="border rounded-lg p-4 bg-white">
        <div className="flex items-center gap-2 text-slate-400">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Analyse irrigation en cours...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="border rounded-lg p-4 bg-white">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    )
  }

  if (!data || data.recommandations.length === 0) {
    return (
      <div className="border rounded-lg p-4 bg-white">
        <div className="flex items-center gap-2 text-slate-500">
          <CheckCircle2 className="h-4 w-4 text-green-500" />
          <span className="text-sm">Aucune culture active nécessitant une analyse d&apos;irrigation.</span>
        </div>
      </div>
    )
  }

  // Compter celles qui n'ont pas besoin d'arrosage
  const okCount = data.recommandations.filter(r => r.urgence === 'aucune').length
  const bandeauMeteo = bandeauMeteoIndisponible(data)
  const displayed = showAll ? data.recommandations : data.recommandations.slice(0, 5)

  return (
    <div className="border rounded-lg bg-white overflow-hidden">
      {/* En-tete — cliquable pour réduire/agrandir */}
      <div
        className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-50/50 transition-colors select-none"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="flex items-center gap-2">
          <Droplets className="h-5 w-5 text-blue-500" />
          <div>
            <span className="font-medium text-sm">
              Conseils irrigation
              <span className="font-normal text-slate-500">
                {" · "}
                {scopeLabel ?? "toute l’exploitation"}
              </span>
            </span>
            {data.cachedAt && (
              <p className="text-xs text-slate-400 leading-none mt-0.5">
                {data.cached
                  ? `Calculé il y a ${data.cacheAgeMinutes} min`
                  : "Calculé à l'instant"}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {okCount > 0 && (
            <span className="text-xs font-medium text-green-600 bg-green-50 px-2 py-1 rounded-full">
              {okCount} OK
            </span>
          )}
          {data.urgentes > 0 && (
            <PastilleEtat etat="critique" libelle={`${data.urgentes} urgente${data.urgentes > 1 ? "s" : ""}`} />
          )}
          <button
            onClick={(e) => { e.stopPropagation(); fetchRecos(true) }}
            disabled={refreshing}
            className="p-1 rounded hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600 disabled:opacity-40"
            title="Recalculer maintenant"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          </button>
          {collapsed ? (
            <ChevronDown className="h-4 w-4 text-slate-400" />
          ) : (
            <ChevronUp className="h-4 w-4 text-slate-400" />
          )}
        </div>
      </div>

      {!collapsed && <>
      {nappeIndisponible && !nappeData && (
        <div className="px-3 py-1.5 border-b bg-slate-50 flex items-center gap-2 text-xs text-slate-500">
          <Waves className="h-3.5 w-3.5 shrink-0" />
          <span>Nappe : aucune station Hub&apos;Eau avec des relevés récents dans un rayon de 50 km.</span>
        </div>
      )}
      {/* Nappe phreatique — masquer si relevé trop ancien (> 2 ans). Bug
          feedback testeur 2026-05-26 (cmpm73mgd) — un relevé > 3 mois est
          déjà périmé pour piloter l'irrigation : on affiche un bandeau
          d'avertissement coloré (ambre) au lieu de l'info en cyan rassurant. */}
      {nappeData && nappeData.nappe.dateReleve && (Date.now() - new Date(nappeData.nappe.dateReleve).getTime()) < 2 * 365 * 86400000 && (() => {
        const ageMs = Date.now() - new Date(nappeData.nappe.dateReleve!).getTime()
        const ageMois = Math.floor(ageMs / (30 * 86400000))
        const isStale = ageMs > 90 * 86400000 // > 3 mois
        return (
        <div className={`px-3 py-2 border-b ${isStale ? 'bg-amber-50' : 'bg-cyan-50/50'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Waves className={`h-4 w-4 ${isStale ? 'text-amber-600' : 'text-cyan-600'}`} />
              <div>
                <p className={`text-xs font-medium ${isStale ? 'text-amber-800' : 'text-cyan-800'}`}>
                  Nappe : {nappeData.station.commune}
                  <span className={`font-normal ml-1 ${isStale ? 'text-amber-500' : 'text-cyan-500'}`}>({nappeData.station.distance_km} km)</span>
                  {isStale && (
                    <span className="ml-2 text-[10px] uppercase tracking-wide font-bold text-amber-700">⚠ Donnée périmée</span>
                  )}
                </p>
                {nappeData.nappe.dateReleve && (
                  <p className={`text-[10px] ${isStale ? 'text-amber-600' : 'text-cyan-500'}`}>
                    Relevé du {new Date(nappeData.nappe.dateReleve).toLocaleDateString("fr-FR")}
                    {isStale && ` — ${ageMois} mois, ne pas utiliser pour piloter l'arrosage`}
                  </p>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {nappeData.nappe.profondeurActuelle !== null && (
                <span className="text-xs font-medium text-cyan-700">
                  -{nappeData.nappe.profondeurActuelle.toFixed(1)}m
                </span>
              )}
              {nappeData.nappe.tendance === "hausse" && (
                <span title="En hausse"><TrendingUp className="h-3.5 w-3.5 text-green-600" /></span>
              )}
              {nappeData.nappe.tendance === "baisse" && (
                <span title="En baisse"><TrendingDown className="h-3.5 w-3.5 text-red-500" /></span>
              )}
              {nappeData.nappe.tendance === "stable" && (
                <span title="Stable"><Minus className="h-3.5 w-3.5 text-slate-400" /></span>
              )}
              {nappeData.nappe.variationMensuelle !== null && (
                <span className={`text-[10px] ${
                  nappeData.nappe.variationMensuelle < -0.5 ? "text-red-500" :
                  nappeData.nappe.variationMensuelle > 0.5 ? "text-green-600" : "text-slate-400"
                }`}>
                  {nappeData.nappe.variationMensuelle > 0 ? "+" : ""}{nappeData.nappe.variationMensuelle}m/mois
                </span>
              )}
            </div>
          </div>
        </div>
        )
      })()}

      {/* Nappe trop ancienne — avertissement discret */}
      {nappeData && nappeData.nappe.dateReleve && (Date.now() - new Date(nappeData.nappe.dateReleve).getTime()) >= 2 * 365 * 86400000 && (
        <div className="px-3 py-1.5 border-b bg-slate-50 flex items-center gap-2">
          <Info className="h-3.5 w-3.5 text-slate-400" />
          <p className="text-[10px] text-slate-400">
            Nappe ({nappeData.station.commune}) : dernier relevé trop ancien ({new Date(nappeData.nappe.dateReleve).toLocaleDateString("fr-FR")})
          </p>
        </div>
      )}

      {bandeauMeteo && (
        <div className="px-3 py-1.5 border-b bg-slate-50 flex items-start gap-2 text-xs text-slate-600" role="status">
          <Info className="h-3.5 w-3.5 shrink-0 mt-0.5 text-slate-400" aria-hidden />
          <span>{bandeauMeteo}</span>
        </div>
      )}

      {/* Recommandations */}
      <div className="border-b bg-blue-50/60 px-3 py-2 text-xs text-blue-900">
        Les conseils tiennent compte des arrosages notés. Un équipement automatique
        indique le système installé, pas qu&apos;un passage a réellement eu lieu.
      </div>
      <div>
        {displayed.map((reco) => (
          <RecoRow
            key={reco.plancheId}
            reco={reco}
            saving={savingPlancheId === reco.plancheId}
            onWater={marquerArrosee}
          />
        ))}
      </div>

      {/* Voir plus */}
      {data.recommandations.length > 5 && (
        <button
          onClick={() => setShowAll(!showAll)}
          className="w-full px-3 py-2 text-xs text-slate-500 hover:bg-slate-50 flex items-center justify-center gap-1 border-t"
        >
          {showAll ? (
            <>
              <ChevronUp className="h-3 w-3" /> Voir moins
            </>
          ) : (
            <>
              <ChevronDown className="h-3 w-3" /> Voir les {data.recommandations.length - 5} autres
            </>
          )}
        </button>
      )}
      </>}
    </div>
  )
}

// ============================================================
// LIGNE DE RECOMMANDATION
// ============================================================

/** Champs de planche manquants, tels que la fiche planche les nomme. */
const CHAMPS_PLANCHE: Record<string, string> = {
  type: "type (plein champ, serre, tunnel)",
  sol: "sol",
}

/** Verbe d'une recommandation d'arrosage, par urgence. */
const ETAT_URGENCE: Record<RecommandationIrrigation["urgence"], { etat: EtatRegistre; libelle: string }> = {
  critique: { etat: "critique", libelle: "À arroser d'urgence" },
  haute: { etat: "attention", libelle: "À arroser" },
  moyenne: { etat: "neutre", libelle: "À surveiller" },
  faible: { etat: "info", libelle: "Peut attendre" },
  aucune: { etat: "ok", libelle: "Rien à faire" },
}

function RecoRow({
  reco,
  saving,
  onWater,
}: {
  reco: RecommandationIrrigation
  saving: boolean
  onWater: (reco: RecommandationIrrigation, litres: number | null) => Promise<boolean>
}) {
  const [expanded, setExpanded] = React.useState(false)
  /** Litres en cours de saisie ; null : formulaire fermé. */
  const [litres, setLitres] = React.useState<string | null>(null)

  // P4 « une liste est un registre » (2026-10-09) : l'urgence se lit en
  // verbe dans une pastille, plus en fond rouge ni en badge « Critique ».
  const { etat, libelle } = ETAT_URGENCE[reco.urgence]
  const arroseeAujourdhui = reco.joursDepuisIrrigation === 0
  // Encore à arroser après un apport partiel : on peut noter le complément.
  const aArroser = reco.urgence === "critique" || reco.urgence === "haute"
  // Mêmes chiffres et mêmes mots que les Tâches et le Calendrier (`quantite-versee.ts`).
  const conseilLitres = litresConseilles(reco.conseilQuantite, reco.surfaceM2)
  const litresSaisis = litres === null ? NaN : lireLitres(litres)
  const enregistrer = async (quantite: number | null) => {
    if (await onWater(reco, quantite)) setLitres(null)
  }
  const aCompleter = (reco.plancheACompleter ?? []).map((champ) => CHAMPS_PLANCHE[champ] ?? champ)
  const mesuresMeteo = afficheMesuresMeteo(reco)

  return (
    <div>
      <LigneRegistre
        etat={etat}
        titre={
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            aria-expanded={expanded}
            className="-my-1.5 flex min-h-11 min-w-0 max-w-full items-center gap-1.5 text-left hover:underline"
          >
            {expanded ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-ardoise" aria-hidden />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-ardoise" aria-hidden />
            )}
            {/* cultureName porte déjà la variété (libelleEspeceVariete) :
                la rajouter la répétait (QA cmv2ex2vq). */}
            <span className="truncate">{reco.cultureName}</span>
          </button>
        }
        meta={[
          reco.plancheName,
          reco.cultureCount > 1 ? `${reco.cultureCount} cultures` : reco.etatCulture,
          reco.pluiePrevue48h > 3 ? `${Math.round(reco.pluiePrevue48h)} mm de pluie sous 48 h` : "",
          arroseeAujourdhui ? "Arrosée aujourd'hui" : "",
          // Tickets QA cmv3ja7nr et cmv3jaru7 : un conseil calculé sans type
          // ou sans sol de planche le dit, avec le chemin pour le compléter.
          aCompleter.length > 0 ? (
            <Link href={`/maraichage/planches/${encodeURIComponent(reco.plancheId)}`} className="font-medium text-argile underline underline-offset-2">
              Planche à compléter : {aCompleter.join(", ")}
            </Link>
          ) : "",
        ]}
        pastille={<PastilleEtat etat={etat} libelle={libelle} className="hidden sm:inline-flex" />}
        action={
          arroseeAujourdhui && !aArroser
            ? undefined
            : {
                libelle: saving ? "…" : "Noter",
                disabled: saving || litres !== null,
                onClick: () => setLitres(conseilLitres ? String(conseilLitres) : ""),
              }
        }
      />

      {litres !== null && (
        <form
          className="space-y-2 border-b border-lin-doux bg-slate-50/60 px-4 py-3 pl-7"
          onSubmit={(e) => {
            e.preventDefault()
            if (litresSaisis > 0) void enregistrer(litresSaisis)
          }}
        >
          <label htmlFor={`litres-${reco.plancheId}`} className="block text-xs font-medium text-encre">
            Quantité versée sur {reco.plancheName}
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1.5">
              <input
                id={`litres-${reco.plancheId}`}
                type="text"
                inputMode="decimal"
                autoComplete="off"
                autoFocus
                value={litres}
                onChange={(e) => setLitres(e.target.value)}
                className="h-9 w-28 rounded-md border border-input bg-white px-2 text-sm"
              />
              <span className="text-sm text-slate-600">L</span>
            </span>
            <Button type="submit" size="sm" className="h-9" disabled={saving || !(litresSaisis > 0)}>
              Enregistrer
            </Button>
            <Button type="button" size="sm" variant="outline" className="h-9" disabled={saving} onClick={() => void enregistrer(null)}>
              Quantité inconnue
            </Button>
            <Button type="button" size="sm" variant="ghost" className="h-9" disabled={saving} onClick={() => setLitres(null)}>
              Fermer
            </Button>
          </div>
          <p className="text-[11px] leading-relaxed text-slate-500">
            {aideQuantite(reco.conseilQuantite, reco.surfaceM2)}
          </p>
        </form>
      )}

      {expanded && (
        <div className="border-b border-lin-doux px-4 pb-3 pl-7">
          <p className="text-xs text-slate-600 leading-relaxed">{reco.conseilMessage}</p>
          <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-400">
            {/* Sans météo (repli), ni bilan ni compteur : la route y met 0. */}
            {mesuresMeteo && (
              <span>Bilan 7 j : {reco.bilanHydrique7j > 0 ? "+" : ""}{formatNombre(reco.bilanHydrique7j, 1)} mm</span>
            )}
            {/* Sous abri, il ne pleut pas : « 0 j sans pluie » n'avait pas de sens. */}
            {reco.sousAbri ? <span>Sous abri</span> : mesuresMeteo && <span>{reco.joursSansPluie} j sans pluie</span>}
            {reco.conseilQuantite > 0 && (
              <span className="font-medium text-blue-600">{formatNombre(reco.conseilQuantite, 1)} L/m²</span>
            )}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500">
            {reco.derniereIrrigation && (
              <span>
                Dernier arrosage : {new Date(reco.derniereIrrigation).toLocaleDateString("fr-FR")}
              </span>
            )}
            {/* « Goutte-a-goutte » enregistré par la fiche planche (QA cmv3javy4). */}
            {reco.irrigationSysteme && <span>Équipement : {libelleIrrigation(reco.irrigationSysteme)}</span>}
          </div>
        </div>
      )}
    </div>
  )
}
