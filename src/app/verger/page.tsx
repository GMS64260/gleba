"use client"

import * as React from "react"
import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { updateDashboardSearchParams } from "@/lib/dashboard-navigation"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AppHeader } from "@/components/shell/AppHeader"
import { ModuleTabBar } from "@/components/shell/ModuleTabBar"
import {
  Map as MapIcon,
  TreeDeciduous,
  Calendar,
  Leaf,
  Apple,
  Wrench,
  HeartPulse,
  Bot,
  Sprout,
  Wand2,
} from "lucide-react"
import { ChatPanel } from "@/components/chat/ChatPanel"
import { CalendrierTab } from "@/components/verger/CalendrierTab"
import { ArbresTab } from "@/components/verger/ArbresTab"
import { ProductionsTab } from "@/components/verger/ProductionsTab"
import { OperationsTab } from "@/components/verger/OperationsTab"
import { ReferentielTab } from "@/components/verger/ReferentielTab"
import { SanteTab } from "@/components/verger/SanteTab"
import { PlantationsTab } from "@/components/verger/PlantationsTab"
import { AssistantPlantationDialog } from "@/components/verger/AssistantPlantationDialog"
import { TourVerger } from "@/components/tours/tour-verger"
import { PremiersPasBanner } from "@/components/premiers-pas-banner"
import { getAvailableYears } from "@/components/year-selector"

const TABS = [
  { id: "calendrier", label: "Calendrier", icon: Calendar, shortLabel: "Calendrier" },
  { id: "plantations", label: "Plantations", icon: Sprout, shortLabel: "Plant." },
  { id: "arbres", label: "Arbres", icon: TreeDeciduous, shortLabel: "Arbres" },
  { id: "productions", label: "Productions", icon: Apple, shortLabel: "Prod." },
  { id: "operations", label: "Opérations", icon: Wrench, shortLabel: "Oper." },
  { id: "sante", label: "Santé & Phyto", icon: HeartPulse, shortLabel: "Sante" },
  { id: "referentiel", label: "Référentiel", icon: Leaf, shortLabel: "Ref." },
] as const

type TabId = (typeof TABS)[number]["id"]

// QA Camille 2026-05-15 — bonus : plage factorisée [N+1 … N-4]
const currentYearNow = new Date().getFullYear()
const availableYears = getAvailableYears()

export default function VergerPage() {
  return (
    <React.Suspense fallback={null}>
      <VergerPageInner />
    </React.Suspense>
  )
}

