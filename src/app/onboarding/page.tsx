"use client"

/**
 * Wizard d'onboarding nouveau compte (PROMPT 22).
 *
 * 5 étapes : profil exploitation → modules → premier élément →
 * import CSV (optionnel) → fin (active onboarding_completed et redirige).
 */

import * as React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import {
  ChevronRight,
  ChevronLeft,
  Sprout,
  TreeDeciduous,
  Bird,
  Wallet,
  CheckCircle2,
  Building2,
  Upload,
  PartyPopper,
  Loader2,
  SkipForward,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { useToast } from "@/hooks/use-toast"
import { CODES_TERRITOIRES, TERRITOIRES, getTerritoire, LABELS_REGIME_TVA } from "@/lib/territoires"

const STEPS = ["Exploitation", "Modules", "Premier élément", "Import (optionnel)", "C'est parti !"]

interface OnboardingState {
  step: number
  // Étape 1
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
  // Étape 2
  modulesActifs: { maraichage: boolean; verger: boolean; elevage: boolean; comptabilite: boolean }
  // Étape 3 — premiers éléments
  parcelleNom: string
  parcelleSurface: string
  parcelleSol: string
  arbreEspece: string
  arbreNom: string
  elevageEspeces: string[]
  // Étape 4
  csvType: string
  csvFile: File | null
}

const empty: OnboardingState = {
  step: 0,
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
  modulesActifs: { maraichage: true, verger: false, elevage: false, comptabilite: true },
  parcelleNom: "",
  parcelleSurface: "",
  parcelleSol: "limon",
  arbreEspece: "Pommier",
  arbreNom: "",
  elevageEspeces: [],
  csvType: "cultures",
  csvFile: null,
}

export default function OnboardingPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [s, setS] = React.useState<OnboardingState>(empty)
  const [saving, setSaving] = React.useState(false)
  const set = <K extends keyof OnboardingState>(key: K, v: OnboardingState[K]) =>
    setS((prev) => ({ ...prev, [key]: v }))

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

  const next = () => set("step", Math.min(s.step + 1, STEPS.length - 1))
  const prev = () => set("step", Math.max(s.step - 1, 0))

  const submitExploitation = async () => {
    if (!s.siret && !s.identifiantLegal && !s.raisonSociale) {
      next()
      return
    }
    setSaving(true)
    try {
      const res = await fetch("/api/exploitation", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          raisonSociale: s.raisonSociale,
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
        const j = await res.json()
        toast({ variant: "destructive", title: "Champs incorrects", description: j.error || "Vérifiez la saisie" })
        return
      }
      next()
    } finally {
      setSaving(false)
    }
  }

  const saveModules = async () => {
    const modules = Object.entries(s.modulesActifs)
      .filter(([, on]) => on)
      .map(([k]) => k)
    try {
      await fetch("/api/user/preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ modulesActifs: modules }),
      })
    } catch {
      // Silencieux, la pref est créée à la 1ère utilisation sinon
    }
    next()
  }

  const finir = async () => {
    setSaving(true)
    try {
      // Audit 2026-07 (#31) : la parcelle saisie à l'étape « premier élément »
      // n'était jamais enregistrée. On la crée comme planche (non bloquant).
      if (s.parcelleNom.trim()) {
        try {
          const surface = s.parcelleSurface ? parseFloat(s.parcelleSurface.replace(",", ".")) : null
          await fetch("/api/planches", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              nom: s.parcelleNom.trim(),
              surface: surface && !Number.isNaN(surface) ? surface : null,
              typeSol: s.parcelleSol || null,
            }),
          })
        } catch {
          /* non bloquant : l'utilisateur pourra créer sa planche ensuite */
        }
      }
      // Audit #87 : si le marquage onboarding échoue, ne pas rediriger (sinon
      // l'utilisateur est renvoyé vers /onboarding en boucle par le middleware).
      const res = await fetch("/api/onboarding", { method: "POST" })
      if (!res.ok) {
        toast({ variant: "destructive", title: "Erreur", description: "La finalisation a échoué, réessayez." })
        return
      }
      const firstModule = Object.entries(s.modulesActifs).find(([, on]) => on)?.[0] || "maraichage"
      const target = firstModule === "maraichage" ? "/maraichage" : `/${firstModule}`
      router.push(target)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-white to-blue-50 py-10 px-4">
      <div className="container mx-auto max-w-3xl">
        {/* Header */}
        <div className="text-center mb-6">
          <h1 className="text-3xl font-bold text-slate-900 mb-2">Bienvenue sur Gleba</h1>
          <p className="text-slate-600">
            Quelques minutes pour configurer votre exploitation. Vous pourrez tout modifier plus tard.
          </p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-between mb-8 px-2">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center flex-1">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  i < s.step ? "bg-green-500 text-white" : i === s.step ? "bg-blue-500 text-white" : "bg-slate-200 text-slate-500"
                }`}
              >
                {i < s.step ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`flex-1 h-0.5 mx-1 ${i < s.step ? "bg-green-500" : "bg-slate-200"}`} />
              )}
            </div>
          ))}
        </div>

        {/* Step content */}
        {s.step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-blue-600" />
                Identité de l'exploitation
              </CardTitle>
              <CardDescription>
                Requise pour émettre des factures conformes (art. 242 nonies A CGI). Vous pouvez passer cette étape et la compléter plus tard dans Paramètres &gt; Exploitation.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <Label>Raison sociale</Label>
                  <Input value={s.raisonSociale} onChange={(e) => set("raisonSociale", e.target.value)} placeholder="EARL Le Pré Vert" />
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
            <div className="flex justify-between px-6 pb-6">
              <Button variant="ghost" onClick={next}>
                <SkipForward className="h-4 w-4 mr-1" />
                Passer
              </Button>
              <Button onClick={submitExploitation} disabled={saving}>
                {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                Enregistrer et continuer
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </Card>
        )}

        {s.step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Quels modules utilisez-vous ?</CardTitle>
              <CardDescription>
                Activez ceux qui vous concernent. Vous pourrez les modifier à tout moment dans Paramètres &gt; Modules.
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
            <div className="flex justify-between px-6 pb-6">
              <Button variant="outline" onClick={prev}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Précédent
              </Button>
              <Button onClick={saveModules}>
                Continuer
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </Card>
        )}

        {s.step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Créez votre premier élément</CardTitle>
              <CardDescription>
                Ces formulaires express vous évitent de partir d'une page vide. Vous pouvez tout enrichir plus tard.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {s.modulesActifs.maraichage && (
                <div className="border rounded p-3 space-y-2">
                  <Label className="flex items-center gap-2"><Sprout className="h-4 w-4 text-green-600" /> Première parcelle (Maraîchage)</Label>
                  <div className="grid md:grid-cols-3 gap-2">
                    <Input placeholder="Nom (ex: Jardin Est)" value={s.parcelleNom} onChange={(e) => set("parcelleNom", e.target.value)} />
                    <Input type="number" placeholder="Surface m²" value={s.parcelleSurface} onChange={(e) => set("parcelleSurface", e.target.value)} />
                    <select className="h-10 rounded-md border border-slate-300 px-2 bg-white" value={s.parcelleSol} onChange={(e) => set("parcelleSol", e.target.value)}>
                      <option value="limon">Limoneux</option>
                      <option value="sable">Sableux</option>
                      <option value="argile">Argileux</option>
                      <option value="calcaire">Calcaire</option>
                      <option value="autre">Autre / mixte</option>
                    </select>
                  </div>
                </div>
              )}
              {s.modulesActifs.verger && (
                <div className="border rounded p-3 space-y-2">
                  <Label className="flex items-center gap-2"><TreeDeciduous className="h-4 w-4 text-emerald-700" /> Premier arbre (Verger)</Label>
                  <div className="grid md:grid-cols-2 gap-2">
                    <Input placeholder="Espèce (Pommier, Olivier...)" value={s.arbreEspece} onChange={(e) => set("arbreEspece", e.target.value)} />
                    <Input placeholder="Nom (optionnel)" value={s.arbreNom} onChange={(e) => set("arbreNom", e.target.value)} />
                  </div>
                </div>
              )}
              {s.modulesActifs.elevage && (
                <div className="border rounded p-3 space-y-2">
                  <Label className="flex items-center gap-2"><Bird className="h-4 w-4 text-amber-700" /> Quel cheptel avez-vous ?</Label>
                  <div className="flex flex-wrap gap-2">
                    {["Poules", "Chèvres", "Brebis", "Cochons", "Vaches", "Lapins"].map((e) => {
                      const on = s.elevageEspeces.includes(e)
                      return (
                        <button
                          key={e}
                          type="button"
                          onClick={() =>
                            set(
                              "elevageEspeces",
                              on ? s.elevageEspeces.filter((x) => x !== e) : [...s.elevageEspeces, e]
                            )
                          }
                          className={`px-3 py-1.5 rounded-full text-sm border ${
                            on ? "bg-amber-100 border-amber-300 text-amber-800" : "bg-white border-slate-200 text-slate-500"
                          }`}
                        >
                          {e}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
              {s.modulesActifs.comptabilite && (
                <div className="border rounded p-3 space-y-2 text-sm text-slate-600">
                  <Label className="flex items-center gap-2"><Wallet className="h-4 w-4 text-blue-700" /> Boutique en ligne (optionnel)</Label>
                  <p>Vous pourrez créer votre boutique publique depuis le module Comptabilité &gt; Boutique. C'est facultatif.</p>
                </div>
              )}
              {!Object.values(s.modulesActifs).some(Boolean) && (
                <p className="text-sm text-slate-500">Aucun module activé. Revenez à l'étape précédente pour en choisir au moins un.</p>
              )}
            </CardContent>
            <div className="flex justify-between px-6 pb-6">
              <Button variant="outline" onClick={prev}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Précédent
              </Button>
              <Button onClick={next}>
                Continuer
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </Card>
        )}

        {s.step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5 text-purple-600" />
                Import depuis Excel (optionnel)
              </CardTitle>
              <CardDescription>
                Si vous avez déjà des données dans un tableur, importez-les. Sinon, passez cette étape.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid md:grid-cols-3 gap-2">
                <a href="/csv-templates/cultures.csv" download className="border rounded p-3 text-sm hover:bg-slate-50">
                  <strong>Cultures.csv</strong>
                  <p className="text-xs text-slate-500 mt-1">Template Maraîchage</p>
                </a>
                <a href="/csv-templates/arbres.csv" download className="border rounded p-3 text-sm hover:bg-slate-50">
                  <strong>Arbres.csv</strong>
                  <p className="text-xs text-slate-500 mt-1">Template Verger</p>
                </a>
                <a href="/csv-templates/animaux.csv" download className="border rounded p-3 text-sm hover:bg-slate-50">
                  <strong>Animaux.csv</strong>
                  <p className="text-xs text-slate-500 mt-1">Template Élevage</p>
                </a>
              </div>
              <p className="text-xs text-slate-500">
                Compatible export Mes Parcelles / Tom Pousse (à venir). Pour le MVP, les templates ci-dessus indiquent les colonnes attendues.
              </p>
            </CardContent>
            <div className="flex justify-between px-6 pb-6">
              <Button variant="outline" onClick={prev}>
                <ChevronLeft className="h-4 w-4 mr-1" />
                Précédent
              </Button>
              <Button onClick={next}>
                Passer
                <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          </Card>
        )}

        {s.step === 4 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <PartyPopper className="h-5 w-5 text-pink-600" />
                C'est prêt !
              </CardTitle>
              <CardDescription>
                Votre exploitation est configurée. Retrouvez l'aide dans /aide et les raccourcis dans /raccourcis.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="space-y-2 text-sm">
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /> Identité légale {s.siret ? "renseignée" : "à compléter plus tard"}</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /> Modules activés : {Object.entries(s.modulesActifs).filter(([, on]) => on).map(([k]) => k).join(", ") || "aucun"}</li>
                <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-green-600" /> Vous trouverez l'aide dans <Link href="/aide" className="underline">/aide</Link> et les raccourcis dans <Link href="/raccourcis" className="underline">/raccourcis</Link></li>
              </ul>
            </CardContent>
            <div className="flex justify-between px-6 pb-6">
              <Button variant="outline" onClick={prev}>
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
      </div>
    </div>
  )
}
