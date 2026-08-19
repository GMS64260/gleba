"use client"

/**
 * Dashboard Élevage - Interface à onglets (même ergonomie que le Potager)
 */

import * as React from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AppHeader } from "@/components/shell/AppHeader"
import { ModuleTabBar } from "@/components/shell/ModuleTabBar"
import { updateDashboardSearchParams } from "@/lib/dashboard-navigation"
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu"
import {
  Baby,
  Calendar,
  CalendarDays,
  Dna,
  HeartPulse,
  Leaf,
  Milk,
  PawPrint,
  Shapes,
  Wheat,
  Map as MapIcon,
  Bot,
  ClipboardCheck,
  Euro,
  MoreHorizontal,
} from "lucide-react"
import { ChatPanel } from "@/components/chat/ChatPanel"
import { CalendrierTab } from "@/components/elevage/CalendrierTab"
import { DashboardTab } from "@/components/elevage/DashboardTab"
import { DashboardCompagnie } from "@/components/elevage/DashboardCompagnie"
import { AnimauxTab } from "@/components/elevage/AnimauxTab"
import { ProductionTab } from "@/components/elevage/ProductionTab"
import { AlimentationTab } from "@/components/elevage/AlimentationTab"
import { EspecesTab } from "@/components/elevage/EspecesTab"
import { RacesTab } from "@/components/elevage/RacesTab"
import { ReproductionTab } from "@/components/elevage/ReproductionTab"
import { TourElevage } from "@/components/tours/tour-elevage"
import { PremiersPasBanner } from "@/components/premiers-pas-banner"
import { getAvailableYears } from "@/components/year-selector"
import { useElevageModes } from "@/hooks/use-elevage-modes"
import { FILIERE_LABELS, type Filiere } from "@/lib/elevage/filiere"
import { capacites } from "@/lib/elevage/filiere-ui"
import { FiliereProvider, type FiliereSelection } from "@/lib/elevage/filiere-context"

const TABS = [
  { id: "calendrier", label: "Calendrier", icon: CalendarDays, shortLabel: "Calendrier" },
  { id: "dashboard", label: "Dashboard & Soins", icon: HeartPulse, shortLabel: "Dashboard" },
  { id: "animaux", label: "Animaux & Lots", icon: PawPrint, shortLabel: "Animaux" },
  { id: "production", label: "Production", icon: Milk, shortLabel: "Production" },
  { id: "reproduction", label: "Reproduction", icon: Baby, shortLabel: "Repro." },
  { id: "alimentation", label: "Alimentation & Soins", icon: Wheat, shortLabel: "Soins" },
  { id: "especes", label: "Profils d’élevage", icon: Shapes, shortLabel: "Profils" },
  { id: "races", label: "Races", icon: Dna, shortLabel: "Races" },
] as const

type TabId = (typeof TABS)[number]["id"]

const TAB_ALIASES: Record<string, TabId> = {
  aliments: "alimentation",
  aliment: "alimentation",
  animal: "animaux",
  lots: "animaux",
  oeufs: "production",
  lait: "production",
  ventes: "production",
  espece: "especes",
  especes_animales: "especes",
  repro: "reproduction",
  sanitaire: "alimentation",
}
const VALID_TABS: string[] = TABS.map((tab) => tab.id)

// QA Camille 2026-05-15 — bonus : plage factorisée [N+1 … N-4]
const currentYearNow = new Date().getFullYear()
const availableYears = getAvailableYears()

export default function ElevageDashboard() {
  return (
    <React.Suspense fallback={<div className="min-h-screen flex items-center justify-center"><p>Chargement...</p></div>}>
      <ElevageDashboardInner />
    </React.Suspense>
  )
}

