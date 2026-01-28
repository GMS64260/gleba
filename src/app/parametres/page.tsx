/**
 * Page Paramètres
 */

'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowLeft, Settings, Save, Download, Upload, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

// Clé localStorage pour les paramètres
const SETTINGS_KEY = 'potaleger_settings'

interface GardenSettings {
  // Dimensions du plan
  planWidth: number
  planHeight: number
  gridSize: number
  // Dimensions par défaut des planches
  defaultPlancheLargeur: number
  defaultPlancheLongueur: number
  // Couleurs
  plancheColor: string
  plancheSelectedColor: string
  gridColor: string
}

const defaultSettings: GardenSettings = {
  planWidth: 50,
  planHeight: 30,
  gridSize: 1,
  defaultPlancheLargeur: 0.8,
  defaultPlancheLongueur: 10,
  plancheColor: '#8B5A2B',
  plancheSelectedColor: '#22c55e',
  gridColor: '#e5e7eb',
}

export default function ParametresPage() {
  const { toast } = useToast()
  const [settings, setSettings] = React.useState<GardenSettings>(defaultSettings)
  const [saving, setSaving] = React.useState(false)
  const [exporting, setExporting] = React.useState(false)
  const [importing, setImporting] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  // Charger les paramètres au montage
  React.useEffect(() => {
    const stored = localStorage.getItem(SETTINGS_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setSettings({ ...defaultSettings, ...parsed })
      } catch {
        // Ignorer les erreurs de parsing
      }
    }
  }, [])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type } = e.target
    setSettings((prev) => ({
      ...prev,
      [name]: type === 'number' ? parseFloat(value) || 0 : value,
    }))
  }

  const handleSave = () => {
    setSaving(true)
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
      toast({
        title: 'Paramètres enregistrés',
        description: 'Vos préférences ont été sauvegardées',
      })
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: "Impossible d'enregistrer les paramètres",
      })
    } finally {
      setSaving(false)
    }
  }

  const handleReset = () => {
    if (confirm('Réinitialiser tous les paramètres aux valeurs par défaut ?')) {
      setSettings(defaultSettings)
      localStorage.removeItem(SETTINGS_KEY)
      toast({
        title: 'Paramètres réinitialisés',
        description: 'Les valeurs par défaut ont été restaurées',
      })
    }
  }

  // Export des données
  const handleExport = async (format: 'json' | 'csv') => {
    setExporting(true)
    try {
      const response = await fetch(`/api/export?format=${format}`)
      if (!response.ok) throw new Error('Erreur export')

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `potaleger_export_${new Date().toISOString().split('T')[0]}.${format === 'json' ? 'json' : 'zip'}`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)

      toast({
        title: 'Export réussi',
        description: `Données exportées en ${format.toUpperCase()}`,
      })
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: "Impossible d'exporter les données",
      })
    } finally {
      setExporting(false)
    }
  }

  // Import des données
  const handleImportClick = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImporting(true)
    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/import', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erreur import')
      }

      const result = await response.json()
      toast({
        title: 'Import réussi',
        description: result.message || 'Données importées avec succès',
      })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: err instanceof Error ? err.message : "Impossible d'importer les données",
      })
    } finally {
      setImporting(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b bg-white sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Accueil
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Settings className="h-6 w-6 text-gray-600" />
              <h1 className="text-xl font-bold">Paramètres</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
        {/* Paramètres du jardin */}
        <Card>
          <CardHeader>
            <CardTitle>Plan du jardin</CardTitle>
            <CardDescription>
              Configurez les dimensions et l'apparence du plan 2D
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Dimensions du plan */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">Dimensions du plan</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Largeur (m)</label>
                  <input
                    type="number"
                    name="planWidth"
                    value={settings.planWidth}
                    onChange={handleChange}
                    min="10"
                    max="200"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Hauteur (m)</label>
                  <input
                    type="number"
                    name="planHeight"
                    value={settings.planHeight}
                    onChange={handleChange}
                    min="10"
                    max="200"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Grille (m)</label>
                  <input
                    type="number"
                    name="gridSize"
                    value={settings.gridSize}
                    onChange={handleChange}
                    min="0.5"
                    max="5"
                    step="0.5"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Dimensions par défaut des planches */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">
                Dimensions par défaut des planches
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Largeur (m)</label>
                  <input
                    type="number"
                    name="defaultPlancheLargeur"
                    value={settings.defaultPlancheLargeur}
                    onChange={handleChange}
                    min="0.3"
                    max="2"
                    step="0.1"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Longueur (m)</label>
                  <input
                    type="number"
                    name="defaultPlancheLongueur"
                    value={settings.defaultPlancheLongueur}
                    onChange={handleChange}
                    min="1"
                    max="50"
                    step="0.5"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Couleurs */}
            <div>
              <h4 className="text-sm font-medium text-gray-900 mb-3">Couleurs</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Planches</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      name="plancheColor"
                      value={settings.plancheColor}
                      onChange={handleChange}
                      className="h-10 w-14 rounded border border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={settings.plancheColor}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, plancheColor: e.target.value }))
                      }
                      className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Sélection</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      name="plancheSelectedColor"
                      value={settings.plancheSelectedColor}
                      onChange={handleChange}
                      className="h-10 w-14 rounded border border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={settings.plancheSelectedColor}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, plancheSelectedColor: e.target.value }))
                      }
                      className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Grille</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      name="gridColor"
                      value={settings.gridColor}
                      onChange={handleChange}
                      className="h-10 w-14 rounded border border-gray-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={settings.gridColor}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, gridColor: e.target.value }))
                      }
                      className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Boutons */}
            <div className="flex justify-between pt-4 border-t">
              <Button variant="outline" onClick={handleReset}>
                Réinitialiser
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-2" />
                {saving ? 'Enregistrement...' : 'Enregistrer'}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Export / Import */}
        <Card>
          <CardHeader>
            <CardTitle>Données</CardTitle>
            <CardDescription>Exportez ou importez vos données</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              {/* Export */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-900">Exporter</h4>
                <p className="text-sm text-gray-500">
                  Téléchargez une sauvegarde de toutes vos données
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => handleExport('json')}
                    disabled={exporting}
                  >
                    {exporting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    JSON
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleExport('csv')}
                    disabled={exporting}
                  >
                    {exporting ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    CSV
                  </Button>
                </div>
              </div>

              {/* Import */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-gray-900">Importer</h4>
                <p className="text-sm text-gray-500">
                  Restaurez vos données depuis un fichier JSON
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button variant="outline" onClick={handleImportClick} disabled={importing}>
                  {importing ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  {importing ? 'Import en cours...' : 'Importer JSON'}
                </Button>
              </div>
            </div>

            <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <p className="text-sm text-yellow-800">
                <strong>Attention :</strong> L'import remplacera les données existantes.
                Pensez à faire un export avant d'importer.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
