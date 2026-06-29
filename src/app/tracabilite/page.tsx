"use client"

/**
 * Page Traçabilité reglementaire
 * Registre phytosanitaire, Registre de culture, Carnet sanitaire
 */

import * as React from "react"
import Link from "next/link"
import Image from "next/image"
import { getAvailableYears } from "@/components/year-selector"
import { useSession } from "next-auth/react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { UserMenu } from "@/components/auth/UserMenu"
import {
  Sprout,
  TreeDeciduous,
  Bird,
  Wallet,
  Settings,
  FileText,
  Shield,
  Leaf,
  Printer,
  Filter,
  ChevronDown,
  ChevronRight,
  AlertCircle,
} from "lucide-react"


// ============================================================
// TYPES
// ============================================================

interface PhytoEntry {
  id: number
  date: string
  culture: string
  espece: string
  parcelle: string
  localisation: string
  nuisibleCible: string | null
  produit: string | null
  numAMM: string | null
  doseAppliquee: number | null
  uniteDose: string | null
  surfaceTraitee: number | null
  dar: number | null
  delaiReentree: number | null
  conditionsMeteo: string | null
  applicateur: string
  intrantNumLot: string | null
  notes: string | null
  description: string | null
  champsManquants: string[]
  complet: boolean
}

interface PhytoData {
  registre: PhytoEntry[]
  stats: {
    totalTraitements: number
    produitsUtilises: string[]
    nbProduitsDistincts: number
    surfaceTotalTraitee: number
    nbIncomplets: number
    periodeDebut: string | null
    periodeFin: string | null
  }
}

interface CultureEntry {
  id: number
  identification: {
    espece: string
    famille: string | null
    variete: string | null
    bio: boolean
    planche: string | null
    surface: number | null
    ilot: string | null
    typePlanche: string | null
  }
  dates: {
    semis: string | null
    plantation: string | null
    premiereRecolte: string | null
    derniereRecolte: string | null
  }
  avancement: {
    semisFait: boolean
    plantationFaite: boolean
    recolteFaite: boolean
    terminee: string | null
  }
  recoltes: {
    id: number
    date: string
    quantite: number
    statut: string
    prixKg: number | null
    prixTotal: number | null
    notes: string | null
  }[]
  totalRecolte: number
  interventions: {
    id: number
    date: string
    type: string
    description: string | null
    dureeMinutes: number | null
    notes: string | null
  }[]
  fertilisations: {
    id: number
    date: string
    fertilisant: string
    type: string | null
    quantite: number
    npk: string
    notes: string | null
  }[]
  traitementsPhyto: {
    id: number
    date: string
    produit: string | null
    numAMM: string | null
    dose: number | null
    uniteDose: string | null
    surface: number | null
    dar: number | null
    cible: string | null
    meteo: string | null
  }[]
  chronologie: {
    date: string
    type: string
    description: string
    details?: Record<string, unknown>
  }[]
  notes: string | null
}

interface CultureData {
  registre: CultureEntry[]
  parEspece: Record<string, CultureEntry[]>
  stats: {
    totalCultures: number
    nbEspeces: number
    totalRecoltes: number
    totalInterventions: number
  }
}

interface SanitaireEntry {
  id: number
  date: string
  animalLot: string
  espece: string
  animalId: number | null
  lotId: number | null
  type: string
  typeLabel: string
  description: string | null
  produit: string | null
  quantite: number | null
  unite: string | null
  cout: number | null
  veterinaire: string | null
  datePrevue: string | null
  fait: boolean
  notes: string | null
}

interface SanitaireData {
  carnet: SanitaireEntry[]
  stats: {
    totalSoins: number
    parType: Record<string, number>
    nbAnimauxOuLots: number
    coutTotal: number
    periodeDebut: string | null
    periodeFin: string | null
  }
}

interface RegistreElevageEntry {
  date: string
  type: 'entree' | 'sortie' | 'naissance' | 'deces' | 'soin'
  animal: string
  espece: string
  identifiant: string
  detail: string
  lot: string
}

interface RegistreElevageData {
  annee: number
  ferme: { nom: string; siret: string; adresse: string }
  entries: RegistreElevageEntry[]
  stats: {
    totalEntrees: number
    totalSorties: number
    totalNaissances: number
    totalDeces: number
    totalSoins: number
  }
}

// ============================================================
// TABS
// ============================================================