function VergerPageInner() {
  const searchParams = useSearchParams()
  const [selectedYear, setSelectedYear] = React.useState(currentYearNow)
  // QA cmsogh2sw — l'année du verger revenait à l'année courante à chaque
  // reload alors que compta (gleba_compta_year) et élevage (gleba_elevage_year)
  // la persistent. Même pattern exact que la compta : lecture au montage
  // (client-only), puis persistance des seuls changements réels.
  // QA cmsoamukd — state et non ref : le fetch du montage attend l'hydratation
  // (sinon la salve « année par défaut » peut écraser celle de l'année choisie).
  const [yearHydrated, setYearHydrated] = React.useState(false)
  React.useEffect(() => {
    const stored = window.localStorage.getItem("gleba_verger_year")
    if (stored && /^\d{4}$/.test(stored)) {
      const y = parseInt(stored, 10)
      if (y !== selectedYear) setSelectedYear(y)
    }
    setYearHydrated(true)
    // Montage uniquement : lecture initiale de la préférence.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  React.useEffect(() => {
    // Ne persiste qu'après la lecture initiale, sinon le fallback écrase la préférence.
    if (yearHydrated) window.localStorage.setItem("gleba_verger_year", String(selectedYear))
  }, [yearHydrated, selectedYear])
  const [showChat, setShowChat] = React.useState(false)
  const [isChatExpanded, setIsChatExpanded] = React.useState(false)
  const [showAssistant, setShowAssistant] = React.useState(false)

  // Palier 2 (unification onglets) : l'URL est la source de vérité, comme
  // sur MaraichageHome — chaque onglet devient partageable en deep-link.
  const tabParam = searchParams.get("tab")
  const activeTab: TabId = TABS.some((t) => t.id === tabParam) ? (tabParam as TabId) : "calendrier"

  const setActiveTab = React.useCallback(
    (tab: TabId) => {
      const params = new URLSearchParams(searchParams.toString())
      if (tab === "calendrier") {
        params.delete("tab")
      } else {
        params.set("tab", tab)
      }
      // QA cmsbu12hb — en build de production, `router.push("/verger")` avec
      // query vide après un chargement à froid sur /verger?tab=… est un no-op
      // (navigation dédupliquée) : l'onglet Calendrier devenait inatteignable.
      // Même contournement History natif que MaraichageHome (f87ba97/73afa13).
      updateDashboardSearchParams(params, "push")
    },
    [searchParams]
  )

  // POSTREVIEW — ?action=plantation ouvre le dialog AssistantPlantation
  // (utilisé par le bandeau "Premiers pas" pour ce step)
  React.useEffect(() => {
    if (searchParams.get("action") === "plantation") {
      setShowAssistant(true)
    }
  }, [searchParams])

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
            section="verger"
            sectionLabel="Verger"
            isExpanded={isChatExpanded}
            onToggleExpanded={() => setIsChatExpanded((current) => !current)}
          />
        </div>
      )}

      {/* Shell partagé (palier 2) : header global + barre d'onglets communs */}
      <AppHeader current="verger" showLune />
      <ModuleTabBar
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={(tab) => setActiveTab(tab as TabId)}
        accent="lime"
        actions={
          <>
            <Button
              size="sm"
              onClick={() => setShowAssistant(true)}
              className="bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white shadow-md"
              title="Assistant Plantation"
            >
              <Wand2 className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">Plantation</span>
            </Button>
            <Link href="/jardin?usage=verger">
              <Button variant="outline" size="sm" className="text-teal-700 border-teal-300 hover:bg-teal-50">
                <MapIcon className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Plan</span>
              </Button>
            </Link>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowChat((v) => !v)}
              className={showChat ? "text-white bg-lime-600 hover:bg-lime-700 border-lime-600" : "text-lime-700 border-lime-300 hover:bg-lime-50"}
              title="Assistant IA"
            >
              <Bot className="h-4 w-4 mr-1" />
              <span className="hidden sm:inline">IA</span>
            </Button>
            <Link href="/parcelles">
              <Button variant="outline" size="sm" className="text-purple-700 border-purple-300 hover:bg-purple-50">
                <MapIcon className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Parcelles</span>
              </Button>
            </Link>
            <Select
              value={selectedYear.toString()}
              onValueChange={(value) => setSelectedYear(parseInt(value))}
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

      {/* POSTREVIEW Sprint 6 — Tour Shepherd.js Verger */}
      <TourVerger />
      {/* Contenu de l'onglet actif */}
      <main className="container mx-auto px-4 py-6 max-w-[1600px] space-y-4">
        {activeTab === "calendrier" && <PremiersPasBanner module="verger" />}
        {/* QA cmsogh2sw — garde d'hydratation : ne pas monter le calendrier
            avant la lecture de gleba_verger_year, sinon il fetche l'année par
            défaut puis refetche (fetch fantôme déjà mordu sur 4 écrans). */}
        {activeTab === "calendrier" && yearHydrated && <CalendrierTab year={selectedYear} />}
        {activeTab === "plantations" && <PlantationsTab />}
        {activeTab === "arbres" && <ArbresTab />}
        {activeTab === "productions" && <ProductionsTab />}
        {activeTab === "operations" && <OperationsTab />}
        {activeTab === "sante" && <SanteTab />}
        {activeTab === "referentiel" && <ReferentielTab />}
      </main>

      {/* Assistant Plantation (accessible depuis le header) */}
      <AssistantPlantationDialog
        open={showAssistant}
        onOpenChange={setShowAssistant}
        onSuccess={() => setActiveTab("plantations")}
      />

      {/* Footer */}
      <footer className="border-t mt-8 py-4 text-center text-sm text-slate-500">
        <p>Gleba v1.1.0</p>
      </footer>
    </div>
  )
}
