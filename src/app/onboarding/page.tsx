"use client"

/**
 * Parcours de première connexion : la configuration MINIMALE de l'exploitation.
 *
 * Refonte 2026-08-17. L'ancien wizard ouvrait sur l'identité légale (SIRET,
 * TVA), ne demandait jamais où se trouve l'exploitation — la parcelle d'exemple
 * du signup était géolocalisée en dur à Paris 4ᵉ et pilotait météo, arrosage,
 * éphémérides et nappes — et son étape « premier élément » perdait les saisies
 * verger et élevage. Nouveau parcours, piloté par les modules activés :
 *
 *   1. Exploitation  — nom + commune (→ parcelle géolocalisée, zone climatique)
 *   2. Modules       — le pivot : conditionne les étapes suivantes
 *   3. Production    — planche / arbre / cheptel réellement créés (si module)
 *   4. Facturation   — identité légale, seulement si la comptabilité est active
 *   5. Démarrage     — récapitulatif + données d'exemple sur choix explicite
 *
 * Invariants conservés du 2026-08-06 : progression persistée au fil de l'eau
 * (reprise après abandon) et « Terminer plus tard » toujours disponible —
 * aucune redirection forcée sans porte de sortie.
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import {
  ChevronRight,
  ChevronLeft,
  Sprout,
  TreeDeciduous,
  Bird,
  Wallet,
  CheckCircle2,
  Building2,
  MapPin,
  PartyPopper,
  Loader2,
  SkipForward,
  PawPrint,
  Search,
  Database,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { useToast } from "@/hooks/use-toast"
import { CODES_TERRITOIRES, TERRITOIRES, getTerritoire, LABELS_REGIME_TVA } from "@/lib/territoires"
import { ELEVAGE_MODES, ELEVAGE_MODE_IDS } from "@/lib/elevage-modes"
import {
  ZONES_CLIMAT,
  ZONE_CLIMAT_LABEL,
  zoneClimatiqueDepuisCodePostal,
  type ZoneClimat,
} from "@/lib/terroir"
import {
  CHEPTEL_ONBOARDING,
  ETAPE_IDS,
  TYPES_SOL_ONBOARDING,
  etapeDepuisIndexLegacy,
  etapesPourModules,
  type EtapeId,
} from "@/lib/onboarding-config"
import { MODULES, type ModuleId } from "@/lib/modules"

const ETAPE_LABELS: Record<EtapeId, string> = {
  exploitation: "Exploitation",
  modules: "Modules",
  production: "Production",
  facturation: "Facturation",
  demarrage: "Démarrage",
}

interface CommuneChoisie {
  nom: string
  codePostal: string | null
  lat: number
  lng: number
}

interface CommuneApi {
  nom: string
  code: string
  codesPostaux?: string[]
  centre?: { type: string; coordinates: [number, number] }
}

interface OnboardingState {
  etape: EtapeId
  // Exploitation
  nomExploitation: string
  rechercheCommune: string
  commune: CommuneChoisie | null
  zoneChoisie: ZoneClimat | "auto"
  // Modules
  modulesActifs: Record<ModuleId, boolean>
  modesElevage: { compagnie: boolean; equin: boolean; nac: boolean }
  // Production
  plancheNom: string
  plancheLongueur: string
  plancheLargeur: string
  plancheSol: (typeof TYPES_SOL_ONBOARDING)[number]
  arbreEspece: string
  arbreNom: string
  cheptel: Record<string, string> // especeAnimaleId → effectif saisi
  // Facturation (identité légale)
  raisonSociale: string
  formeJuridique: string
  territoire: string
  siret: string
  identifiantLegal: string
  adresseSiege: string
  codePostal: string
  ville: string
  emailContact: string
  regimeFiscal: string
  regimeTva: string
  // Démarrage
  avecExemple: boolean
}

const initial: OnboardingState = {
  etape: "exploitation",
  nomExploitation: "",
  rechercheCommune: "",
  commune: null,
  zoneChoisie: "auto",
  modulesActifs: { maraichage: true, verger: false, elevage: false, comptabilite: false },
  modesElevage: { compagnie: false, equin: false, nac: false },
  plancheNom: "",
  plancheLongueur: "",
  plancheLargeur: "",
  plancheSol: "Limoneux",
  arbreEspece: "",
  arbreNom: "",
  cheptel: {},
  raisonSociale: "",
  formeJuridique: "EI",
  territoire: "METROPOLE",
  siret: "",
  identifiantLegal: "",
  adresseSiege: "",
  codePostal: "",
  ville: "",
  emailContact: "",
  regimeFiscal: "micro-BA",
  regimeTva: "franchise-293b",
  avecExemple: false,
}

/** Territoire fiscal probable depuis un code postal DROM (préfixe 3 chiffres). */
const TERRITOIRE_PAR_PREFIXE: Record<string, string> = {
  "971": "GUADELOUPE",
  "972": "MARTINIQUE",
  "973": "GUYANE",
  "974": "REUNION",
  "976": "MAYOTTE",
}