function ElevageDashboardInner() {
  const { data: session } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [selectedYear, setSelectedYear] = React.useState(currentYearNow)
  // QA cmsob8lon — l'année choisie revenait à l'année courante après F5.
  // Même motif que le dashboard maraîchage : lecture au montage (client-only),
  // et les vues dépendantes de l'année ne sont montées qu'après restauration
  // pour qu'une réponse « année par défaut » ne puisse pas écraser la bonne.
  const [yearReady, setYearReady] = React.useState(false)
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem("gleba_elevage_year")
      if (stored && /^\d{4}$/.test(stored)) {
        const y = parseInt(stored, 10)
        if (availableYears.includes(y)) setSelectedYear(y)
      }
    } catch {
      // localStorage indisponible (mode privé, quota) — on garde le défaut
    } finally {
      setYearReady(true)
    }
  }, [])
  const handleYearChange = React.useCallback((value: string) => {
    const y = parseInt(value, 10)
    setSelectedYear(y)
    try {
      localStorage.setItem("gleba_elevage_year", String(y))
    } catch {
      // ignore
    }
  }, [])
  const [showChat, setShowChat] = React.useState(false)
  const [isChatExpanded, setIsChatExpanded] = React.useState(false)
  // Modes d'élevage → sélecteur de filière en tête de module (Phase 0).
  const { filieres } = useElevageModes()
  const [selectedFiliere, setSelectedFiliere] = React.useState<FiliereSelection>("toutes")
  const showFiliereSelector = filieres.length > 1 // un mode optionnel au moins est actif
  const hideRente = selectedFiliere !== "toutes" && !capacites(selectedFiliere as Filiere).productionRente
  const dashboardCompagnie = selectedFiliere !== "toutes" && capacites(selectedFiliere as Filiere).dashboard === "compagnie"
  const visibleTabs = React.useMemo(
    () => TABS.filter((t) => !(hideRente && t.id === "production")),
    [hideRente]
  )

  // L'URL reste la source de vérité, y compris lors d'une navigation <Link>
  // entre deux onglets de cette même page.
  // Bug feedback testeur 2026-05-26 (cmpmr87qh) — alias d'URL courants :
  // ?tab=aliments tombait sur le Calendrier (onglet par défaut) au lieu
  // d'Alimentation. On mappe les alias usuels vers l'id canonique.
  const rawTab = searchParams.get("tab")
  const urlTab: TabId =
    rawTab && VALID_TABS.includes(rawTab)
      ? rawTab as TabId
      : rawTab && TAB_ALIASES[rawTab]
        ? TAB_ALIASES[rawTab]
        : "calendrier"

  // TICKET cmsofbepa — état optimiste : sur mobile, la navigation d'onglet
  // (Select Radix → pushState) peut être avalée par la chaîne tactile et
  // l'écran, 100 % dérivé de l'URL, restait alors muet sur « Calendrier ».
  // Le clic affiche immédiatement l'onglet demandé ; l'URL reste la source de
  // vérité : dès que searchParams bouge (push abouti ou navigation réelle),
  // l'état optimiste est effacé.
  const [tabOptimiste, setTabOptimiste] = React.useState<TabId | null>(null)
  React.useEffect(() => {
    setTabOptimiste(null)
  }, [searchParams])
  const activeTab: TabId = tabOptimiste ?? urlTab

  React.useEffect(() => {
    if (rawTab && !VALID_TABS.includes(rawTab) && TAB_ALIASES[rawTab]) {
      const canonical = TAB_ALIASES[rawTab]
      // Normalise l'alias via le routeur Next (et non l'History API brute :
      // un replaceState(null,…) désynchronise l'arbre interne de l'App Router
      // et casse les <Link> ultérieurs vers /elevage/animaux/[id] — bug QA #1).
      // QA caprin cms1vps0c — l'alias ?tab=lots doit ouvrir le sous-onglet
      // Lots d'« Animaux & Lots » : on propage sub=lots (lu par AnimauxTab).
      const suffix =
        rawTab === "lots"
          ? "&sub=lots"
          : rawTab === "sanitaire"
            ? "&sub=registre"
            : ""
      router.replace(`/elevage?tab=${canonical}${suffix}`, { scroll: false })
    }
  }, [rawTab, router])

  // Si l'onglet courant devient masqué (ex. Production en filière compagnie),
  // rebasculer vers le Dashboard (activeTab est dérivé de l'URL).
  React.useEffect(() => {
    if (hideRente && activeTab === "production") {
      updateDashboardSearchParams(new URLSearchParams([["tab", "dashboard"]]), "replace")
    }
  }, [hideRente, activeTab])

  // QA caprin cms1vc12t / cms1v9baa — toujours reconstruire une URL propre
  // /elevage?tab=<tab> : cliquer l'onglet DÉJÀ actif purge ainsi les params
  // résiduels (sub/action/edit) et resynchronise les sous-onglets contrôlés.
  // QA cmsnoo8mc — router.push sur la même route avec seule la query modifiée
  // est un no-op silencieux en build de production après chargement à froid
  // (même piège que le verger, cmsbu12hb) : la barre d'onglets ne naviguait
  // plus. Passage par updateDashboardSearchParams (History API intégrée).
  const handleTabChange = React.useCallback((tab: TabId) => {
    setTabOptimiste(tab)
    const params = new URLSearchParams()
    params.set("tab", tab)
    updateDashboardSearchParams(params, "push")
  }, [])

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Chargement...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50 aurora-bg-subtle">
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" aria-hidden="true" />
      {/* Assistant IA */}
      {showChat && (
        <div
          className={`fixed rounded-xl border bg-background shadow-2xl flex flex-col overflow-hidden transition-[width,height,inset] duration-200 ${
            isChatExpanded
              ? 'z-[70] inset-2 sm:inset-5 lg:inset-y-8 lg:left-1/2 lg:right-auto lg:w-[min(1100px,calc(100vw-4rem))] lg:-translate-x-1/2'
              : 'z-50 bottom-2 left-4 right-4 h-[45vh] max-w-sm mx-auto sm:mx-0 sm:left-auto sm:bottom-4 sm:right-4 sm:h-[540px] sm:w-[400px] sm:max-w-none'
          }`}
        >
          <ChatPanel
            onClose={() => {
              setShowChat(false)
              setIsChatExpanded(false)
            }}
            section="elevage"
            sectionLabel="Élevage"
            isExpanded={isChatExpanded}
            onToggleExpanded={() => setIsChatExpanded((current) => !current)}
          />
        </div>
      )}

      <AppHeader current="elevage" />
      <ModuleTabBar
        tabs={visibleTabs}
        activeTab={activeTab}
        onTabChange={(tab) => handleTabChange(tab as TabId)}
        accent="amber"
        actions={
          <>
              {/* Raccourcis regroupés dans un menu « Plus » pour libérer la
                  rangée d'onglets (Espèces/Races passaient sous les boutons). */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="sm" className="text-slate-700">
                    <MoreHorizontal className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Plus</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem asChild>
                    <Link href="/elevage/tournee"><ClipboardCheck className="h-4 w-4 mr-2 text-emerald-600" />Tournée</Link>
                  </DropdownMenuItem>
                  {/* Pâturage (UGB/fourrage) et Économie de rente sans objet pour
                      un atelier compagnie/équin/NAC — masqués (2026-07-25). */}
                  {!hideRente && (
                    <DropdownMenuItem asChild>
                      <Link href="/elevage/paturage"><Leaf className="h-4 w-4 mr-2 text-green-600" />Pâturage</Link>
                    </DropdownMenuItem>
                  )}
                  {!hideRente && (
                    <DropdownMenuItem asChild>
                      <Link href="/elevage/economie"><Euro className="h-4 w-4 mr-2 text-blue-600" />Économie</Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem asChild>
                    <Link href="/jardin/carte?usage=elevage"><MapIcon className="h-4 w-4 mr-2 text-amber-600" />Carte</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/parcelles"><MapIcon className="h-4 w-4 mr-2 text-purple-600" />Parcelles</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowChat((v) => !v)}>
                    <Bot className="h-4 w-4 mr-2 text-amber-600" />Assistant IA
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <Select
                value={selectedYear.toString()}
                onValueChange={handleYearChange}
              >
                <SelectTrigger className="w-[100px] h-8">
                  <Calendar className="h-3.5 w-3.5 mr-1 text-muted-foreground" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableYears.map((year) => (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
          </>
        }
      />

      {/* Barre de contexte « atelier / filière » (Phase 0 modes d'élevage).
          Rangée dédiée sous les onglets — n'apparaît QUE si un mode optionnel
          est actif ; masquée pour un éleveur 100 % rente (UX inchangée). Scope
          tout le module en dessous via FiliereProvider. */}
      {showFiliereSelector && (
        <div className="border-b bg-white/70 backdrop-blur-sm">
          <div className="container mx-auto flex max-w-[1600px] items-center gap-1.5 overflow-x-auto px-4 py-1.5">
            <span className="mr-1 inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground">
              <PawPrint className="h-3.5 w-3.5" />
              Atelier
            </span>
            {(["toutes", ...filieres] as FiliereSelection[]).map((f) => {
              const active = selectedFiliere === f
              return (
                <button
                  key={f}
                  type="button"
                  onClick={() => setSelectedFiliere(f)}
                  aria-pressed={active}
                  className={`shrink-0 rounded-full border px-2.5 py-1 text-xs transition-colors ${
                    active
                      ? "border-amber-300 bg-amber-100 font-medium text-amber-800"
                      : "border-transparent text-slate-500 hover:bg-slate-100"
                  }`}
                >
                  {f === "toutes" ? "Tous" : FILIERE_LABELS[f]}
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* POSTREVIEW Sprint 6 — Tour Shepherd.js Élevage */}
      <TourElevage />
      {/* Contenu de l'onglet actif */}
      <main className="container mx-auto px-4 py-6 max-w-[1600px] space-y-4">
        <FiliereProvider value={selectedFiliere}>
        {activeTab === "calendrier" && <PremiersPasBanner module="elevage" />}
        {activeTab === "calendrier" && <CalendrierTab />}
        {/* QA cmsob8lon — les onglets dépendants de l'année attendent la
            restauration de la préférence (yearReady), cf. MaraichageHome. */}
        {activeTab === "dashboard" && yearReady && (dashboardCompagnie
          ? <DashboardCompagnie year={selectedYear} />
          : <DashboardTab year={selectedYear} />)}
        {activeTab === "animaux" && <AnimauxTab />}
        {/* DEV2 Ticket #3 — passer l'année pour que Dashboard et Production
            voient la même fenêtre temporelle (1269 vs Aucune = filtres
            désynchronisés) */}
        {activeTab === "production" && yearReady && <ProductionTab year={selectedYear} />}
        {/* QA caprin cms1vc12t — même fenêtre temporelle que Dashboard/Production */}
        {activeTab === "reproduction" && yearReady && <ReproductionTab year={selectedYear} />}
        {activeTab === "alimentation" && <AlimentationTab />}
        {activeTab === "especes" && <EspecesTab />}
        {activeTab === "races" && <RacesTab />}
        </FiliereProvider>
      </main>

      {/* Footer */}
      <footer className="border-t mt-8 py-4 text-center text-sm text-slate-500">
        <p>Gleba v1.1.0</p>
      </footer>
    </div>
  )
}
