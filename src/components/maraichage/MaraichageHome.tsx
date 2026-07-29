"use client"

import * as React from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AppHeader } from "@/components/shell/AppHeader"
import { ModuleTabBar } from "@/components/shell/ModuleTabBar"
import { updateDashboardSearchParams } from "@/lib/dashboard-navigation"
import {
  DASHBOARD_YEAR_STORAGE_KEY,
  resolveDashboardYear,
} from "@/lib/dashboard-year"
import { WelcomeDialog } from "@/components/onboarding/WelcomeDialog"
import {
  Sprout,
  LayoutGrid,
  BarChart3,
  Map as MapIcon,
  MapPin,
  Calendar,
  Leaf,
  CloudRain,
  X,
} from "lucide-react"
import { AssistantDialog } from "@/components/assistant"
import { Wand2, Bot } from "lucide-react"
import { ChatPanel } from "@/components/chat/ChatPanel"
import { CalendrierTab } from "@/components/potager/CalendrierTab"
import { PremiersPasBanner } from "@/components/premiers-pas-banner"
import { TourMaraichage } from "@/components/tours/tour-maraichage"
import { CulturesTab } from "@/components/potager/CulturesTab"
import { TerrainTab } from "@/components/potager/TerrainTab"
import { PlanificationTab } from "@/components/potager/PlanificationTab"
import { ReferentielTab } from "@/components/potager/ReferentielTab"

const TABS = [
  { id: "calendrier", label: "Calendrier", icon: Calendar, shortLabel: "Calendrier" },
  { id: "cultures", label: "Cultures", icon: Sprout, shortLabel: "Cultures" },
  { id: "terrain", label: "Terrain", icon: LayoutGrid, shortLabel: "Terrain" },
  { id: "planification", label: "Planification", icon: BarChart3, shortLabel: "Planif." },
  { id: "referentiel", label: "Référentiel", icon: Leaf, shortLabel: "Ref." },
] as const

type TabId = (typeof TABS)[number]["id"]

// QA Camille 2026-05-15 — bonus : plage factorisée [N+1 … N-4]
import { getAvailableYears } from "@/components/year-selector"
const currentYearNow = new Date().getFullYear()
const availableYears = getAvailableYears()

export function MaraichageHome() {
  return (
    <React.Suspense fallback={null}>
      <HomeContent />
    </React.Suspense>
  )
}

