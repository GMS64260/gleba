"use client"

/**
 * Dashboard Élevage - Interface à onglets (même ergonomie que le Potager)
 */

import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { AppHeader } from "@/components/shell/AppHeader"
import { ModuleTabBar } from "@/components/shell/ModuleTabBar"
import {
  Bird,
  Calendar,
  BarChart3,
  Egg,
  Package,
  Leaf,
  Map as MapIcon,
  Bot,
  ClipboardCheck,
  Euro,
} from "lucide-react"
import { ChatPanel } from "@/components/chat/ChatPanel"
import { CalendrierTab } from "@/components/elevage/CalendrierTab"
import { DashboardTab } from "@/components/elevage/DashboardTab"
import { AnimauxTab } from "@/components/elevage/AnimauxTab"
import { ProductionTab } from "@/components/elevage/ProductionTab"
import { AlimentationTab } from "@/components/elevage/AlimentationTab"
import { EspecesTab } from "@/components/elevage/EspecesTab"
import { RacesTab } from "@/components/elevage/RacesTab"
import { ReproductionTab } from "@/components/elevage/ReproductionTab"
import { TourElevage } from "@/components/tours/tour-elevage"
import { PremiersPasBanner } from "@/components/premiers-pas-banner"
import { getAvailableYears } from "@/components/year-selector"

const TABS = [
  { id: "calendrier", label: "Calendrier", icon: Calendar, shortLabel: "Calendrier" },
  { id: "dashboard", label: "Dashboard & Soins", icon: BarChart3, shortLabel: "Dashboard" },
  { id: "animaux", label: "Animaux & Lots", icon: Bird, shortLabel: "Animaux" },
  { id: "production", label: "Production", icon: Egg, shortLabel: "Production" },
  { id: "reproduction", label: "Reproduction", icon: Bird, shortLabel: "Repro." },
  { id: "alimentation", label: "Alimentation", icon: Package, shortLabel: "Aliment." },
  { id: "especes", label: "Espèces", icon: Leaf, shortLabel: "Espèces" },
  { id: "races", label: "Races", icon: Bird, shortLabel: "Races" },
] as const

type TabId = (typeof TABS)[number]["id"]

// QA Camille 2026-05-15 — bonus : plage factorisée [N+1 … N-4]
const currentYearNow = new Date().getFullYear()
const availableYears = getAvailableYears()

export default function ElevageDashboard() {
  const { data: session } = useSession()
  const router = useRouter()
  const [selectedYear, setSelectedYear] = React.useState(currentYearNow)
  const [showChat, setShowChat] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<TabId>("calendrier")

  // Lire l'onglet depuis l'URL après le montage côté client.
  // Bug feedback testeur 2026-05-26 (cmpmr87qh) — alias d'URL courants :
  // ?tab=aliments tombait sur le Calendrier (onglet par défaut) au lieu
  // d'Alimentation. On mappe les alias usuels vers l'id canonique.
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const raw = params.get("tab")
    const ALIASES: Record<string, TabId> = {
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
    }
    const valid: string[] = TABS.map(t => t.id)
    if (raw && valid.includes(raw)) {
      setActiveTab(raw as TabId)
    } else if (raw && ALIASES[raw]) {
      const canonical = ALIASES[raw]
      setActiveTab(canonical)
      // Normalise l'alias via le routeur Next (et non l'History API brute :
      // un replaceState(null,…) désynchronise l'arbre interne de l'App Router
      // et casse les <Link> ultérieurs vers /elevage/animaux/[id] — bug QA #1).
      router.replace(`/elevage?tab=${canonical}`, { scroll: false })
    }
  }, [router])

  const handleTabChange = React.useCallback((tab: TabId) => {
    setActiveTab(tab)
    router.replace(`/elevage?tab=${tab}`, { scroll: false })
  }, [router])

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
        <div className="fixed bottom-2 left-4 right-4 z-50 h-[45vh] max-w-sm mx-auto rounded-xl border bg-background shadow-2xl flex flex-col overflow-hidden sm:mx-0 sm:left-auto sm:bottom-4 sm:right-4 sm:h-[540px] sm:w-[400px] sm:max-w-none sm:rounded-lg sm:border sm:shadow-xl">
          <ChatPanel onClose={() => setShowChat(false)} section="elevage" sectionLabel="Élevage" />
        </div>
      )}

      <AppHeader current="elevage" />
      <ModuleTabBar
        tabs={TABS}
        activeTab={activeTab}
        onTabChange={(tab) => handleTabChange(tab as TabId)}
        accent="amber"
        actions={
          <>
              <Link href="/elevage/tournee">
                <Button variant="outline" size="sm" className="text-emerald-700 border-emerald-300 hover:bg-emerald-50">
                  <ClipboardCheck className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Tournée</span>
                </Button>
              </Link>
              <Link href="/elevage/paturage">
                <Button variant="outline" size="sm" className="text-green-700 border-green-300 hover:bg-green-50">
                  <Leaf className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Pâturage</span>
                </Button>
              </Link>
              <Link href="/elevage/economie">
                <Button variant="outline" size="sm" className="text-blue-700 border-blue-300 hover:bg-blue-50">
                  <Euro className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Économie</span>
                </Button>
              </Link>
              <Link href="/jardin/carte?usage=elevage">
                <Button variant="outline" size="sm" className="text-amber-700 border-amber-300 hover:bg-amber-50">
                  <MapIcon className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Carte</span>
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowChat((v) => !v)}
                className={showChat ? "text-white bg-amber-600 hover:bg-amber-700 border-amber-600" : "text-amber-700 border-amber-300 hover:bg-amber-50"}
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

      {/* POSTREVIEW Sprint 6 — Tour Shepherd.js Élevage */}
      <TourElevage />
      {/* Contenu de l'onglet actif */}
      <main className="container mx-auto px-4 py-6 max-w-[1600px] space-y-4">
        {activeTab === "calendrier" && <PremiersPasBanner module="elevage" />}
        {activeTab === "calendrier" && <CalendrierTab />}
        {activeTab === "dashboard" && <DashboardTab year={selectedYear} />}
        {activeTab === "animaux" && <AnimauxTab />}
        {/* DEV2 Ticket #3 — passer l'année pour que Dashboard et Production
            voient la même fenêtre temporelle (1269 vs Aucune = filtres
            désynchronisés) */}
        {activeTab === "production" && <ProductionTab year={selectedYear} />}
        {activeTab === "reproduction" && <ReproductionTab />}
        {activeTab === "alimentation" && <AlimentationTab />}
        {activeTab === "especes" && <EspecesTab />}
        {activeTab === "races" && <RacesTab />}
      </main>

      {/* Footer */}
      <footer className="border-t mt-8 py-4 text-center text-sm text-slate-500">
        <p>Gleba v1.1.0</p>
      </footer>
    </div>
  )
}
