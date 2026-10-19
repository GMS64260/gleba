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
import { useAnneeModule } from "@/hooks/use-annee-module"
import { CLE_ANNEE_VERGER, ongletVergerSuitAnnee } from "@/lib/verger/annee-verger"

const TABS = [
  { id: "calendrier", label: "Calendrier", icon: Calendar, shortLabel: "Calendrier" },
  { id: "plantations", label: "Plantations", icon: Sprout, shortLabel: "Plant." },
  { id: "arbres", label: "Arbres", icon: TreeDeciduous, shortLabel: "Arbres" },
  { id: "productions", label: "Productions", icon: Apple, shortLabel: "Prod." },
  // QA cmv29ds0t — les libellés abrégés du mobile gardent leurs accents.
  { id: "operations", label: "Opérations", icon: Wrench, shortLabel: "Opér." },
  { id: "sante", label: "Santé & Phyto", icon: HeartPulse, shortLabel: "Santé" },
  { id: "referentiel", label: "Référentiel", icon: Leaf, shortLabel: "Réf." },
] as const

type TabId = (typeof TABS)[number]["id"]

// QA Camille 2026-05-15 — bonus : plage factorisée [N+1 … N-4]
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
  // QA cmsogh2sw — l'année du verger survit au rechargement (préférence
  // gleba_verger_year). QA cmsoamukd — les onglets attendent la restauration
  // (`yearHydrated`) avant de charger, sinon la salve « année par défaut »
  // écrase celle de l'année choisie.
  // QA 2026-10-19 — l'année vit désormais dans l'URL (`?annee=`, deep-link)
  // et filtre réellement les onglets qui en dépendent (Calendrier,
  // Opérations) ; les autres l'annoncent « Toutes années » (annee-verger.ts).
  const {
    annee: selectedYear,
    definirAnnee,
    pret: yearHydrated,
  } = useAnneeModule({ cleStockage: CLE_ANNEE_VERGER, annees: availableYears })
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
            {ongletVergerSuitAnnee(activeTab) ? (
              <Select
                value={selectedYear.toString()}
                onValueChange={(value) => definirAnnee(parseInt(value, 10))}
              >
                <SelectTrigger className="w-[100px] h-8" aria-label="Année affichée">
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
            ) : (
              // QA 2026-10-19 — un sélecteur sans effet sur l'onglet affiché
              // laissait croire à un filtre : la portée est dite.
              <span
                className="inline-flex h-8 items-center gap-1 rounded-md border border-dashed px-2 text-xs text-muted-foreground"
                title="Cet onglet couvre toutes les années ; le sélecteur d'année s'applique au Calendrier et aux Opérations."
                data-testid="verger-portee-annee"
              >
                <Calendar className="h-3.5 w-3.5" />
                Toutes années
              </span>
            )}
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
        {activeTab === "operations" && yearHydrated && <OperationsTab annee={selectedYear} />}
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
