"use client"

/**
 * Sélection (Phase 1 — filière compagnie/équin) :
 *  - Compatibilité d'accouplement (COI) : détection d'ancêtres communs entre
 *    deux reproducteurs via /api/elevage/consanguinite.
 *  - Tests santé / génétiques par animal (dysplasie A-E, coude 0-3, panels ADN,
 *    ADN de filiation ISAG…), via /api/elevage/tests-sante.
 * Le pedigree complet reste accessible depuis la fiche de l'animal.
 */

import * as React from "react"
import Link from "next/link"
import { Dna, HeartPulse, Plus, Trash2, ExternalLink } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useToast } from "@/hooks/use-toast"
import { AnimalCombobox } from "./AnimalCombobox"
import { confirmDialog } from "@/lib/global-dialog"
import { useFiliereSelection, filiereMatch } from "@/lib/elevage/filiere-context"
import { type Filiere } from "@/lib/elevage/filiere"
import { especeBaseId } from "@/lib/elevage/espece-base"
import type { TypeTestSante } from "@/lib/elevage/tests-sante"

type Animal = { id: number; nom: string | null; identifiant: string | null; sexe: string | null; race: string | null; especeAnimale?: { id: string; nom?: string | null; filiere: string | null } | null }
type TestSante = { id: string; animalId: number; type: string; resultat: string | null; laboratoire: string | null; reference: string | null; date: string | null; notes: string | null }

type TestType = { v: TypeTestSante; label: string; hint: string }

// Catalogues de tests par filière : le chien/chat, le cheval et les NAC n'ont
// pas les mêmes examens de sélection (feedback Guillaume 2026-07-25).
const TESTS_COMPAGNIE: TestType[] = [
  { v: "dysplasie_hanche", label: "Dysplasie hanche", hint: "A / B / C / D / E" },
  { v: "dysplasie_coude", label: "Dysplasie coude", hint: "0 / SL / 1 / 2 / 3" },
  { v: "oeil", label: "Tares oculaires", hint: "indemne / atteint (APR, AOC…)" },
  { v: "adn_maladie", label: "Panel ADN (maladie)", hint: "indemne / porteur / atteint" },
  { v: "adn_filiation", label: "ADN de filiation (ISAG)", hint: "conforme / n° carte" },
  { v: "autre", label: "Autre", hint: "" },
]
const TESTS_EQUIN: TestType[] = [
  { v: "radio_osteochondrose", label: "Radios (ostéochondrose)", hint: "indemne / OCD / kyste…" },
  { v: "adn_maladie", label: "Panel ADN (SCID, PSSM1, HYPP…)", hint: "indemne / porteur / atteint" },
  { v: "adn_filiation", label: "ADN / filiation (SNP)", hint: "conforme / n° carte" },
  { v: "aie", label: "Anémie infectieuse (Coggins)", hint: "négatif / positif" },
  { v: "autre", label: "Autre", hint: "" },
]
const TESTS_NAC: TestType[] = [
  { v: "adn_maladie", label: "Test génétique", hint: "indemne / porteur / atteint" },
  { v: "bilan_sante", label: "Bilan santé vétérinaire", hint: "RAS / anomalie" },
  { v: "autre", label: "Autre", hint: "" },
]
const ALL_TESTS: TestType[] = [...TESTS_COMPAGNIE, ...TESTS_EQUIN, ...TESTS_NAC]
const typeLabel = (v: string) => ALL_TESTS.find((t) => t.v === v)?.label ?? v

const EMPTY_TEST = { animalId: "", type: "dysplasie_hanche", resultat: "", laboratoire: "", reference: "", date: "", notes: "" }
const COTATION_LABEL: Record<number, string> = { 1: "Confirmé", 2: "Reconnu", 3: "Sélectionné", 4: "Recommandé", 5: "Élite B", 6: "Élite A" }
const EMPTY_PED = { numeroLof: "", cotation: "", confirmationLof: false, dateConfirmation: "", titres: "" }

