"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useSession } from "next-auth/react"
import { useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { UserMenu } from "@/components/auth/UserMenu"
import { ModulesNav } from "@/components/auth/ModulesNav"
import { BoutiqueHeaderButton } from "@/components/auth/BoutiqueHeaderButton"
import {
  Sprout,
  Settings,
  Map as MapIcon,
  TreeDeciduous,
  Calendar,
  Leaf,
  Bird,
  Wallet,
  Apple,
  Wrench,
  HeartPulse,
  Bot,
  Trees,
  Wand2,
} from "lucide-react"
import { ChatPanel } from "@/components/chat/ChatPanel"
import { HeaderMeteoWidget } from "@/components/meteo"
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

const TABS = [
  { id: "calendrier", label: "Calendrier", icon: Calendar, shortLabel: "Calendrier" },
  { id: "plantations", label: "Plantations", icon: Trees, shortLabel: "Plant." },
  { id: "arbres", label: "Arbres", icon: TreeDeciduous, shortLabel: "Arbres" },
  { id: "productions", label: "Productions", icon: Apple, shortLabel: "Prod." },
  { id: "operations", label: "Operations", icon: Wrench, shortLabel: "Oper." },
  { id: "sante", label: "Sante & Phyto", icon: HeartPulse, shortLabel: "Sante" },
  { id: "referentiel", label: "Référentiel", icon: Leaf, shortLabel: "Ref." },
] as const

type TabId = (typeof TABS)[number]["id"]

const currentYearNow = new Date().getFullYear()
const availableYears = Array.from({ length: 6 }, (_, i) => currentYearNow - 5 + i).reverse()

export default function VergerPage() {
  return (
    <React.Suspense fallback={null}>
      <VergerPageInner />
    </React.Suspense>
  )
}

function VergerPageInner() {
  const { data: session } = useSession()
  const searchParams = useSearchParams()
  const [selectedYear, setSelectedYear] = React.useState(currentYearNow)
  const [showChat, setShowChat] = React.useState(false)
  const [showAssistant, setShowAssistant] = React.useState(false)
  // Support ?tab=xxx from redirects
  const tabParam = searchParams.get("tab")
  const initialTab = TABS.some(t => t.id === tabParam) ? (tabParam as TabId) : "calendrier"
  const [activeTab, setActiveTab] = React.useState<TabId>(initialTab)

  // Update tab when URL param changes
  React.useEffect(() => {
    if (tabParam && TABS.some(t => t.id === tabParam)) {
      setActiveTab(tabParam as TabId)
    }
  }, [tabParam])

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
        <div className="fixed bottom-2 left-4 right-4 z-50 h-[45vh] max-w-sm mx-auto rounded-xl border bg-background shadow-2xl flex flex-col overflow-hidden sm:mx-0 sm:left-auto sm:bottom-4 sm:right-4 sm:h-[540px] sm:w-[400px] sm:max-w-none sm:rounded-lg sm:border sm:shadow-xl">
          <ChatPanel onClose={() => setShowChat(false)} section="verger" sectionLabel="Verger" />
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
            {session?.user && <ModulesNav current="verger" />}
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

      {/* Navigation par onglets + selecteur d'annee + bouton Plan verger */}
      <nav className="border-b border-t-2 border-t-lime-500 bg-white/80 backdrop-blur-sm sticky top-[61px] z-40">
        <div className="container mx-auto px-4 max-w-[1600px]">
          <div className="flex items-center justify-between">
            {/* Onglets */}
            <div className="flex items-center -mb-px">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-3 lg:px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      isActive
                        ? "border-lime-600 text-lime-700"
                        : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                    }`}
                    title={tab.label}
                  >
                    <tab.icon className={`h-4 w-4 ${isActive ? "text-lime-600" : ""}`} />
                    <span className="hidden lg:inline">{tab.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Actions a droite: Plan verger + Annee */}
            <div className="flex items-center gap-2 py-2">
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
            </div>
          </div>
        </div>
      </nav>

      {/* POSTREVIEW Sprint 6 — Tour Shepherd.js Verger */}
      <TourVerger />
      {/* Contenu de l'onglet actif */}
      <main className="container mx-auto px-4 py-6 max-w-[1600px] space-y-4">
        <PremiersPasBanner module="verger" />
        {activeTab === "calendrier" && <CalendrierTab year={selectedYear} />}
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
        <p>Gleba v1.0.0</p>
      </footer>
    </div>
  )
}