function HomeContent() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const [showWelcome, setShowWelcome] = React.useState(false)
  // BUG #9 — le choix d'année du dashboard n'était pas persisté (revenait à
  // l'année courante après F5). On le lit/écrit dans localStorage, sur le
  // même pattern que la compta (`gleba_compta_year`).
  const [selectedYear, setSelectedYear] = React.useState(currentYearNow)
  const [isYearReady, setIsYearReady] = React.useState(false)
  React.useEffect(() => {
    try {
      setSelectedYear(resolveDashboardYear({
        storedValue: localStorage.getItem(DASHBOARD_YEAR_STORAGE_KEY),
        fallbackYear: currentYearNow,
        allowedYears: availableYears,
      }))
    } catch {
      // localStorage indisponible (mode privé, quota) — on garde le défaut
    } finally {
      // Les vues dépendantes de l'année ne sont montées qu'après restauration.
      // Cela empêche une requête de l'année courante de finir plus tard et
      // d'écraser les données de la saison mémorisée.
      setIsYearReady(true)
    }
  }, [])
  const handleYearChange = React.useCallback((value: string) => {
    const y = parseInt(value, 10)
    setSelectedYear(y)
    try {
      localStorage.setItem(DASHBOARD_YEAR_STORAGE_KEY, String(y))
    } catch {
      // ignore
    }
  }, [])
  const [showAssistant, setShowAssistant] = React.useState(false)
  const [showChat, setShowChat] = React.useState(false)
  const [isChatExpanded, setIsChatExpanded] = React.useState(false)
  const [showPluieBanner, setShowPluieBanner] = React.useState(false)

  React.useEffect(() => {
    if (!localStorage.getItem("gleba-banner-pluie-v1")) {
      setShowPluieBanner(true)
    }
  }, [])

  const dismissPluieBanner = React.useCallback(() => {
    localStorage.setItem("gleba-banner-pluie-v1", "1")
    setShowPluieBanner(false)
  }, [])
  // Lire l'onglet actif depuis l'URL (?tab=planification)
  const tabFromUrl = searchParams.get("tab") as TabId | null
  const validTabs = TABS.map((t) => t.id)
  const activeTab: TabId = tabFromUrl && validTabs.includes(tabFromUrl) ? tabFromUrl : "calendrier"

  // Compatibilité du deep-link historique `?tab=semer` : il désigne une
  // action (l'assistant culture), pas un onglet. Un rechargement doit donc
  // rouvrir l'assistant au lieu de retomber silencieusement sur Calendrier.
  React.useEffect(() => {
    if (searchParams.get("tab") === "semer") setShowAssistant(true)
  }, [searchParams])

  const setActiveTab = React.useCallback(
    (tab: TabId) => {
      const params = new URLSearchParams(searchParams.toString())
      if (tab === "calendrier") {
        params.delete("tab")
      } else {
        params.set("tab", tab)
      }
      updateDashboardSearchParams(params, "push")
    },
    [searchParams]
  )

  const handleSemer = React.useCallback(() => {
    const params = new URLSearchParams(searchParams.toString())
    params.set("tab", "semer")
    updateDashboardSearchParams(params, "push")
    setShowAssistant(true)
  }, [searchParams])

  const handleAssistantOpenChange = React.useCallback(
    (open: boolean) => {
      setShowAssistant(open)
      if (!open && searchParams.get("tab") === "semer") {
        const params = new URLSearchParams(searchParams.toString())
        params.delete("tab")
        updateDashboardSearchParams(params, "replace")
      }
    },
    [searchParams]
  )

  // Vérifier si l'utilisateur est nouveau
  React.useEffect(() => {
    async function checkNewUser() {
      if (localStorage.getItem("gleba-onboarding-complete")) return
      try {
        const response = await fetch("/api/import-test-data")
        if (response.ok) {
          const result = await response.json()
          if (result.canImport) setShowWelcome(true)
        }
      } catch (error) {
        console.error("Erreur verification nouvel utilisateur:", error)
      }
    }
    if (session?.user) checkNewUser()
  }, [session])

  const handleOnboardingComplete = React.useCallback(() => {
    localStorage.setItem("gleba-onboarding-complete", "true")
    window.location.reload()
  }, [])

  return (
    <div className="min-h-screen bg-gris-nuage aurora-bg-subtle">
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" aria-hidden="true" />
      {/* Dialog de bienvenue */}
      <WelcomeDialog
        open={showWelcome}
        onOpenChange={setShowWelcome}
        onComplete={handleOnboardingComplete}
      />

      {/* Assistant culture */}
      <AssistantDialog open={showAssistant} onOpenChange={handleAssistantOpenChange} />

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
            section="potager"
            sectionLabel="Maraîchage"
            isExpanded={isChatExpanded}
            onToggleExpanded={() => setIsChatExpanded((current) => !current)}
          />
        </div>
      )}



      {/* Shell partagé (palier 2) : header global + barre d'onglets communs */}
      <AppHeader current="maraichage" showLune />
      <ModuleTabBar
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as TabId)}
        accent="emerald"
        actions={
          <>
            <Link href="/jardin?usage=culture">
              <Button variant="outline" size="sm" className="text-teal-700 border-teal-300 hover:bg-teal-50">
                <MapIcon className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Plan</span>
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSemer}
              className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
              title="Assistant culture"
            >
              <Wand2 className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Semer</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowChat((v) => !v)}
              className={showChat ? "text-white bg-emerald-600 hover:bg-emerald-700 border-emerald-600" : "text-emerald-700 border-emerald-300 hover:bg-emerald-50"}
              title="Assistant IA"
            >
              <Bot className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">IA</span>
            </Button>
            <Link href="/parcelles">
              <Button variant="outline" size="sm" className="text-purple-700 border-purple-300 hover:bg-purple-50">
                <MapPin className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Parcelles</span>
              </Button>
            </Link>
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

      {/* Bannière nouveauté - pluviométrie */}
      {showPluieBanner && session?.user && (
        <div className="border-b bg-emerald-50/80 backdrop-blur-sm">
          <div className="container mx-auto px-4 py-2 max-w-[1600px] flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-emerald-700">
              <CloudRain className="h-4 w-4 flex-shrink-0" />
              <span>
                <strong>Nouveau —</strong> Pluviométrie par planche disponible : cliquez sur une planche dans le{" "}
                <button
                  onClick={() => { dismissPluieBanner(); window.location.href = "/jardin" }}
                  className="underline underline-offset-2 hover:text-emerald-900 font-medium"
                >
                  Plan du jardin
                </button>{" "}
                pour voir les précipitations. Les planches sous serre sont automatiquement exclues.
              </span>
            </div>
            <button
              onClick={dismissPluieBanner}
              className="flex-shrink-0 text-emerald-400 hover:text-emerald-700 transition-colors"
              aria-label="Fermer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Contenu de l'onglet actif */}
      <main className="container mx-auto px-4 py-6 max-w-[1600px] space-y-6">
        {/* POSTREVIEW Sprint 6 — Tour Shepherd.js Maraîchage */}
        {activeTab === "calendrier" && <TourMaraichage />}
        {/* PROMPT 22 + POSTREVIEW Sprint 6 — Bandeau "Premiers pas" Maraîchage */}
        {activeTab === "calendrier" && <PremiersPasBanner module="maraichage" />}
        {!isYearReady && ["calendrier", "cultures", "planification", "referentiel"].includes(activeTab) && (
          <div className="h-40 animate-pulse rounded-xl border bg-white/70" aria-label="Chargement de la saison" />
        )}
        {isYearReady && activeTab === "calendrier" && (
          <CalendrierTab key={`calendrier-${selectedYear}`} year={selectedYear} />
        )}
        {isYearReady && activeTab === "cultures" && (
          <CulturesTab key={`cultures-${selectedYear}`} year={selectedYear} />
        )}
        {activeTab === "terrain" && <TerrainTab />}
        {isYearReady && activeTab === "planification" && (
          <PlanificationTab key={`planification-${selectedYear}`} year={selectedYear} />
        )}
        {isYearReady && activeTab === "referentiel" && (
          <ReferentielTab key={`referentiel-${selectedYear}`} year={selectedYear} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t mt-8 py-4 text-center text-sm text-slate-500">
        <p>Gleba v1.1.0</p>
      </footer>
    </div>
  )
}