type SelConfig = {
  testTypes: TestType[]
  testsDescription: string
  registreLabel: string
  showCotation: boolean
  confirmationLabel: string
  titresLabel: string
  titresPlaceholder: string
  pedigreeTitle: string
}
function selConfig(filiere: Filiere): SelConfig {
  if (filiere === "equin") return {
    testTypes: TESTS_EQUIN,
    testsDescription: "Radios (ostéochondrose), panels ADN équins (SCID, PSSM1, HYPP…), filiation, anémie infectieuse. Le pedigree complet est sur la fiche.",
    registreLabel: "N° SIRE / UELN",
    showCotation: false,
    confirmationLabel: "Inscrit au stud-book",
    titresLabel: "Indices / qualifications",
    titresPlaceholder: "Indice de saut, qualification, résultat de concours…",
    pedigreeTitle: "Papiers & stud-book",
  }
  if (filiere === "nac") return {
    testTypes: TESTS_NAC,
    testsDescription: "Tests génétiques éventuels et bilan santé vétérinaire selon l'espèce. Le pedigree complet est sur la fiche.",
    registreLabel: "N° de registre / élevage",
    showCotation: false,
    confirmationLabel: "Inscrit au registre",
    titresLabel: "Résultats d'exposition",
    titresPlaceholder: "Titre de club, concours…",
    pedigreeTitle: "Pedigree & registre",
  }
  return {
    testTypes: TESTS_COMPAGNIE,
    testsDescription: "Dysplasie (hanche A-E, coude 0-3), tares oculaires, panels ADN, ADN de filiation. Le pedigree complet est sur la fiche de l'animal.",
    registreLabel: "N° LOF / LOOF",
    showCotation: true,
    confirmationLabel: "Confirmé(e)",
    titresLabel: "Titres / résultats d'expo",
    titresPlaceholder: "CACS Paris 2025, Champion de France…",
    pedigreeTitle: "Pedigree & cotation",
  }
}