export default function OnboardingPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [s, setS] = React.useState<OnboardingState>(initial)
  const [saving, setSaving] = React.useState(false)
  const [hydrating, setHydrating] = React.useState(true)
  const [suggestions, setSuggestions] = React.useState<CommuneApi[]>([])
  const [chercheCommune, setChercheCommune] = React.useState(false)
  // Récapitulatif de ce qui a réellement été créé (retours serveur).
  const [creations, setCreations] = React.useState<{
    parcelle?: string | null
    planche?: string | null
    arbre?: string | null
    lots: string[]
  }>({ lots: [] })

  const set = <K extends keyof OnboardingState>(key: K, v: OnboardingState[K]) =>
    setS((prev) => ({ ...prev, [key]: v }))

  const modulesActifsList = React.useMemo(
    () => (Object.entries(s.modulesActifs) as [ModuleId, boolean][]).filter(([, on]) => on).map(([id]) => id),
    [s.modulesActifs],
  )
  const etapes = React.useMemo(() => etapesPourModules(modulesActifsList), [modulesActifsList])
  const indexEtape = Math.max(etapes.indexOf(s.etape), 0)

  // Reprise : relire l'étape atteinte et les choix persistés (invariant 2026-08-06).
  React.useEffect(() => {
    fetch("/api/user/preferences")
      .then((r) => (r.ok ? r.json() : null))
      .then((prefs) => {
        if (!prefs) return
        setS((prev) => {
          const suivant = { ...prev }
          if (typeof prefs.onboardingEtape === "string" && (ETAPE_IDS as readonly string[]).includes(prefs.onboardingEtape)) {
            suivant.etape = prefs.onboardingEtape as EtapeId
          } else if (typeof prefs.onboardingStep === "number") {
            // Parcours entamé avant la refonte : index numérique → étape la plus proche.
            suivant.etape = etapeDepuisIndexLegacy(prefs.onboardingStep)
          }
          if (Array.isArray(prefs.modulesActifs)) {
            suivant.modulesActifs = {
              maraichage: prefs.modulesActifs.includes("maraichage"),
              verger: prefs.modulesActifs.includes("verger"),
              elevage: prefs.modulesActifs.includes("elevage"),
              comptabilite: prefs.modulesActifs.includes("comptabilite"),
            }
          }
          if (Array.isArray(prefs.modesElevage)) {
            suivant.modesElevage = {
              compagnie: prefs.modesElevage.includes("compagnie"),
              equin: prefs.modesElevage.includes("equin"),
              nac: prefs.modesElevage.includes("nac"),
            }
          }
          return suivant
        })
      })
      .catch(() => { /* hors ligne : on démarre au début */ })
      .finally(() => setHydrating(false))
  }, [])

  // Auto-complétion commune (geo.api.gouv.fr via /api/carte/communes), debounce.
  React.useEffect(() => {
    const q = s.rechercheCommune.trim()
    if (q.length < 2 || (s.commune && q === s.commune.nom)) {
      setSuggestions([])
      return
    }
    setChercheCommune(true)
    const t = setTimeout(() => {
      fetch(`/api/carte/communes?q=${encodeURIComponent(q)}`)
        .then((r) => (r.ok ? r.json() : []))
        .then((rows: CommuneApi[]) => setSuggestions(Array.isArray(rows) ? rows.slice(0, 6) : []))
        .catch(() => setSuggestions([]))
        .finally(() => setChercheCommune(false))
    }, 300)
    return () => clearTimeout(t)
  }, [s.rechercheCommune, s.commune])

  const choisirCommune = (c: CommuneApi) => {
    const [lng, lat] = c.centre?.coordinates ?? [null, null]
    if (lat == null || lng == null) {
      toast({ variant: "destructive", title: "Commune sans coordonnées", description: "Choisissez une autre commune ou passez cette étape." })
      return
    }
    const codePostal = c.codesPostaux?.[0] ?? null
    setS((prev) => ({
      ...prev,
      commune: { nom: c.nom, codePostal, lat, lng },
      rechercheCommune: c.nom,
      // Pré-sélection du territoire fiscal pour l'étape facturation (DROM).
      territoire: (codePostal && TERRITOIRE_PAR_PREFIXE[codePostal.slice(0, 3)]) || prev.territoire,
      codePostal: codePostal ?? prev.codePostal,
      ville: c.nom,
    }))
    setSuggestions([])
  }

  const zoneDerivee: ZoneClimat | null = React.useMemo(
    () => zoneClimatiqueDepuisCodePostal(s.commune?.codePostal),
    [s.commune],
  )
  const zoneEffective: ZoneClimat | null = s.zoneChoisie === "auto" ? zoneDerivee : s.zoneChoisie

  const persistEtape = (etape: EtapeId) => {
    fetch("/api/user/preferences", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ onboardingEtape: etape }),
    }).catch(() => { /* best effort : la reprise retombera sur la dernière étape sauvée */ })
  }
  const allerA = (etape: EtapeId) => {
    set("etape", etape)
    persistEtape(etape)
  }
  const suivante = () => allerA(etapes[Math.min(indexEtape + 1, etapes.length - 1)])
  const precedente = () => allerA(etapes[Math.max(indexEtape - 1, 0)])

  // Sortie de secours : jamais de séquestration dans le wizard.
  const terminerPlusTard = async () => {
    setSaving(true)
    try {
      await persistModules()
      const res = await fetch("/api/onboarding", { method: "POST" })
      if (!res.ok) {
        toast({ variant: "destructive", title: "Erreur", description: "Impossible de quitter l'onboarding, réessayez." })
        return
      }
      router.push("/")
    } finally {
      setSaving(false)
    }
  }

  // --- Étape 1 : exploitation -----------------------------------------------
  const validerExploitation = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/onboarding/configurer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          etape: "exploitation",
          nomExploitation: s.nomExploitation || null,
          commune: s.commune,
          zoneClimat: s.zoneChoisie === "auto" ? null : s.zoneChoisie,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        toast({ variant: "destructive", title: "Enregistrement impossible", description: j?.error || "Réessayez." })
        return
      }
      const j = await res.json()
      if (j.parcelle) setCreations((c) => ({ ...c, parcelle: j.parcelle.nom }))
      suivante()
    } finally {
      setSaving(false)
    }
  }

  // --- Étape 2 : modules -----------------------------------------------------
  const persistModules = async (): Promise<boolean> => {
    const modules = modulesActifsList
    const modes = Object.entries(s.modesElevage).filter(([, on]) => on).map(([k]) => k)
    try {
      const res = await fetch("/api/user/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modulesActifs: modules, modesElevage: s.modulesActifs.elevage ? modes : [] }),
      })
      if (!res.ok) return false
      // Synchroniser le cache client de useModules (TTL 5 min, ticket cms1t6dpn).
      try {
        localStorage.setItem("gleba_modules_actifs", JSON.stringify({ ts: Date.now(), modules }))
        window.dispatchEvent(new Event("gleba:modules-changed"))
      } catch { /* localStorage indisponible : refresh() rattrapera */ }
      return true
    } catch {
      return false
    }
  }

  const validerModules = async () => {
    if (modulesActifsList.length === 0) {
      toast({ variant: "destructive", title: "Choisissez au moins un module", description: "Vous pourrez en activer d'autres à tout moment." })
      return
    }
    setSaving(true)
    try {
      const ok = await persistModules()
      if (!ok) {
        toast({ variant: "destructive", title: "Modules non enregistrés", description: "Vérifiez votre connexion puis réessayez." })
        return
      }
      suivante()
    } finally {
      setSaving(false)
    }
  }

  // --- Étape 3 : production --------------------------------------------------
  const validerProduction = async () => {
    setSaving(true)
    try {
      const nombre = (v: string) => {
        const n = parseFloat(v.replace(",", "."))
        return Number.isFinite(n) && n > 0 ? n : null
      }
      const cheptel = Object.entries(s.cheptel)
        .map(([especeAnimaleId, effectif]) => ({ especeAnimaleId, effectif: parseInt(effectif, 10) }))
        .filter((c) => Number.isInteger(c.effectif) && c.effectif >= 1)
      const res = await fetch("/api/onboarding/configurer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          etape: "production",
          planche: s.modulesActifs.maraichage && s.plancheNom.trim()
            ? {
                nom: s.plancheNom.trim(),
                longueur: nombre(s.plancheLongueur),
                largeur: nombre(s.plancheLargeur),
                typeSol: s.plancheSol,
              }
            : null,
          arbre: s.modulesActifs.verger && s.arbreEspece.trim()
            ? { espece: s.arbreEspece.trim(), nom: s.arbreNom.trim() || null }
            : null,
          cheptel: s.modulesActifs.elevage ? cheptel : null,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        toast({ variant: "destructive", title: "Enregistrement impossible", description: j?.error || "Réessayez." })
        return
      }
      const j = await res.json()
      setCreations((c) => ({
        ...c,
        planche: j.planche?.nom ?? c.planche,
        arbre: j.arbre?.nom ?? c.arbre,
        lots: j.lots?.length ? j.lots.map((l: { nom: string; effectif: number }) => `${l.nom} (${l.effectif})`) : c.lots,
      }))
      suivante()
    } finally {
      setSaving(false)
    }
  }

  // --- Étape 4 : facturation (identité légale) -------------------------------
  const terr = getTerritoire(s.territoire)
  const usesSiret = terr.typeIdentifiant === "SIRET"
  const onTerritoireChange = (code: string) => {
    const t = getTerritoire(code)
    setS((prev) => ({
      ...prev,
      territoire: code,
      regimeTva: t.regimesTva.includes(prev.regimeTva) ? prev.regimeTva : t.regimeTvaDefaut,
    }))
  }
  const validerFacturation = async () => {
    if (!s.siret && !s.identifiantLegal && !s.raisonSociale) {
      suivante()
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/exploitation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raisonSociale: s.raisonSociale || s.nomExploitation,
          formeJuridique: s.formeJuridique,
          territoire: s.territoire,
          siret: s.siret.replace(/\s+/g, ""),
          identifiantLegal: s.identifiantLegal,
          devise: getTerritoire(s.territoire).devise,
          adresseSiege: s.adresseSiege,
          codePostal: s.codePostal,
          ville: s.ville,
          emailContact: s.emailContact,
          regimeFiscal: s.regimeFiscal,
          regimeTva: s.regimeTva,
        }),
      })
      if (!res.ok) {
        const j = await res.json().catch(() => null)
        toast({ variant: "destructive", title: "Champs incorrects", description: j?.error || "Vérifiez la saisie" })
        return
      }
      suivante()
    } finally {
      setSaving(false)
    }
  }

  // --- Étape 5 : démarrage ---------------------------------------------------
  const finir = async () => {
    setSaving(true)
    try {
      await persistModules()
      if (s.avecExemple) {
        await fetch("/api/onboarding/configurer", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ etape: "exemple", avecExemple: true }),
        }).catch(() => { /* non bloquant : l'exemple reste proposable plus tard */ })
      }
      // Si le marquage échoue, ne pas rediriger (sinon boucle de redirection).
      const res = await fetch("/api/onboarding", { method: "POST" })
      if (!res.ok) {
        toast({ variant: "destructive", title: "Erreur", description: "La finalisation a échoué, réessayez." })
        return
      }
      const premier = modulesActifsList[0] || "maraichage"
      router.push(`/${premier}`)
    } finally {
      setSaving(false)
    }
  }

  const navigation = (opts: { onSuivant: () => void; suivantLabel?: string; passer?: boolean }) => (
    <div className="flex justify-between px-6 pb-6">
      {indexEtape > 0 ? (
        <Button variant="outline" onClick={precedente} disabled={saving}>
          <ChevronLeft className="h-4 w-4 mr-1" />
          Précédent
        </Button>
      ) : <span />}
      <div className="flex gap-2">
        {opts.passer && (
          <Button variant="ghost" onClick={suivante} disabled={saving}>
            <SkipForward className="h-4 w-4 mr-1" />
            Passer
          </Button>
        )}
        <Button onClick={opts.onSuivant} disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
          {opts.suivantLabel ?? "Continuer"}
          <ChevronRight className="h-4 w-4 ml-1" />
        </Button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50 py-10 px-4">
      <div className="container mx-auto max-w-3xl">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Bienvenue sur Gleba</h1>
          <p className="text-slate-600">
            Quelques minutes pour configurer le minimum de votre exploitation. Tout reste modifiable ensuite.
          </p>
          <Button variant="ghost" size="sm" className="mt-2 text-slate-500" onClick={terminerPlusTard} disabled={saving}>
            <SkipForward className="h-4 w-4 mr-1" />
            Terminer plus tard et accéder à l&apos;application
          </Button>
        </div>

        {hydrating ? (
          <div className="flex justify-center py-16 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin" />
          </div>
        ) : (
          <>
            {/* Stepper — reflète les étapes réellement affichées pour ces modules */}
            <div className="flex items-center justify-between mb-8 px-2">
              {etapes.map((etape, i) => (
                <div key={etape} className="flex items-center flex-1 min-w-0">
                  <div className="flex flex-col items-center gap-1 shrink-0">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                        i < indexEtape ? "bg-green-500 text-white" : i === indexEtape ? "bg-blue-500 text-white" : "bg-slate-200 text-slate-500"
                      }`}
                    >
                      {i < indexEtape ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                    </div>
                    <span className="hidden sm:block text-[10px] text-slate-500">{ETAPE_LABELS[etape]}</span>
                  </div>
                  {i < etapes.length - 1 && (
                    <div className={`flex-1 h-0.5 mx-1 ${i < indexEtape ? "bg-green-500" : "bg-slate-200"}`} />
                  )}
                </div>
              ))}
            </div>

            {/* ================= Étape 1 — Exploitation ================= */}
            {s.etape === "exploitation" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-emerald-600" />
                    Où se trouve votre exploitation ?
                  </CardTitle>
                  <CardDescription>
                    La commune cale la météo, les conseils d&apos;arrosage et les calendriers de semis sur
                    votre climat. Une parcelle est créée à cet endroit — vous affinerez son contour sur la carte.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label>Nom de l&apos;exploitation (facultatif)</Label>
                    <Input
                      value={s.nomExploitation}
                      onChange={(e) => set("nomExploitation", e.target.value)}
                      placeholder="Ferme des Trois Chênes"
                    />
                  </div>
                  <div className="relative">
                    <Label>Commune</Label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        className="pl-8"
                        value={s.rechercheCommune}
                        onChange={(e) => {
                          set("rechercheCommune", e.target.value)
                          if (s.commune) set("commune", null)
                        }}
                        placeholder="Commencez à taper : Périgueux, Saint-Denis…"
                        autoComplete="off"
                      />
                      {chercheCommune && <Loader2 className="absolute right-2.5 top-3 h-4 w-4 animate-spin text-muted-foreground" />}
                    </div>
                    {suggestions.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full rounded-md border bg-white shadow-md">
                        {suggestions.map((c) => (
                          <button
                            key={c.code}
                            type="button"
                            onClick={() => choisirCommune(c)}
                            className="block w-full text-left px-3 py-2 text-sm hover:bg-emerald-50"
                          >
                            {c.nom}
                            {c.codesPostaux?.[0] ? <span className="text-muted-foreground"> — {c.codesPostaux[0]}</span> : null}
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="mt-1 text-xs text-muted-foreground">
                      Communes de France (outre-mer inclus). Hors de France : passez la commune et
                      choisissez votre zone climatique ci-dessous, puis dessinez votre parcelle sur la carte.
                    </p>
                  </div>
                  {s.commune && (
                    <div className="rounded-md border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-900">
                      <CheckCircle2 className="inline h-4 w-4 mr-1 align-text-bottom" />
                      {s.commune.nom}{s.commune.codePostal ? ` (${s.commune.codePostal})` : ""}
                      {zoneDerivee && s.zoneChoisie === "auto" && (
                        <> — climat détecté : <strong>{ZONE_CLIMAT_LABEL[zoneDerivee]}</strong></>
                      )}
                    </div>
                  )}
                  <div>
                    <Label>Zone climatique</Label>
                    <select
                      className="block h-10 w-full rounded-md border border-slate-300 px-3 bg-white"
                      value={s.zoneChoisie}
                      onChange={(e) => set("zoneChoisie", e.target.value as ZoneClimat | "auto")}
                    >
                      <option value="auto">
                        Automatique{zoneDerivee ? ` (${ZONE_CLIMAT_LABEL[zoneDerivee]})` : " — détectée depuis la commune"}
                      </option>
                      {ZONES_CLIMAT.map((z) => (
                        <option key={z} value={z}>{ZONE_CLIMAT_LABEL[z]}</option>
                      ))}
                    </select>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Elle décale les périodes de semis et plantation des calendriers. Laissez « Automatique » si la détection vous convient.
                    </p>
                  </div>
                </CardContent>
                {navigation({ onSuivant: validerExploitation, passer: true })}
              </Card>
            )}

            {/* ================= Étape 2 — Modules ================= */}
            {s.etape === "modules" && (
              <Card>
                <CardHeader>
                  <CardTitle>Quels modules utilisez-vous ?</CardTitle>
                  <CardDescription>
                    Les étapes suivantes s&apos;adaptent à ce choix. Modifiable à tout moment dans Paramètres &gt; Modules.
                  </CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 gap-3">
                  {[
                    { id: "maraichage" as const, label: "Maraîchage", icon: Sprout, color: "text-green-600 bg-green-50 border-green-200" },
                    { id: "verger" as const, label: "Verger & Forêt", icon: TreeDeciduous, color: "text-emerald-700 bg-emerald-50 border-emerald-200" },
                    { id: "elevage" as const, label: "Élevage", icon: Bird, color: "text-amber-700 bg-amber-50 border-amber-200" },
                    { id: "comptabilite" as const, label: "Comptabilité", icon: Wallet, color: "text-blue-700 bg-blue-50 border-blue-200" },
                  ].map((m) => {
                    const on = s.modulesActifs[m.id]
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => set("modulesActifs", { ...s.modulesActifs, [m.id]: !on })}
                        className={`p-4 rounded-lg border-2 text-left transition-all ${
                          on ? `${m.color} border-current shadow-sm` : "border-slate-200 bg-white text-slate-400"
                        }`}
                      >
                        <m.icon className="h-6 w-6 mb-2" />
                        <div className="font-medium">{m.label}</div>
                        <div className="text-xs mt-1">{on ? "Activé" : "Cliquez pour activer"}</div>
                      </button>
                    )
                  })}
                </CardContent>
                {s.modulesActifs.elevage && (
                  <div className="px-6 pb-2">
                    <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-3">
                      <div className="text-sm font-medium text-amber-900 flex items-center gap-2 mb-1">
                        <PawPrint className="h-4 w-4" /> Modes d&apos;élevage (optionnel)
                      </div>
                      <p className="text-xs text-amber-800 mb-2">
                        Au-delà du cheptel de rente, activez d&apos;autres familles d&apos;animaux. Les écrans Élevage s&apos;adaptent à chaque atelier.
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {ELEVAGE_MODE_IDS.map((id) => {
                          const on = s.modesElevage[id]
                          return (
                            <button
                              key={id}
                              type="button"
                              onClick={() => set("modesElevage", { ...s.modesElevage, [id]: !on })}
                              className={`px-3 py-1.5 rounded-full border text-sm transition-colors ${
                                on ? "border-amber-400 bg-amber-100 text-amber-900 font-medium" : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                              }`}
                              title={ELEVAGE_MODES[id].description}
                            >
                              {ELEVAGE_MODES[id].label}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )}
                {navigation({ onSuivant: validerModules })}
              </Card>
            )}

            {/* ================= Étape 3 — Production ================= */}
            {s.etape === "production" && (
              <Card>
                <CardHeader>
                  <CardTitle>Ce que vous produisez</CardTitle>
                  <CardDescription>
                    Le strict minimum pour que vos écrans ne soient pas vides — chaque saisie est réellement créée.
                    Tout est facultatif et s&apos;enrichit plus tard.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {s.modulesActifs.maraichage && (
                    <div className="border rounded p-3 space-y-2">
                      <Label className="flex items-center gap-2"><Sprout className="h-4 w-4 text-green-600" /> Première planche de culture</Label>
                      <div className="grid md:grid-cols-4 gap-2">
                        <Input className="md:col-span-2" placeholder="Nom (ex : Planche 1, Jardin Est)" value={s.plancheNom} onChange={(e) => set("plancheNom", e.target.value)} />
                        <Input type="number" inputMode="decimal" placeholder="Longueur (m)" value={s.plancheLongueur} onChange={(e) => set("plancheLongueur", e.target.value)} />
                        <Input type="number" inputMode="decimal" placeholder="Largeur (m)" value={s.plancheLargeur} onChange={(e) => set("plancheLargeur", e.target.value)} />
                      </div>
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground shrink-0">Type de sol</Label>
                        <select className="h-9 rounded-md border border-slate-300 px-2 bg-white text-sm" value={s.plancheSol} onChange={(e) => set("plancheSol", e.target.value as OnboardingState["plancheSol"])}>
                          {TYPES_SOL_ONBOARDING.map((t) => <option key={t} value={t}>{t}</option>)}
                        </select>
                      </div>
                    </div>
                  )}
                  {s.modulesActifs.verger && (
                    <div className="border rounded p-3 space-y-2">
                      <Label className="flex items-center gap-2"><TreeDeciduous className="h-4 w-4 text-emerald-700" /> Premier arbre</Label>
                      <div className="grid md:grid-cols-2 gap-2">
                        <Input placeholder="Espèce (Pommier, Olivier…)" value={s.arbreEspece} onChange={(e) => set("arbreEspece", e.target.value)} />
                        <Input placeholder="Nom (facultatif : Pommier du fond)" value={s.arbreNom} onChange={(e) => set("arbreNom", e.target.value)} />
                      </div>
                    </div>
                  )}
                  {s.modulesActifs.elevage && (
                    <div className="border rounded p-3 space-y-2">
                      <Label className="flex items-center gap-2"><Bird className="h-4 w-4 text-amber-700" /> Votre cheptel</Label>
                      <p className="text-xs text-muted-foreground">
                        Cochez et indiquez l&apos;effectif : un lot est créé par espèce (la race exacte s&apos;affine ensuite).
                        Un troupeau déjà tenu ailleurs s&apos;importe par fichier depuis Élevage &gt; Animaux &gt; Importer CSV
                        (<a href="/csv-templates/animaux.csv" download className="underline">modèle</a>).
                      </p>
                      <div className="grid sm:grid-cols-2 gap-2">
                        {CHEPTEL_ONBOARDING.map((c) => {
                          const actif = c.especeAnimaleId in s.cheptel
                          return (
                            <div key={c.especeAnimaleId} className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${actif ? "border-amber-300 bg-amber-50" : "border-slate-200"}`}>
                              <button
                                type="button"
                                onClick={() => {
                                  const suivant = { ...s.cheptel }
                                  if (actif) delete suivant[c.especeAnimaleId]
                                  else suivant[c.especeAnimaleId] = ""
                                  set("cheptel", suivant)
                                }}
                                className={`flex-1 text-left text-sm ${actif ? "text-amber-900 font-medium" : "text-slate-600"}`}
                              >
                                {c.libelle}
                              </button>
                              {actif && (
                                <Input
                                  type="number"
                                  inputMode="numeric"
                                  min={1}
                                  placeholder="Nb"
                                  className="h-8 w-20"
                                  value={s.cheptel[c.especeAnimaleId] ?? ""}
                                  onChange={(e) => set("cheptel", { ...s.cheptel, [c.especeAnimaleId]: e.target.value })}
                                />
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
                {navigation({ onSuivant: validerProduction, passer: true })}
              </Card>
            )}

            {/* ================= Étape 4 — Facturation ================= */}
            {s.etape === "facturation" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5 text-blue-600" />
                    Identité de facturation
                  </CardTitle>
                  <CardDescription>
                    Requise pour émettre des factures conformes (art. 242 nonies A CGI). Vous pouvez passer
                    et compléter plus tard dans Paramètres &gt; Exploitation.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <Label>Raison sociale</Label>
                      <Input value={s.raisonSociale} onChange={(e) => set("raisonSociale", e.target.value)} placeholder={s.nomExploitation || "EARL Le Pré Vert"} />
                    </div>
                    <div>
                      <Label>Forme juridique</Label>
                      <select className="block h-10 w-full rounded-md border border-slate-300 px-3 bg-white" value={s.formeJuridique} onChange={(e) => set("formeJuridique", e.target.value)}>
                        <option value="EI">Entreprise individuelle</option>
                        <option value="GAEC">GAEC</option>
                        <option value="EARL">EARL</option>
                        <option value="SCEA">SCEA</option>
                        <option value="SARL">SARL</option>
                        <option value="SAS">SAS</option>
                        <option value="autre">Autre</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <Label>Territoire</Label>
                    <select className="block h-10 w-full rounded-md border border-slate-300 px-3 bg-white" value={s.territoire} onChange={(e) => onTerritoireChange(e.target.value)}>
                      {CODES_TERRITOIRES.map((c) => (
                        <option key={c} value={c}>{TERRITOIRES[c].label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      {usesSiret ? (
                        <>
                          <Label>SIRET</Label>
                          <Input value={s.siret} onChange={(e) => set("siret", e.target.value)} placeholder="123 456 789 00012" inputMode="numeric" />
                        </>
                      ) : (
                        <>
                          <Label>{terr.labelIdentifiant}</Label>
                          <Input value={s.identifiantLegal} onChange={(e) => set("identifiantLegal", e.target.value)} placeholder={terr.placeholderIdentifiant} />
                        </>
                      )}
                    </div>
                    <div>
                      <Label>Email contact</Label>
                      <Input type="email" value={s.emailContact} onChange={(e) => set("emailContact", e.target.value)} placeholder="contact@..." />
                    </div>
                  </div>
                  <div>
                    <Label>Adresse</Label>
                    <Input value={s.adresseSiege} onChange={(e) => set("adresseSiege", e.target.value)} placeholder="Lieu-dit Les Tilleuls" />
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <Label>Code postal</Label>
                      <Input value={s.codePostal} onChange={(e) => set("codePostal", e.target.value)} placeholder="24000" />
                    </div>
                    <div>
                      <Label>Ville</Label>
                      <Input value={s.ville} onChange={(e) => set("ville", e.target.value)} placeholder="Périgueux" />
                    </div>
                  </div>
                  <div className="grid md:grid-cols-2 gap-3">
                    <div>
                      <Label>Régime fiscal</Label>
                      <select className="block h-10 w-full rounded-md border border-slate-300 px-3 bg-white" value={s.regimeFiscal} onChange={(e) => set("regimeFiscal", e.target.value)}>
                        <option value="micro-BA">Micro-BA</option>
                        <option value="reel-simplifie">Réel simplifié</option>
                        <option value="reel-normal">Réel normal</option>
                      </select>
                    </div>
                    <div>
                      <Label>Régime TVA</Label>
                      <select className="block h-10 w-full rounded-md border border-slate-300 px-3 bg-white" value={s.regimeTva} onChange={(e) => set("regimeTva", e.target.value)}>
                        {terr.regimesTva.map((r) => (
                          <option key={r} value={r}>{LABELS_REGIME_TVA[r]}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </CardContent>
                {navigation({ onSuivant: validerFacturation, suivantLabel: "Enregistrer et continuer", passer: true })}
              </Card>
            )}

            {/* ================= Étape 5 — Démarrage ================= */}
            {s.etape === "demarrage" && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <PartyPopper className="h-5 w-5 text-pink-600" />
                    C&apos;est prêt !
                  </CardTitle>
                  <CardDescription>Votre configuration minimale, telle qu&apos;elle a été créée :</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <ul className="space-y-2 text-sm">
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                      {s.commune
                        ? <>Exploitation localisée à <strong>{s.commune.nom}</strong>{zoneEffective ? <> — climat {ZONE_CLIMAT_LABEL[zoneEffective]}</> : null}{creations.parcelle ? <> (parcelle « {creations.parcelle} » à affiner sur la carte)</> : null}</>
                        : <>Localisation à définir — dessinez votre parcelle depuis la carte pour caler la météo</>}
                    </li>
                    <li className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
                      Modules : {modulesActifsList.map((m) => MODULES[m].label).join(", ") || "aucun"}
                    </li>
                    {creations.planche && (
                      <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" /> Planche « {creations.planche} » créée</li>
                    )}
                    {creations.arbre && (
                      <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" /> Arbre « {creations.arbre} » créé</li>
                    )}
                    {creations.lots.length > 0 && (
                      <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" /> Cheptel : {creations.lots.join(", ")}</li>
                    )}
                  </ul>

                  {(s.modulesActifs.maraichage || s.modulesActifs.verger) && (
                    <label className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50 p-3 cursor-pointer">
                      <Checkbox
                        checked={s.avecExemple}
                        onCheckedChange={(v) => set("avecExemple", v === true)}
                        className="mt-0.5"
                      />
                      <span className="text-sm text-slate-700">
                        <span className="font-medium flex items-center gap-1"><Database className="h-4 w-4" /> Ajouter des données d&apos;exemple</span>
                        Quelques planches, cultures{s.modulesActifs.verger ? " et arbres" : ""} de démonstration pour explorer les écrans
                        — géolocalisées sur votre exploitation, identifiables et supprimables.
                      </span>
                    </label>
                  )}
                </CardContent>
                <div className="flex justify-between px-6 pb-6">
                  <Button variant="outline" onClick={precedente} disabled={saving}>
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Précédent
                  </Button>
                  <Button onClick={finir} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                    Démarrer
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </div>
  )
}
