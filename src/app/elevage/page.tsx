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
} from "lucide-react"
import { AssistantDialog, AssistantButton } from "@/components/assistant"
import { DashboardTab } from "@/components/elevage/DashboardTab"
import { AnimauxTab } from "@/components/elevage/AnimauxTab"
import { ProductionTab } from "@/components/elevage/ProductionTab"
import { AlimentationTab } from "@/components/elevage/AlimentationTab"
import { EspecesTab } from "@/components/elevage/EspecesTab"

const TABS = [
  { id: "dashboard", label: "Dashboard & Soins", icon: BarChart3, shortLabel: "Dashboard" },
  { id: "animaux", label: "Animaux & Lots", icon: Bird, shortLabel: "Animaux" },
  { id: "production", label: "Production", icon: Egg, shortLabel: "Production" },
  { id: "alimentation", label: "Alimentation", icon: Package, shortLabel: "Aliment." },
  { id: "especes", label: "Especes", icon: Leaf, shortLabel: "Especes" },
] as const

type TabId = (typeof TABS)[number]["id"]

const currentYearNow = new Date().getFullYear()
const availableYears = Array.from({ length: 6 }, (_, i) => currentYearNow - 5 + i).reverse()

export default function ElevageDashboard() {
  const { data: session } = useSession()
  const [selectedYear, setSelectedYear] = React.useState(currentYearNow)
  const [showAssistant, setShowAssistant] = React.useState(false)
  const [activeTab, setActiveTab] = React.useState<TabId>("dashboard")

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Chargement...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
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
            <div className="flex items-center border rounded-lg overflow-hidden">
              <Link href="/">
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-none text-green-700 hover:text-green-800 hover:bg-green-50 border-r"
                >
                  <Sprout className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Potager</span>
                </Button>
              </Link>
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
              <Button
                variant="ghost"
                size="sm"
                className="rounded-none bg-amber-50 text-amber-700 border-r"
              >
                <Bird className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Elevage</span>
              </Button>
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

      {/* Navigation par onglets + selecteur d'annee */}
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
                        ? "border-amber-600 text-amber-700"
                        : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                    }`}
                  >
                    <tab.icon className={`h-4 w-4 ${isActive ? "text-amber-600" : ""}`} />
                    <span className="hidden md:inline">{tab.label}</span>
                    <span className="md:hidden">{tab.shortLabel}</span>
                  </button>
                )
              })}
            </div>

            {/* Annee */}
            <div className="flex items-center gap-2 py-2">
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
        {activeTab === "dashboard" && <DashboardTab year={selectedYear} />}
        {activeTab === "animaux" && <AnimauxTab />}
        {activeTab === "production" && <ProductionTab />}
        {activeTab === "alimentation" && <AlimentationTab />}
        {activeTab === "especes" && <EspecesTab />}
      </main>

      {/* Footer */}
      <footer className="border-t mt-8 py-4 text-center text-sm text-gray-500">
        <p>Gleba v1.0.0</p>
      </footer>
    </div>
  )
}
