"use client"

/**
 * Page Admin - Gestion des référentiels globaux
 * Accessible uniquement aux administrateurs
 */

import * as React from "react"
import Link from "next/link"
import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Shield,
  Download,
  Upload,
  Database,
  Loader2,
  CheckCircle,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { Skeleton } from "@/components/ui/skeleton"

const REFERENTIELS = [
  { id: "familles", label: "Familles botaniques", count: 0, icon: "🌿" },
  { id: "fournisseurs", label: "Fournisseurs", count: 0, icon: "🏪" },
  { id: "especes", label: "Espèces", count: 0, icon: "🌱" },
  { id: "varietes", label: "Variétés", count: 0, icon: "🌾" },
  { id: "itps", label: "ITPs (Itinéraires techniques)", count: 0, icon: "📋" },
  { id: "fertilisants", label: "Fertilisants", count: 0, icon: "🧪" },
  { id: "associations", label: "Associations de cultures", count: 0, icon: "🤝" },
  { id: "rotations", label: "Rotations", count: 0, icon: "🔄" },
]

export default function ReferentielsAdminPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = React.useState<string | null>(null)
  const [stats, setStats] = React.useState<Record<string, number>>({})
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [currentRefType, setCurrentRefType] = React.useState<string | null>(null)

  // Vérifier que l'utilisateur est admin
  React.useEffect(() => {
    if (status === "loading") return
    if (!session?.user || session.user.role !== "ADMIN") {
      router.push("/")
    }
  }, [session, status, router])

  // Charger les stats
  React.useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch("/api/admin/referentiels/stats")
        if (response.ok) {
          const data = await response.json()
          setStats(data)
        }
      } catch (error) {
        console.error("Error fetching stats:", error)
      }
    }
    fetchStats()
  }, [])

  // Export d'un référentiel
  const handleExport = async (type: string) => {
    setLoading(type)
    try {
      const response = await fetch(`/api/admin/referentiels/export?type=${type}`)
      if (!response.ok) throw new Error("Erreur export")

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${type}_${new Date().toISOString().split('T')[0]}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: "Export réussi",
        description: `${type} exporté`,
      })
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: "Impossible d'exporter",
      })
    } finally {
      setLoading(null)
    }
  }

  // Import d'un référentiel
  const handleImportClick = (type: string) => {
    setCurrentRefType(type)
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !currentRefType) return

    setLoading(currentRefType)
    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("type", currentRefType)

      const response = await fetch("/api/admin/referentiels/import", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || "Erreur import")
      }

      const result = await response.json()
      toast({
        title: "Import réussi",
        description: result.message || "Référentiel importé",
      })

      // Recharger les stats
      window.location.reload()
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erreur",
        description: error instanceof Error ? error.message : "Impossible d'importer",
      })
    } finally {
      setLoading(null)
      setCurrentRefType(null)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-green-600" />
      </div>
    )
  }

  if (!session?.user || session.user.role !== "ADMIN") {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 max-w-[1200px]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Accueil
                </Button>
              </Link>
              <div className="flex items-center gap-2">
                <Shield className="h-6 w-6 text-red-600" />
                <h1 className="text-xl font-bold">Gestion des référentiels</h1>
              </div>
            </div>
            <Badge className="bg-red-100 text-red-700 border-red-300">
              Admin seulement
            </Badge>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-[1200px]">
        {/* Info */}
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            <strong>⚠️ Attention :</strong> Ces référentiels sont partagés entre TOUS les utilisateurs.
            Les modifications affecteront l'ensemble de l'application.
          </p>
        </div>

        {/* Input caché pour fichiers */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".json"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* Grille des référentiels */}
        <div className="grid gap-4 md:grid-cols-2">
          {REFERENTIELS.map((ref) => {
            const count = stats[ref.id] || 0
            const isLoading = loading === ref.id

            return (
              <Card key={ref.id}>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <span className="text-2xl">{ref.icon}</span>
                    <div className="flex-1">
                      <div className="text-base">{ref.label}</div>
                      <div className="text-sm text-muted-foreground font-normal">
                        {count > 0 ? `${count} enregistrements` : "Aucune donnée"}
                      </div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => handleExport(ref.id)}
                      disabled={isLoading || count === 0}
                      className="flex-1"
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4 mr-2" />
                      )}
                      Exporter
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleImportClick(ref.id)}
                      disabled={isLoading}
                      className="flex-1"
                    >
                      {isLoading ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4 mr-2" />
                      )}
                      Importer
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Actions globales */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5 text-blue-600" />
              Actions globales
            </CardTitle>
            <CardDescription>
              Export/Import de tous les référentiels en une seule fois
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <Button
                onClick={() => handleExport("all")}
                disabled={loading !== null}
                className="flex-1"
                variant="outline"
              >
                {loading === "all" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Download className="h-4 w-4 mr-2" />
                )}
                Tout exporter
              </Button>
              <Button
                onClick={() => handleImportClick("all")}
                disabled={loading !== null}
                className="flex-1"
                variant="outline"
              >
                {loading === "all" ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                Tout importer
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