const TABS = [
  { id: "phyto", label: "Registre phytosanitaire", icon: Shield, shortLabel: "Phyto" },
  { id: "culture", label: "Registre de culture", icon: Leaf, shortLabel: "Cultures" },
  { id: "sanitaire", label: "Carnet sanitaire", icon: Bird, shortLabel: "Sanitaire" },
  { id: "elevage", label: "Registre d'élevage", icon: FileText, shortLabel: "Élevage" },
] as const

type TabId = (typeof TABS)[number]["id"]

// QA Camille 2026-05-15 — bonus : plage factorisée [N+1 … N-4]
const currentYearNow = new Date().getFullYear()
const availableYears = getAvailableYears()

// ============================================================
// HELPERS
// ============================================================

function formatDate(iso: string | null): string {
  if (!iso) return "-"
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function formatDateShort(iso: string | null): string {
  if (!iso) return "-"
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
  })
}

// ============================================================
// CHRONOLOGY TYPE COLORS
// ============================================================

const TYPE_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  semis: { bg: "bg-amber-50", border: "border-amber-300", text: "text-amber-700", dot: "bg-amber-500" },
  plantation: { bg: "bg-green-50", border: "border-green-300", text: "text-green-700", dot: "bg-green-500" },
  recolte: { bg: "bg-emerald-50", border: "border-emerald-300", text: "text-emerald-700", dot: "bg-emerald-500" },
  fertilisation: { bg: "bg-cyan-50", border: "border-cyan-300", text: "text-cyan-700", dot: "bg-cyan-500" },
  traitement_phyto: { bg: "bg-red-50", border: "border-red-300", text: "text-red-700", dot: "bg-red-500" },
  desherbage: { bg: "bg-lime-50", border: "border-lime-300", text: "text-lime-700", dot: "bg-lime-500" },
  binage: { bg: "bg-orange-50", border: "border-orange-300", text: "text-orange-700", dot: "bg-orange-500" },
  paillage: { bg: "bg-yellow-50", border: "border-yellow-300", text: "text-yellow-700", dot: "bg-yellow-500" },
  arrosage: { bg: "bg-blue-50", border: "border-blue-300", text: "text-blue-700", dot: "bg-blue-500" },
  taille: { bg: "bg-purple-50", border: "border-purple-300", text: "text-purple-700", dot: "bg-purple-500" },
}

function getTypeStyle(type: string) {
  return TYPE_COLORS[type] || { bg: "bg-slate-50", border: "border-slate-300", text: "text-slate-700", dot: "bg-slate-500" }
}

const TYPE_LABELS: Record<string, string> = {
  semis: "Semis",
  plantation: "Plantation",
  recolte: "Récolte",
  fertilisation: "Fertilisation",
  traitement_phyto: "Traitement phyto",
  desherbage: "Desherbage",
  binage: "Binage",
  paillage: "Paillage",
  arrosage: "Arrosage",
  taille: "Taille",
  tuteurage: "Tuteurage",
  autre: "Autre",
}

// ============================================================
// MAIN PAGE
// ============================================================

export default function TraçabilitéPage() {
  return (
    <React.Suspense fallback={null}>
      <TraçabilitéContent />
    </React.Suspense>
  )
}

