"use client"

/**
 * Dashboard Élevage - Interface à onglets (même ergonomie que le Potager)
 */

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useSession } from "next-auth/react"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { UserMenu } from "@/components/auth/UserMenu"
import { ModulesNav } from "@/components/auth/ModulesNav"
import { BoutiqueHeaderButton } from "@/components/auth/BoutiqueHeaderButton"
import {
  Bird,
  Sprout,
  TreeDeciduous,
  Wallet,
  Settings,
  Calendar,
  BarChart3,
  Egg,
  Package,
  Leaf,
  Map as MapIcon,
  Bot,
} from "lucide-react"
import { ChatPanel } from "@/components/chat/ChatPanel"
import { HeaderMeteoWidget } from "@/components/meteo"
import { CalendrierTab } from "@/components/elevage/CalendrierTab"
import { DashboardTab } from "@/components/elevage/DashboardTab"
import { AnimauxTab } from "@/components/elevage/AnimauxTab"
import { ProductionTab } from "@/components/elevage/ProductionTab"
import { AlimentationTab } from "@/components/elevage/AlimentationTab"
import { EspecesTab } from "@/components/elevage/EspecesTab"
import { ReproductionTab } from "@/components/elevage/ReproductionTab"
import { TourElevage } from "@/components/tours/tour-elevage"
import { PremiersPasBanner } from "@/components/premiers-pas-banner"

const TABS = [
  { id: "calendrier", label: "Calendrier", icon: Calendar, shortLabel: "Calendrier" },
  { id: "dashboard", label: "Dashboard & Soins", icon: BarChart3, shortLabel: "Dashboard" },
  { id: "animaux", label: "Animaux & Lots", icon: Bird, shortLabel: "Animaux" },
  { id: "production", label: "Production", icon: Egg, shortLabel: "Production" },
  { id: "reproduction", label: "Reproduction", icon: Bird, shortLabel: "Repro." },
  { id: "alimentation", label: "Alimentation", icon: Package, shortLabel: "Aliment." },
  { id: "especes", label: "Espèces", icon: Leaf, shortLabel: "Espèces" },
] as const

type TabId = (typeof TABS)[number]["id"]

const currentYearNow = new Date().getFullYear()
const availableYears = Array.from({ length: 6 }, (_, i) => currentYearNow - 5 + i).reverse()

export default function ElevageDashboard() {
  const { data: session } = useSession()
  const [selectedYear, setSelectedYear] = React.useState(currentYearNow)
  const [showChat, setShowChat] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<TabId>("calendrier")

  // Lire l'onglet depuis l'URL après le montage côté client
  React.useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const tab = params.get("tab")
    const valid: string[] = TABS.map(t => t.id)
    if (tab && valid.includes(tab)) {
      setActiveTab(tab as TabId)
    }
  }, [])

  const handleTabChange = React.useCallback((tab: TabId) => {
    setActiveTab(tab)
    window.history.replaceState(null, "", `/elevage?tab=${tab}`)
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
        <div className="fixed bottom-2 left-4 right-4 z-50 h-[45vh] max-w-sm mx-auto rounded-xl border bg-background shadow-2xl flex flex-col overflow-hidden sm:mx-0 sm:left-auto sm:bottom-4 sm:right-4 sm:h-[540px] sm:w-[400px] sm:max-w-none sm:rounded-lg sm:border sm:shadow-xl">
          <ChatPanel onClose={() => setShowChat(false)} section="elevage" sectionLabel="Élevage" />
        </div>
      )}

      {/* Header global */}
      <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-2.5 flex items-center justify-between gap-2 max-w-[1600px]">
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center hover:opacity-90 transition-opacity">
              <Image
                src="/gleba-logo.png"
                alt="Gleba"
                width={120}
                height={80}
                className="h-10 w-auto rounded-lg"
                priority
              />
            </Link>
            {session?.user && <HeaderMeteoWidget />}
          </div>
          <div className="flex items-center gap-2">
            {/* Sections globales */}
            <ModulesNav current="elevage" />
            {session?.user && <BoutiqueHeaderButton />}
            <Link href="/parametres">
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
            {session?.user && <UserMenu user={session.user} />}
          </div>
        </div>
      </header>

      {/* Navigation par onglets + selecteur d'annee */}
      <nav className="border-b border-t-2 border-t-amber-500 bg-white/80 backdrop-blur-sm sticky top-[61px] z-40">
        <div className="container mx-auto px-4 max-w-[1600px]">
          <div className="flex items-center justify-between gap-2 flex-wrap lg:flex-nowrap">
            {/* DEV2 #7 — Tabs scrollables horizontalement sous lg */}
            <div className="flex items-center -mb-px overflow-x-auto scrollbar-thin flex-shrink min-w-0 max-w-full">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`flex items-center gap-1.5 px-3 lg:px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      isActive
                        ? "border-amber-600 text-amber-700"
                        : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                    }`}
                    title={tab.label}
                  >
                    <tab.icon className={`h-4 w-4 ${isActive ? "text-amber-600" : ""}`} />
                    <span className="hidden lg:inline">{tab.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Carte + Annee */}
            <div className="flex items-center gap-2 py-2">
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
            </div>
          </div>
        </div>
      </nav>

      {/* POSTREVIEW Sprint 6 — Tour Shepherd.js Élevage */}
      <TourElevage />
      {/* Contenu de l'onglet actif */}
      <main className="container mx-auto px-4 py-6 max-w-[1600px] space-y-4">
        <PremiersPasBanner module="elevage" />
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
      </main>

      {/* Footer */}
      <footer className="border-t mt-8 py-4 text-center text-sm text-slate-500">
        <p>Gleba v1.0.0</p>
      </footer>
    </div>
  )
}
