"use client"

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { useSession } from "next-auth/react"
import { useSearchParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { UserMenu } from "@/components/auth/UserMenu"
import { WelcomeDialog } from "@/components/onboarding/WelcomeDialog"
import {
  Sprout,
  LayoutGrid,
  BarChart3,
  Settings,
  Map as MapIcon,
  TreeDeciduous,
  Calendar,
  Leaf,
  Bird,
  Wallet,
} from "lucide-react"
import { AssistantDialog, AssistantButton } from "@/components/assistant"
import { CalendrierTab } from "@/components/potager/CalendrierTab"
import { CulturesTab } from "@/components/potager/CulturesTab"
import { TerrainTab } from "@/components/potager/TerrainTab"
import { PlanificationTab } from "@/components/potager/PlanificationTab"
import { ReferentielTab } from "@/components/potager/ReferentielTab"

const TABS = [
  { id: "calendrier", label: "Calendrier & Taches", icon: Calendar, shortLabel: "Calendrier" },
  { id: "cultures", label: "Cultures", icon: Sprout, shortLabel: "Cultures" },
  { id: "terrain", label: "Terrain", icon: LayoutGrid, shortLabel: "Terrain" },
  { id: "planification", label: "Planification", icon: BarChart3, shortLabel: "Planif." },
  { id: "referentiel", label: "Referentiel", icon: Leaf, shortLabel: "Ref." },
] as const

type TabId = (typeof TABS)[number]["id"]

const currentYearNow = new Date().getFullYear()
const availableYears = Array.from({ length: 6 }, (_, i) => currentYearNow - 5 + i).reverse()

export default function Home() {
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
  const [selectedYear, setSelectedYear] = React.useState(currentYearNow)
  const [showAssistant, setShowAssistant] = React.useState(false)

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
    <div className="min-h-screen bg-gray-50">
      {/* Dialog de bienvenue */}
      <WelcomeDialog
        open={showWelcome}
        onOpenChange={setShowWelcome}
        onComplete={handleOnboardingComplete}
      />

      {/* Assistant */}
      <AssistantDialog open={showAssistant} onOpenChange={setShowAssistant} />

      {/* Header global */}
      <header className="border-b bg-white/95 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-2.5 flex items-center justify-between max-w-[1600px]">
          <Link href="/" className="flex items-center hover:opacity-90 transition-opacity">
            <Image
              src="/gleba.png"
              alt="Gleba"
              width={120}
              height={80}
              className="rounded-lg"
              priority
            />
          </Link>
          <div className="flex items-center gap-2">
            {/* Sections globales */}
            {session?.user && (
              <div className="flex items-center border rounded-lg overflow-hidden">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-none bg-green-50 text-green-700 border-r"
                >
                  <Sprout className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Potager</span>
                </Button>
                <Link href="/arbres">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-none text-lime-700 hover:text-lime-800 hover:bg-lime-50 border-r"
                  >
                    <TreeDeciduous className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Verger</span>
                  </Button>
                </Link>
                <Link href="/elevage">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-none text-amber-700 hover:text-amber-800 hover:bg-amber-50 border-r"
                  >
                    <Bird className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Elevage</span>
                  </Button>
                </Link>
                <Link href="/comptabilite">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-none text-blue-700 hover:text-blue-800 hover:bg-blue-50"
                  >
                    <Wallet className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Compta</span>
                  </Button>
                </Link>
              </div>
            )}
            <AssistantButton onClick={() => setShowAssistant(true)} />
            <Link href="/parametres">
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
            {session?.user && <UserMenu user={session.user} />}
          </div>
        </div>
      </header>

      {/* Navigation par onglets + sélecteur d'année + bouton Plan jardin */}
      <nav className="border-b bg-white sticky top-[57px] z-40">
        <div className="container mx-auto px-4 max-w-[1600px]">
          <div className="flex items-center justify-between">
            {/* Onglets */}
            <div className="flex items-center -mb-px overflow-x-auto">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      isActive
                        ? "border-green-600 text-green-700"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <tab.icon className={`h-4 w-4 ${isActive ? "text-green-600" : ""}`} />
                    <span className="hidden md:inline">{tab.label}</span>
                    <span className="md:hidden">{tab.shortLabel}</span>
                  </button>
                )
              })}
            </div>

            {/* Actions à droite: Plan jardin + Année */}
            <div className="flex items-center gap-2 py-2">
              <Link href="/jardin">
                <Button variant="outline" size="sm" className="text-teal-700 border-teal-300 hover:bg-teal-50">
                  <MapIcon className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Plan</span>
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

      {/* Contenu de l'onglet actif */}
      <main className="container mx-auto px-4 py-6 max-w-[1600px]">
        {activeTab === "calendrier" && <CalendrierTab year={selectedYear} />}
        {activeTab === "cultures" && <CulturesTab />}
        {activeTab === "terrain" && <TerrainTab />}
        {activeTab === "planification" && <PlanificationTab year={selectedYear} />}
        {activeTab === "referentiel" && <ReferentielTab />}
      </main>

      {/* Footer */}
      <footer className="border-t mt-8 py-4 text-center text-sm text-gray-500">
        <p>Gleba v1.0.0</p>
      </footer>
    </div>
  )
}