function TraçabilitéContent() {
  const { data: session } = useSession()
  const [activeTab, setActiveTab] = React.useState<TabId>("phyto")
  const [selectedYear, setSelectedYear] = React.useState(currentYearNow)

  // Data states
  const [phytoData, setPhytoData] = React.useState<PhytoData | null>(null)
  const [cultureData, setCultureData] = React.useState<CultureData | null>(null)
  const [sanitaireData, setSanitaireData] = React.useState<SanitaireData | null>(null)
  const [elevageData, setElevageData] = React.useState<RegistreElevageData | null>(null)
  const [loading, setLoading] = React.useState(true)

  // Filters
  const [sanitaireFilter, setSanitaireFilter] = React.useState<string>("all")

  // Expanded cultures
  const [expandedCultures, setExpandedCultures] = React.useState<Set<number>>(new Set())
  // Bug feedback testeur 2026-05-26 (cmpm732hg) — garde-fou export :
  // si des fiches sont non conformes (N° AMM / dose / DAR manquants),
  // on confirme explicitement avant l'export (registre incomplet =
  // non opposable lors d'un contrôle HVE/AB/DDPP).
  const [pendingExport, setPendingExport] = React.useState<string | null>(null)

  const handlePhytoExport = React.useCallback(
    (format: "pdf" | "csv") => {
      const url = `/api/registre-phyto/export?from=${selectedYear}-01-01&to=${selectedYear}-12-31&format=${format}`
      if ((phytoData?.stats.nbIncomplets ?? 0) > 0) {
        setPendingExport(url)
      } else {
        window.open(url, "_blank", "noopener,noreferrer")
      }
    },
    [selectedYear, phytoData]
  )

  // Fetch data when tab or year changes
  React.useEffect(() => {
    if (!session?.user) return

    const fetchData = async () => {
      setLoading(true)
      try {
        if (activeTab === "phyto") {
          const res = await fetch(`/api/tracabilite/registre-phyto?annee=${selectedYear}`)
          if (res.ok) setPhytoData(await res.json())
        } else if (activeTab === "culture") {
          const res = await fetch(`/api/tracabilite/registre-culture?annee=${selectedYear}`)
          if (res.ok) setCultureData(await res.json())
        } else if (activeTab === "sanitaire") {
          const res = await fetch(`/api/tracabilite/carnet-sanitaire?annee=${selectedYear}`)
          if (res.ok) setSanitaireData(await res.json())
        } else if (activeTab === "elevage") {
          const res = await fetch(`/api/tracabilite/registre-elevage?annee=${selectedYear}`)
          if (res.ok) setElevageData(await res.json())
        }
      } catch (err) {
        console.error("Erreur chargement tracabilite:", err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [activeTab, selectedYear, session?.user])

  const toggleCulture = (id: number) => {
    setExpandedCultures((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const handlePrint = () => {
    window.print()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-slate-50 to-slate-50">
      {/* Print header (hidden in screen, shown in print) */}
      <div className="print-header hidden">
        <h1 style={{ fontSize: "16pt", fontWeight: "bold", textAlign: "center", marginBottom: "4pt" }}>
          {activeTab === "phyto" && `Registre Phytosanitaire - Annee ${selectedYear}`}
          {activeTab === "culture" && `Registre de Culture - Annee ${selectedYear}`}
          {activeTab === "sanitaire" && `Carnet Sanitaire d'Elevage - Annee ${selectedYear}`}
          {activeTab === "elevage" && `Registre d'Elevage - Annee ${selectedYear}`}
        </h1>
        <p style={{ textAlign: "center", fontSize: "10pt", color: "#666", marginBottom: "12pt" }}>
          Document genere le {new Date().toLocaleDateString("fr-FR")} - Gleba
        </p>
        <hr style={{ borderTop: "2px solid #333", marginBottom: "12pt" }} />
      </div>

      {/* ============================================================ */}
      {/* HEADER */}
      {/* ============================================================ */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50 no-print">
        <div className="container mx-auto px-4 py-2.5 flex items-center justify-between max-w-[1600px]">
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
          <div className="flex items-center gap-2">
            {session?.user && (
              <div className="flex items-center border rounded-lg overflow-hidden">
                <Link href="/">
                  <Button variant="ghost" size="sm" className="rounded-none text-green-700 hover:text-green-800 hover:bg-green-50 border-r">
                    <Sprout className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Maraîchage</span>
                  </Button>
                </Link>
                <Link href="/verger">
                  <Button variant="ghost" size="sm" className="rounded-none text-lime-700 hover:text-lime-800 hover:bg-lime-50 border-r">
                    <TreeDeciduous className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Verger</span>
                  </Button>
                </Link>
                <Link href="/elevage">
                  <Button variant="ghost" size="sm" className="rounded-none text-amber-700 hover:text-amber-800 hover:bg-amber-50 border-r">
                    <Bird className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Élevage</span>
                  </Button>
                </Link>
                <Link href="/comptabilite">
                  <Button variant="ghost" size="sm" className="rounded-none text-blue-700 hover:text-blue-800 hover:bg-blue-50 border-r">
                    <Wallet className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Compta</span>
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" className="rounded-none bg-indigo-50 text-indigo-700">
                  <FileText className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Traçabilité</span>
                </Button>
              </div>
            )}
            <Link href="/parametres">
              <Button variant="ghost" size="sm">
                <Settings className="h-4 w-4" />
              </Button>
            </Link>
            {session?.user && <UserMenu user={session.user} />}
          </div>
        </div>
      </header>

      {/* ============================================================ */}
      {/* NAV TABS + YEAR SELECTOR */}
      {/* ============================================================ */}
      <nav className="border-b bg-white sticky top-[61px] z-40 no-print">
        <div className="container mx-auto px-4 max-w-[1600px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center -mb-px overflow-x-auto">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-1.5 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                      isActive
                        ? "border-indigo-600 text-indigo-700"
                        : "border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    <tab.icon className={`h-4 w-4 ${isActive ? "text-indigo-600" : ""}`} />
                    <span className="hidden md:inline">{tab.label}</span>
                    <span className="md:hidden">{tab.shortLabel}</span>
                  </button>
                )
              })}
            </div>

            <div className="flex items-center gap-2 py-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePrint}
                className="text-indigo-700 border-indigo-300 hover:bg-indigo-50"
              >
                <Printer className="h-4 w-4 mr-1" />
                <span className="hidden sm:inline">Imprimer / PDF</span>
              </Button>
              {/* PROMPT 11 LOT C — Export PDF / CSV du registre phyto (conforme arrêté 2009). */}
              {activeTab === "phyto" && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePhytoExport("pdf")}
                    className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Export PDF officiel</span>
                    <span className="sm:hidden">PDF</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePhytoExport("csv")}
                    className="text-emerald-700 border-emerald-300 hover:bg-emerald-50"
                  >
                    <FileText className="h-4 w-4 mr-1" />
                    <span className="hidden sm:inline">Export CSV (Excel)</span>
                    <span className="sm:hidden">CSV</span>
                  </Button>
                </>
              )}
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="h-8 px-2 text-sm border rounded-md bg-white"
              >
                {availableYears.map((year) => (
                  <option key={year} value={year}>
                    {year}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </nav>

      {/* ============================================================ */}
      {/* CONTENT */}
      {/* ============================================================ */}
      <main className="container mx-auto px-4 py-6 max-w-[1600px] print-content">
        {activeTab === "phyto" && (
          <PhytoTab data={phytoData} loading={loading} year={selectedYear} />
        )}
        {activeTab === "culture" && (
          <CultureTab
            data={cultureData}
            loading={loading}
            year={selectedYear}
            expandedCultures={expandedCultures}
            toggleCulture={toggleCulture}
          />
        )}
        {activeTab === "sanitaire" && (
          <SanitaireTab
            data={sanitaireData}
            loading={loading}
            year={selectedYear}
            filter={sanitaireFilter}
            setFilter={setSanitaireFilter}
          />
        )}
        {activeTab === "elevage" && (
          <ElevageRegistreTab data={elevageData} loading={loading} year={selectedYear} />
        )}
      </main>

      {/* Garde-fou export registre phyto incomplet (cmpm732hg). */}
      <ConfirmDialog
        open={pendingExport !== null}
        onOpenChange={(o) => !o && setPendingExport(null)}
        title="Registre incomplet — export non conforme"
        description={
          <span>
            {phytoData?.stats.nbIncomplets ?? 0} traitement(s) ont des champs obligatoires
            manquants (N° AMM, dose ou DAR). Un registre incomplet n'est{" "}
            <strong>pas opposable</strong> lors d'un contrôle (HVE, AB, DDPP). Complétez les
            fiches signalées « Non conforme » avant l'export, ou exportez quand même pour un
            usage interne.
          </span>
        }
        confirmLabel="Exporter quand même"
        cancelLabel="Compléter d'abord"
        variant="warning"
        onConfirm={() => {
          if (pendingExport) window.open(pendingExport, "_blank", "noopener,noreferrer")
          setPendingExport(null)
        }}
      />
    </div>
  )
}

// ============================================================
// TAB 1 - REGISTRE PHYTOSANITAIRE
// ============================================================

function PhytoTab({
  data,
  loading,
  year,
}: {
  data: PhytoData | null
  loading: boolean
  year: number
}) {
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!data || data.registre.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Shield className="h-12 w-12 mx-auto text-slate-300 mb-4" />
          <p className="text-muted-foreground text-lg">
            Aucun traitement phytosanitaire enregistre pour {year}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Les interventions de type &quot;Traitement phyto&quot; apparaitront ici automatiquement.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Stats summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-indigo-100">
              Total traitements
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.stats.totalTraitements}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Produits utilisés</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.stats.nbProduitsDistincts}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Surface totale traitee</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {data.stats.surfaceTotalTraitee > 10000
                ? `${(data.stats.surfaceTotalTraitee / 10000).toFixed(2)} ha`
                : `${data.stats.surfaceTotalTraitee} m²`}
            </p>
          </CardContent>
        </Card>
        {data.stats.nbIncomplets > 0 && (
          <Card className="border-red-200 bg-red-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-red-600 flex items-center gap-1">
                <AlertCircle className="h-4 w-4" />
                Fiches incompletes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold text-red-700">{data.stats.nbIncomplets}</p>
              <p className="text-xs text-red-500 mt-1">Champs obligatoires manquants</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Table */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-indigo-600" />
            Registre phytosanitaire - {year}
          </CardTitle>
          <CardDescription>
            Periode: {data.stats.periodeDebut ? formatDate(data.stats.periodeDebut) : "-"} au{" "}
            {data.stats.periodeFin ? formatDate(data.stats.periodeFin) : "-"}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-indigo-50">
                <th className="text-left p-2 font-semibold">Date</th>
                <th className="text-left p-2 font-semibold">Culture</th>
                <th className="text-left p-2 font-semibold">Parcelle</th>
                <th className="text-left p-2 font-semibold">Nuisible cible</th>
                <th className="text-left p-2 font-semibold">Produit</th>
                <th className="text-left p-2 font-semibold">N. AMM</th>
                <th className="text-left p-2 font-semibold">Dose</th>
                <th className="text-left p-2 font-semibold">Surface</th>
                <th className="text-left p-2 font-semibold">DAR (j)</th>
                <th className="text-left p-2 font-semibold">Meteo</th>
                <th className="text-left p-2 font-semibold">Applicateur</th>
              </tr>
            </thead>
            <tbody>
              {data.registre.map((entry) => (
                <tr
                  key={entry.id}
                  className={`border-b hover:bg-slate-50 ${!entry.complet ? "bg-red-50/50" : ""}`}
                >
                  <td className="p-2 whitespace-nowrap">
                    {formatDate(entry.date)}
                    {!entry.complet && (
                      <span
                        className="mt-0.5 flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wide text-red-600"
                        title={`Non conforme — champs obligatoires manquants : ${entry.champsManquants.join(", ")}`}
                      >
                        <AlertCircle className="h-3 w-3" />
                        Non conforme
                      </span>
                    )}
                  </td>
                  <td className="p-2">
                    <span className="font-medium">{entry.culture}</span>
                    {!entry.culture || entry.culture === "Non renseigne" ? (
                      <MissingField />
                    ) : null}
                  </td>
                  <td className="p-2">
                    {entry.parcelle}
                    {entry.localisation && (
                      <span className="text-xs text-slate-500 block">{entry.localisation}</span>
                    )}
                  </td>
                  <td className="p-2">
                    {entry.nuisibleCible || <MissingFieldOptional />}
                  </td>
                  <td className="p-2">
                    {entry.produit ? (
                      <span className="font-medium">{entry.produit}</span>
                    ) : (
                      <MissingField />
                    )}
                  </td>
                  <td className="p-2">
                    {entry.numAMM ? (
                      <code className="text-xs bg-slate-100 px-1 rounded">{entry.numAMM}</code>
                    ) : (
                      <MissingField />
                    )}
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    {entry.doseAppliquee ? (
                      <>
                        {entry.doseAppliquee} {entry.uniteDose || ""}
                      </>
                    ) : (
                      <MissingField />
                    )}
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    {entry.surfaceTraitee ? (
                      <>
                        {entry.surfaceTraitee > 10000
                          ? `${(entry.surfaceTraitee / 10000).toFixed(2)} ha`
                          : `${entry.surfaceTraitee} m²`}
                      </>
                    ) : (
                      <MissingField />
                    )}
                  </td>
                  <td className="p-2">
                    {entry.dar !== null ? (
                      <span>{entry.dar} j</span>
                    ) : (
                      <MissingField />
                    )}
                  </td>
                  <td className="p-2 text-xs max-w-[120px] truncate" title={entry.conditionsMeteo || ""}>
                    {entry.conditionsMeteo || <MissingFieldOptional />}
                  </td>
                  <td className="p-2 text-xs">{entry.applicateur}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

function MissingField() {
  return (
    <span className="inline-flex items-center gap-0.5 text-red-500 text-xs font-medium">
      <AlertCircle className="h-3 w-3" />
      Manquant
    </span>
  )
}

function MissingFieldOptional() {
  return <span className="text-slate-400 text-xs">-</span>
}

// ============================================================
// TAB 2 - REGISTRE DE CULTURE
// ============================================================

function CultureTab({
  data,
  loading,
  year,
  expandedCultures,
  toggleCulture,
}: {
  data: CultureData | null
  loading: boolean
  year: number
  expandedCultures: Set<number>
  toggleCulture: (id: number) => void
}) {
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!data || data.registre.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Leaf className="h-12 w-12 mx-auto text-slate-300 mb-4" />
          <p className="text-muted-foreground text-lg">
            Aucune culture enregistree pour {year}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Les cultures avec leurs semis, plantations et récoltes apparaitront ici.
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-4">
      {/* Stats summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-indigo-100">Total cultures</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.stats.totalCultures}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Espèces</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.stats.nbEspeces}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Récolte totale</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.stats.totalRecoltes.toFixed(1)} kg</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Interventions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.stats.totalInterventions}</p>
          </CardContent>
        </Card>
      </div>

      {/* Grouped by species */}
      {Object.entries(data.parEspece)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([espece, cultures]) => (
          <Card key={espece} className="culture-group">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <Leaf className="h-5 w-5 text-green-600" />
                {espece}
                <span className="text-sm font-normal text-muted-foreground">
                  ({cultures.length} culture{cultures.length > 1 ? "s" : ""})
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {cultures.map((culture) => {
                const isExpanded = expandedCultures.has(culture.id)
                return (
                  <div key={culture.id} className="border rounded-lg">
                    {/* Culture header (clickable) */}
                    <button
                      onClick={() => toggleCulture(culture.id)}
                      className="w-full flex items-center justify-between p-3 hover:bg-slate-50 transition-colors text-left"
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-slate-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-slate-500" />
                        )}
                        <div>
                          <span className="font-medium">
                            {culture.identification.espece}
                            {culture.identification.variete && (
                              <span className="text-muted-foreground font-normal">
                                {" "}
                                - {culture.identification.variete}
                              </span>
                            )}
                          </span>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                            {culture.identification.planche && (
                              <span>Planche: {culture.identification.planche}</span>
                            )}
                            {culture.identification.surface && (
                              <span>{culture.identification.surface} m²</span>
                            )}
                            {culture.identification.bio && (
                              <span className="text-green-600 font-medium">BIO</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <span>{culture.dates.semis ? formatDateShort(culture.dates.semis) : "-"}</span>
                        <span className="text-slate-300">&rarr;</span>
                        <span>{culture.dates.premiereRecolte ? formatDateShort(culture.dates.premiereRecolte) : "-"}</span>
                        {culture.totalRecolte > 0 && (
                          <span className="font-medium text-emerald-600">
                            {culture.totalRecolte.toFixed(1)} kg
                          </span>
                        )}
                      </div>
                    </button>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="border-t px-4 py-3 bg-slate-50/50">
                        {/* Timeline */}
                        {culture.chronologie.length > 0 ? (
                          <div className="space-y-1">
                            <h4 className="text-sm font-semibold text-slate-700 mb-3">Chronologie</h4>
                            <div className="relative pl-6">
                              {/* Vertical line */}
                              <div className="absolute left-[9px] top-1 bottom-1 w-0.5 bg-slate-200" />

                              {culture.chronologie.map((event, idx) => {
                                const style = getTypeStyle(event.type)
                                return (
                                  <div key={idx} className="relative flex items-start gap-3 mb-3 timeline-item">
                                    {/* Dot */}
                                    <div
                                      className={`absolute -left-6 top-1.5 w-3 h-3 rounded-full border-2 border-white ${style.dot} timeline-dot`}
                                    />
                                    {/* Content */}
                                    <div className={`flex-1 rounded-md px-3 py-1.5 text-sm ${style.bg} border ${style.border}`}>
                                      <div className="flex items-center justify-between">
                                        <span className={`font-medium ${style.text}`}>
                                          {TYPE_LABELS[event.type] || event.type}
                                        </span>
                                        <span className="text-xs text-slate-500">
                                          {formatDate(event.date)}
                                        </span>
                                      </div>
                                      <p className="text-xs text-slate-600 mt-0.5">
                                        {event.description}
                                      </p>
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">Aucun événement enregistré</p>
                        )}

                        {/* Notes */}
                        {culture.notes && (
                          <div className="mt-3 p-2 bg-yellow-50 border border-yellow-200 rounded text-sm">
                            <span className="font-medium text-yellow-800">Notes :</span>{" "}
                            <span className="text-yellow-700">{culture.notes}</span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </CardContent>
          </Card>
        ))}
    </div>
  )
}

// ============================================================
// TAB 3 - CARNET SANITAIRE
// ============================================================

function SanitaireTab({
  data,
  loading,
  year,
  filter,
  setFilter,
}: {
  data: SanitaireData | null
  loading: boolean
  year: number
  filter: string
  setFilter: (v: string) => void
}) {
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!data || data.carnet.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Bird className="h-12 w-12 mx-auto text-slate-300 mb-4" />
          <p className="text-muted-foreground text-lg">
            Aucun soin animal enregistre pour {year}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Les soins (vaccinations, vermifuges, traitements) apparaitront ici automatiquement.
          </p>
        </CardContent>
      </Card>
    )
  }

  const filteredEntries =
    filter === "all" ? data.carnet : data.carnet.filter((e) => e.type === filter)

  return (
    <div className="space-y-4">
      {/* Stats summary */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card className="bg-gradient-to-br from-indigo-500 to-indigo-600 text-white">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-indigo-100">Total soins</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data.stats.totalSoins}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Animaux/Lots traites</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{data.stats.nbAnimauxOuLots}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Cout total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(
                data.stats.coutTotal
              )}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-muted-foreground">Par type</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1">
              {Object.entries(data.stats.parType).map(([type, count]) => (
                <span
                  key={type}
                  className="inline-flex items-center text-xs px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700"
                >
                  {type === "vaccination"
                    ? "Vacc."
                    : type === "vermifuge"
                    ? "Verm."
                    : type === "traitement"
                    ? "Trait."
                    : type}
                  : {count}
                </span>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filter + Table */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Bird className="h-5 w-5 text-indigo-600" />
              Carnet sanitaire - {year}
            </CardTitle>
            <div className="flex items-center gap-2 no-print">
              <Filter className="h-4 w-4 text-slate-400" />
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="text-sm border rounded-md px-2 py-1 bg-white"
              >
                <option value="all">Tous les types</option>
                <option value="vaccination">Vaccination</option>
                <option value="vermifuge">Vermifuge</option>
                <option value="traitement">Traitement</option>
                <option value="autre">Autre</option>
              </select>
            </div>
          </div>
          <CardDescription>
            Periode: {data.stats.periodeDebut ? formatDate(data.stats.periodeDebut) : "-"} au{" "}
            {data.stats.periodeFin ? formatDate(data.stats.periodeFin) : "-"}
            {filter !== "all" && (
              <span className="ml-2 text-indigo-600">
                (filtre: {filter} - {filteredEntries.length} resultat{filteredEntries.length > 1 ? "s" : ""})
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-indigo-50">
                <th className="text-left p-2 font-semibold">Date</th>
                <th className="text-left p-2 font-semibold">Animal / Lot</th>
                <th className="text-left p-2 font-semibold">Type</th>
                <th className="text-left p-2 font-semibold">Description</th>
                <th className="text-left p-2 font-semibold">Produit</th>
                <th className="text-left p-2 font-semibold">Quantité</th>
                <th className="text-left p-2 font-semibold">Vétérinaire</th>
                <th className="text-left p-2 font-semibold">Notes</th>
              </tr>
            </thead>
            <tbody>
              {filteredEntries.map((entry) => (
                <tr key={entry.id} className="border-b hover:bg-slate-50">
                  <td className="p-2 whitespace-nowrap">{formatDate(entry.date)}</td>
                  <td className="p-2">
                    <span className="font-medium">{entry.animalLot}</span>
                    {entry.espece && (
                      <span className="text-xs text-slate-500 block">{entry.espece}</span>
                    )}
                  </td>
                  <td className="p-2">
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        entry.type === "vaccination"
                          ? "bg-blue-100 text-blue-700"
                          : entry.type === "vermifuge"
                          ? "bg-purple-100 text-purple-700"
                          : entry.type === "traitement"
                          ? "bg-red-100 text-red-700"
                          : "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {entry.typeLabel}
                    </span>
                  </td>
                  <td className="p-2 max-w-[200px] truncate" title={entry.description || ""}>
                    {entry.description || "-"}
                  </td>
                  <td className="p-2">{entry.produit || "-"}</td>
                  <td className="p-2 whitespace-nowrap">
                    {entry.quantite ? `${entry.quantite} ${entry.unite || ""}` : "-"}
                  </td>
                  <td className="p-2">{entry.veterinaire || "-"}</td>
                  <td className="p-2 text-xs max-w-[150px] truncate" title={entry.notes || ""}>
                    {entry.notes || "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}

// ============================================================
// TAB 4 - REGISTRE D'ELEVAGE (obligation legale)
// ============================================================

const ELEVAGE_TYPE_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  entree: { bg: "bg-green-100", text: "text-green-700", label: "Entrée" },
  sortie: { bg: "bg-orange-100", text: "text-orange-700", label: "Sortie" },
  naissance: { bg: "bg-pink-100", text: "text-pink-700", label: "Naissance" },
  deces: { bg: "bg-red-100", text: "text-red-700", label: "Décès" },
  soin: { bg: "bg-blue-100", text: "text-blue-700", label: "Soin" },
}

function ElevageRegistreTab({
  data,
  loading,
  year,
}: {
  data: RegistreElevageData | null
  loading: boolean
  year: number
}) {
  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!data || data.entries.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FileText className="h-12 w-12 mx-auto text-slate-300 mb-4" />
          <p className="text-muted-foreground text-lg">
            Aucun mouvement d&apos;elevage enregistre pour {year}
          </p>
          <p className="text-sm text-muted-foreground mt-2">
            Les entrees, sorties, naissances, deces et soins apparaitront ici automatiquement.
          </p>
        </CardContent>
      </Card>
    )
  }

  const totalMouvements = data.stats.totalEntrees + data.stats.totalSorties +
    data.stats.totalNaissances + data.stats.totalDeces + data.stats.totalSoins

  return (
    <div className="space-y-4">
      {/* En-tete ferme (visible surtout a l'impression) */}
      <Card className="bg-gradient-to-r from-amber-50 to-orange-50 border-amber-200">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-amber-900">{data.ferme.nom}</h2>
              {data.ferme.siret && (
                <p className="text-sm text-amber-700">SIRET : {data.ferme.siret}</p>
              )}
              {data.ferme.adresse && (
                <p className="text-sm text-amber-700">{data.ferme.adresse}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm font-medium text-amber-800">
                Registre d&apos;elevage - Annee {year}
              </p>
              <p className="text-xs text-amber-600">
                Art. L214-9 et R214-25 du Code rural
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-5">
        <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
          <CardHeader className="pb-1 pt-3">
            <CardTitle className="text-xs font-medium text-green-100">Entrees</CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <p className="text-2xl font-bold">{data.stats.totalEntrees}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
          <CardHeader className="pb-1 pt-3">
            <CardTitle className="text-xs font-medium text-orange-100">Sorties</CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <p className="text-2xl font-bold">{data.stats.totalSorties}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-pink-500 to-pink-600 text-white">
          <CardHeader className="pb-1 pt-3">
            <CardTitle className="text-xs font-medium text-pink-100">Naissances</CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <p className="text-2xl font-bold">{data.stats.totalNaissances}</p>
          </CardContent>
        </Card>
        <Card className={`bg-gradient-to-br ${data.stats.totalDeces > 0 ? 'from-red-500 to-red-600' : 'from-slate-400 to-slate-500'} text-white`}>
          <CardHeader className="pb-1 pt-3">
            <CardTitle className="text-xs font-medium text-red-100">Décès</CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <p className="text-2xl font-bold">{data.stats.totalDeces}</p>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
          <CardHeader className="pb-1 pt-3">
            <CardTitle className="text-xs font-medium text-blue-100">Soins</CardTitle>
          </CardHeader>
          <CardContent className="pb-3">
            <p className="text-2xl font-bold">{data.stats.totalSoins}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tableau chronologique */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-indigo-600" />
            Registre chronologique - {year}
          </CardTitle>
          <CardDescription>
            {totalMouvements} mouvement{totalMouvements > 1 ? "s" : ""} enregistre{totalMouvements > 1 ? "s" : ""}
          </CardDescription>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-amber-50">
                <th className="text-left p-2 font-semibold">Date</th>
                <th className="text-left p-2 font-semibold">Type</th>
                <th className="text-left p-2 font-semibold">Animal / Lot</th>
                <th className="text-left p-2 font-semibold">Espèce</th>
                <th className="text-left p-2 font-semibold">Identifiant</th>
                <th className="text-left p-2 font-semibold">Détail</th>
                <th className="text-left p-2 font-semibold">Lot</th>
              </tr>
            </thead>
            <tbody>
              {data.entries.map((entry, idx) => {
                const style = ELEVAGE_TYPE_STYLES[entry.type] || { bg: "bg-slate-100", text: "text-slate-700", label: entry.type }
                return (
                  <tr key={idx} className="border-b hover:bg-slate-50">
                    <td className="p-2 whitespace-nowrap">{formatDate(entry.date)}</td>
                    <td className="p-2">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${style.bg} ${style.text}`}>
                        {style.label}
                      </span>
                    </td>
                    <td className="p-2 font-medium">{entry.animal}</td>
                    <td className="p-2">{entry.espece}</td>
                    <td className="p-2">
                      {entry.identifiant !== '-' ? (
                        <code className="text-xs bg-slate-100 px-1 rounded">{entry.identifiant}</code>
                      ) : '-'}
                    </td>
                    <td className="p-2 max-w-[250px] truncate" title={entry.detail}>
                      {entry.detail}
                    </td>
                    <td className="p-2 text-xs">{entry.lot}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
