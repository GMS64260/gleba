"use client"

import * as React from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AppHeader } from "@/components/shell/AppHeader"
import { ModuleTabBar } from "@/components/shell/ModuleTabBar"
import { WelcomeDialog } from "@/components/onboarding/WelcomeDialog"
import {
  Sprout,
  LayoutGrid,
  BarChart3,
  Map as MapIcon,
  MapPin,
  TreeDeciduous,
  Calendar,
  Leaf,
  Bird,
  Wallet,
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
  const router = useRouter()
  const [showWelcome, setShowWelcome] = React.useState(false)
  // BUG #9 — le choix d'année du dashboard n'était pas persisté (revenait à
  // l'année courante après F5). On le lit/écrit dans localStorage, sur le
  // même pattern que la compta (`gleba_compta_year`).
  const [selectedYear, setSelectedYear] = React.useState(currentYearNow)
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem("gleba_dashboard_year")
      if (stored) {
        const y = parseInt(stored, 10)
        if (!Number.isNaN(y) && availableYears.includes(y)) setSelectedYear(y)
      }
    } catch {
      // localStorage indisponible (mode privé, quota) — on garde le défaut
    }
  }, [])
  const handleYearChange = React.useCallback((value: string) => {
    const y = parseInt(value, 10)
    setSelectedYear(y)
    try {
      localStorage.setItem("gleba_dashboard_year", String(y))
    } catch {
      // ignore
    }
  }, [])
  const [showAssistant, setShowAssistant] = React.useState(false)
  const [showChat, setShowChat] = React.useState(false)
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

  const setActiveTab = React.useCallback(
    (tab: TabId) => {
      const params = new URLSearchParams(searchParams.toString())
      if (tab === "calendrier") {
        params.delete("tab")
      } else {
        params.set("tab", tab)
      }
      const query = params.toString()
      router.push(query ? `/?${query}` : "/", { scroll: false })
    },
    [searchParams, router]
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
      <AssistantDialog open={showAssistant} onOpenChange={setShowAssistant} />

      {/* Assistant IA */}
      {showChat && (
        <div className="fixed bottom-2 left-4 right-4 z-50 h-[45vh] max-w-sm mx-auto rounded-xl border bg-background shadow-2xl flex flex-col overflow-hidden sm:mx-0 sm:left-auto sm:bottom-4 sm:right-4 sm:h-[540px] sm:w-[400px] sm:max-w-none sm:rounded-lg sm:border sm:shadow-xl">
          <ChatPanel onClose={() => setShowChat(false)} section="potager" sectionLabel="Maraîchage" />
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
              onClick={() => setShowAssistant(true)}
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
        {activeTab === "calendrier" && <CalendrierTab year={selectedYear} />}
        {activeTab === "cultures" && <CulturesTab year={selectedYear} />}
        {activeTab === "terrain" && <TerrainTab />}
        {activeTab === "planification" && <PlanificationTab year={selectedYear} />}
        {activeTab === "referentiel" && <ReferentielTab />}
      </main>

      {/* Footer */}
      <footer className="border-t mt-8 py-4 text-center text-sm text-slate-500">
        <p>Gleba v1.0.0</p>
      </footer>
    </div>
  )
}