export function SelectionSubTab() {
  const { toast } = useToast()
  const filiereSel = useFiliereSelection()
  const cfg = selConfig(filiereSel === "equin" ? "equin" : filiereSel === "nac" ? "nac" : "compagnie")
  const [animaux, setAnimaux] = React.useState<Animal[]>([])
  // COI
  const [femelleId, setFemelleId] = React.useState("")
  const [maleId, setMaleId] = React.useState("")
  const [coi, setCoi] = React.useState<{ consanguinite: boolean; ancetresCommuns: Array<{ id?: number; nom?: string | null; identifiant?: string | null }> } | null>(null)
  const [coiLoading, setCoiLoading] = React.useState(false)
  // Tests
  const [testAnimalId, setTestAnimalId] = React.useState("")
  const [tests, setTests] = React.useState<TestSante[]>([])
  const [form, setForm] = React.useState(EMPTY_TEST)
  const [ped, setPed] = React.useState(EMPTY_PED)

  React.useEffect(() => {
    fetch("/api/elevage/animaux?statut=actif", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { data: [] })).then((j) => setAnimaux(j.data ?? [])).catch(() => {})
  }, [])

  const chargerTests = React.useCallback((animalId: string) => {
    if (!animalId) { setTests([]); return }
    fetch(`/api/elevage/tests-sante?animalId=${animalId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { data: [] })).then((j) => setTests(j.data ?? [])).catch(() => {})
  }, [])
  React.useEffect(() => { chargerTests(testAnimalId) }, [testAnimalId, chargerTests])
  // Le type de test par défaut dépend de la filière (dysplasie pour un chien,
  // radios pour un cheval…) : on réaligne form.type si l'atelier change.
  React.useEffect(() => {
    setForm((f) => (cfg.testTypes.some((t) => t.v === f.type) ? f : { ...f, type: cfg.testTypes[0].v }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filiereSel])
  React.useEffect(() => {
    if (!testAnimalId) { setPed(EMPTY_PED); return }
    fetch(`/api/elevage/pedigree?animalId=${testAnimalId}`, { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : { data: null }))
      .then((j) => {
        const d = j.data
        setPed(d ? {
          numeroLof: d.numeroLof ?? "", cotation: d.cotation != null ? String(d.cotation) : "",
          confirmationLof: !!d.confirmationLof, dateConfirmation: d.dateConfirmation ? d.dateConfirmation.split("T")[0] : "", titres: d.titres ?? "",
        } : EMPTY_PED)
      })
      .catch(() => setPed(EMPTY_PED))
  }, [testAnimalId])

  const lancerCoi = async () => {
    if (!femelleId || !maleId) { toast({ variant: "destructive", title: "Choisissez la femelle et le mâle" }); return }
    setCoiLoading(true); setCoi(null)
    try {
      const r = await fetch(`/api/elevage/consanguinite?femelleId=${femelleId}&maleId=${maleId}&generations=4`)
      const j = await r.json()
      if (!r.ok) { toast({ variant: "destructive", title: "Erreur", description: j?.error }); return }
      setCoi(j)
    } finally { setCoiLoading(false) }
  }

  const ajouterTest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.animalId || !form.type) { toast({ variant: "destructive", title: "Animal et type requis" }); return }
    const res = await fetch("/api/elevage/tests-sante", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, animalId: Number(form.animalId) }),
    })
    if (!res.ok) { const j = await res.json().catch(() => null); toast({ variant: "destructive", title: "Erreur", description: j?.error }); return }
    toast({ title: "Test enregistré" })
    setForm((f) => ({ ...EMPTY_TEST, animalId: f.animalId, type: f.type }))
    if (String(form.animalId) === testAnimalId) chargerTests(testAnimalId)
    else setTestAnimalId(String(form.animalId))
  }

  const supprimerTest = async (t: TestSante) => {
    if (!(await confirmDialog("Supprimer ce test ?"))) return
    const res = await fetch(`/api/elevage/tests-sante?id=${t.id}`, { method: "DELETE" })
    if (res.ok) chargerTests(testAnimalId); else toast({ variant: "destructive", title: "Erreur" })
  }

  const savePed = async () => {
    const res = await fetch("/api/elevage/pedigree", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ animalId: Number(testAnimalId), ...ped, cotation: ped.cotation || null }),
    })
    if (res.ok) toast({ title: "Pedigree & cotation enregistrés" })
    else toast({ variant: "destructive", title: "Erreur" })
  }

  // Scope par filière d'atelier (ne mélange pas cheptel / compagnie / équin / NAC).
  const animauxF = animaux.filter((a) => filiereMatch(filiereSel, a.especeAnimale?.filiere))
  // Pour le COI : le mâle est restreint à la même espèce de base que la femelle choisie.
  const femelleSel = animauxF.find((a) => String(a.id) === femelleId)
  const baseFem = femelleSel ? especeBaseId(femelleSel.especeAnimale?.id ?? "") : null
  const femelles = animauxF.filter((a) => a.sexe === "femelle")
  const males = animauxF.filter((a) => a.sexe === "male" && (!baseFem || especeBaseId(a.especeAnimale?.id ?? "") === baseFem))
  const hint = cfg.testTypes.find((t) => t.v === form.type)?.hint

  return (
    <div className="space-y-4">
      {/* COI / compatibilité d'accouplement */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><HeartPulse className="h-5 w-5 text-rose-600" />Compatibilité d’accouplement</CardTitle>
          <CardDescription>Détecte les ancêtres communs entre deux reproducteurs (consanguinité) sur 4 générations, avant de planifier une saillie.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-2"><Label>Femelle</Label><AnimalCombobox animaux={femelles} value={femelleId} onChange={setFemelleId} placeholder="N° ou nom…" emptyLabel="Choisir la femelle…" /></div>
            <div className="space-y-2"><Label>Mâle</Label><AnimalCombobox animaux={males} value={maleId} onChange={setMaleId} placeholder="N° ou nom…" emptyLabel="Choisir le mâle…" /></div>
          </div>
          <Button size="sm" onClick={lancerCoi} disabled={coiLoading || !femelleId || !maleId}>{coiLoading ? "Analyse…" : "Vérifier la compatibilité"}</Button>
          {coi && (
            <div className={`rounded-lg border p-3 text-sm ${coi.consanguinite ? "border-amber-300 bg-amber-50 text-amber-900" : "border-emerald-300 bg-emerald-50 text-emerald-800"}`}>
              {coi.consanguinite
                ? <><strong>⚠️ Consanguinité détectée</strong> — {coi.ancetresCommuns.length} ancêtre(s) commun(s) : {coi.ancetresCommuns.map((a) => a.nom || a.identifiant || `#${a.id}`).join(", ")}</>
                : <><strong>✓ Aucun ancêtre commun</strong> sur 4 générations.</>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tests santé / génétiques */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Dna className="h-5 w-5 text-blue-600" />Tests santé & génétiques</CardTitle>
          <CardDescription>{cfg.testsDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={ajouterTest} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6 items-end">
            <div className="space-y-1 lg:col-span-2">
              <Label className="text-xs">Animal</Label>
              <AnimalCombobox animaux={animauxF} value={form.animalId} onChange={(v) => setForm((f) => ({ ...f, animalId: v }))} placeholder="N° ou nom…" emptyLabel="Choisir…" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Type</Label>
              <Select value={form.type} onValueChange={(v) => setForm((f) => ({ ...f, type: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>{cfg.testTypes.map((t) => <SelectItem key={t.v} value={t.v}>{t.label}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label className="text-xs">Résultat</Label><Input className="h-9" value={form.resultat} onChange={(e) => setForm((f) => ({ ...f, resultat: e.target.value }))} placeholder={hint} /></div>
            <div className="space-y-1"><Label className="text-xs">Labo</Label><Input className="h-9" value={form.laboratoire} onChange={(e) => setForm((f) => ({ ...f, laboratoire: e.target.value }))} /></div>
            <div className="space-y-1"><Label className="text-xs">Date</Label><Input className="h-9" type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} /></div>
            <div className="lg:col-span-6"><Button type="submit" size="sm" disabled={!form.animalId}><Plus className="h-4 w-4 mr-1" />Ajouter le test</Button></div>
          </form>

          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <Label className="text-xs text-muted-foreground">Voir les tests de :</Label>
              <div className="w-64"><AnimalCombobox animaux={animauxF} value={testAnimalId} onChange={setTestAnimalId} placeholder="Choisir un animal…" emptyLabel="Choisir un animal…" /></div>
              {testAnimalId && <Link href={`/elevage/animaux/${testAnimalId}`} className="text-xs text-blue-600 inline-flex items-center gap-1 hover:underline"><ExternalLink className="h-3 w-3" />Pedigree / fiche</Link>}
            </div>
            {testAnimalId && (
              tests.length === 0 ? (
                <p className="text-xs text-muted-foreground">Aucun test enregistré pour cet animal.</p>
              ) : (
                <div className="divide-y border rounded-lg">
                  {tests.map((t) => (
                    <div key={t.id} className="flex items-center gap-2 p-2 text-sm">
                      <Badge variant="outline" className="text-xs">{typeLabel(t.type)}</Badge>
                      <span className="font-medium">{t.resultat || "—"}</span>
                      <span className="text-xs text-muted-foreground flex-1">{[t.laboratoire, t.reference, t.date ? new Date(t.date).toLocaleDateString("fr-FR") : null].filter(Boolean).join(" · ")}</span>
                      <Button variant="ghost" size="sm" className="text-red-600" onClick={() => supprimerTest(t)}><Trash2 className="h-4 w-4" /></Button>
                    </div>
                  ))}
                </div>
              )
            )}
            {testAnimalId && (
              <div className="border-t pt-3 space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <Label className="text-sm font-medium flex items-center gap-2"><Dna className="h-4 w-4 text-blue-600" />{cfg.pedigreeTitle}</Label>
                  <Button size="sm" variant="outline" onClick={() => window.open(`/api/elevage/animaux/${testAnimalId}/pedigree`, "_blank")}><ExternalLink className="h-4 w-4 mr-1" />Exporter le pedigree (PDF)</Button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 items-end">
                  <div className="space-y-1"><Label className="text-xs">{cfg.registreLabel}</Label><Input className="h-9" value={ped.numeroLof} onChange={(e) => setPed((p) => ({ ...p, numeroLof: e.target.value }))} /></div>
                  {cfg.showCotation && (
                    <div className="space-y-1">
                      <Label className="text-xs">Cotation (1-6)</Label>
                      <Select value={ped.cotation || "__none__"} onValueChange={(v) => setPed((p) => ({ ...p, cotation: v === "__none__" ? "" : v }))}>
                        <SelectTrigger className="h-9"><SelectValue placeholder="—" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="__none__">—</SelectItem>
                          {[1, 2, 3, 4, 5, 6].map((n) => <SelectItem key={n} value={String(n)}>{n} — {COTATION_LABEL[n]}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-1"><Label className="text-xs">Confirmation</Label><label className="flex h-9 items-center gap-2 text-sm"><input type="checkbox" checked={ped.confirmationLof} onChange={(e) => setPed((p) => ({ ...p, confirmationLof: e.target.checked }))} />{cfg.confirmationLabel}</label></div>
                  <div className="space-y-1"><Label className="text-xs">Date confirmation</Label><Input className="h-9" type="date" value={ped.dateConfirmation} onChange={(e) => setPed((p) => ({ ...p, dateConfirmation: e.target.value }))} /></div>
                  <div className="space-y-1 lg:col-span-3"><Label className="text-xs">{cfg.titresLabel}</Label><Input className="h-9" value={ped.titres} onChange={(e) => setPed((p) => ({ ...p, titres: e.target.value }))} placeholder={cfg.titresPlaceholder} /></div>
                  <div><Button size="sm" onClick={savePed}>Enregistrer</Button></div>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
