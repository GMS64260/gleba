/**
 * Page Paramètres
 */

'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowLeft, Settings, Save, Download, Upload, Loader2, ImageIcon, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'
import { Slider } from '@/components/ui/slider'

// Clé localStorage pour les paramètres
const SETTINGS_KEY = 'gleba_settings'

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
  // Image de fond (satellite)
  backgroundImage: string | null
  backgroundOpacity: number
  backgroundScale: number
  backgroundOffsetX: number
  backgroundOffsetY: number
  backgroundRotation: number
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
  backgroundImage: null,
  backgroundOpacity: 0.5,
  backgroundScale: 0.1,
  backgroundOffsetX: 0,
  backgroundOffsetY: 0,
  backgroundRotation: 0,
}

export default function ParametresPage() {
  const { toast } = useToast()
  const [settings, setSettings] = React.useState<GardenSettings>(defaultSettings)
  const [saving, setSaving] = React.useState(false)
  const [exporting, setExporting] = React.useState(false)
  const [importing, setImporting] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const imageInputRef = React.useRef<HTMLInputElement>(null)

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
      a.download = `gleba_export_${new Date().toISOString().split('T')[0]}.${format === 'json' ? 'json' : 'zip'}`
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

  // Gestion de l'image de fond
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Verifier que c'est une image
    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Veuillez selectionner un fichier image (JPG, PNG, etc.)',
      })
      return
    }

    // Verifier la taille (max 10 MB)
    if (file.size > 10 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'L\'image est trop volumineuse (max 10 MB)',
      })
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string
      setSettings((prev) => ({ ...prev, backgroundImage: dataUrl }))
      toast({
        title: 'Image chargee',
        description: 'N\'oubliez pas d\'enregistrer les parametres',
      })
    }
    reader.onerror = () => {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de lire le fichier image',
      })
    }
    reader.readAsDataURL(file)

    if (imageInputRef.current) {
      imageInputRef.current.value = ''
    }
  }

  const handleRemoveImage = () => {
    if (confirm('Supprimer l\'image de fond ?')) {
      setSettings((prev) => ({ ...prev, backgroundImage: null }))
      toast({
        title: 'Image supprimee',
        description: 'N\'oubliez pas d\'enregistrer les parametres',
      })
    }
  }

  // Suppression de toutes les données utilisateur
  const handleDeleteAllData = async () => {
    const confirmation1 = confirm(
      '⚠️ ATTENTION ⚠️\n\nVous allez supprimer TOUTES vos données :\n- Cultures, récoltes, irrigations\n- Planches, fertilisations\n- Arbres, objets jardin\n- Notes\n\nCette action est IRRÉVERSIBLE.\n\nContinuer ?'
    )
    if (!confirmation1) return

    const confirmation2 = prompt(
      'Pour confirmer, tapez "SUPPRIMER" en majuscules :'
    )
    if (confirmation2 !== 'SUPPRIMER') {
      toast({
        title: 'Annulé',
        description: 'Suppression annulée',
      })
      return
    }

    setDeleting(true)
    try {
      const response = await fetch('/api/user/delete-data', {
        method: 'DELETE',
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erreur suppression')
      }

      const result = await response.json()

      toast({
        title: 'Données supprimées',
        description: result.message,
      })

      // Recharger la page après 2 secondes
      setTimeout(() => {
        window.location.href = '/'
      }, 2000)
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: err instanceof Error ? err.message : 'Impossible de supprimer les données',
      })
    } finally {
      setDeleting(false)
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

        {/* Image de fond */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Image de fond (satellite)
            </CardTitle>
            <CardDescription>
              Ajoutez une image satellite ou photo aerienne de votre jardin comme fond de plan
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Upload image */}
            <div>
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />

              {settings.backgroundImage ? (
                <div className="space-y-4">
                  <div className="relative border rounded-lg overflow-hidden bg-gray-100">
                    <img
                      src={settings.backgroundImage}
                      alt="Fond du jardin"
                      className="max-h-48 w-auto mx-auto object-contain"
                    />
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      onClick={() => imageInputRef.current?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Changer l'image
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleRemoveImage}
                      className="text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Supprimer
                    </Button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => imageInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-green-500 hover:bg-green-50 transition-colors"
                >
                  <ImageIcon className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                  <p className="text-sm text-gray-600">
                    Cliquez pour ajouter une image satellite
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    JPG, PNG (max 10 MB)
                  </p>
                </div>
              )}
            </div>

            {/* Parametres de l'image */}
            {settings.backgroundImage && (
              <div className="space-y-4 pt-4 border-t">
                <h4 className="text-sm font-medium text-gray-900">Ajustements</h4>

                {/* Opacite */}
                <div>
                  <label className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Opacite</span>
                    <span>{Math.round(settings.backgroundOpacity * 100)}%</span>
                  </label>
                  <Slider
                    value={[settings.backgroundOpacity]}
                    onValueChange={([value]) => setSettings((prev) => ({ ...prev, backgroundOpacity: value }))}
                    min={0.1}
                    max={1}
                    step={0.05}
                    className="w-full"
                  />
                </div>

                {/* Echelle */}
                <div>
                  <label className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Echelle (metres par pixel)</span>
                    <span>{settings.backgroundScale.toFixed(3)} m/px</span>
                  </label>
                  <Slider
                    value={[settings.backgroundScale]}
                    onValueChange={([value]) => setSettings((prev) => ({ ...prev, backgroundScale: value }))}
                    min={0.01}
                    max={1}
                    step={0.005}
                    className="w-full"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    Ajustez pour que l'image corresponde a l'echelle reelle de votre jardin
                  </p>
                </div>

                {/* Position X/Y */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Decalage X (m)</label>
                    <input
                      type="number"
                      value={settings.backgroundOffsetX}
                      onChange={(e) => setSettings((prev) => ({ ...prev, backgroundOffsetX: parseFloat(e.target.value) || 0 }))}
                      step="0.5"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-gray-600 mb-1">Decalage Y (m)</label>
                    <input
                      type="number"
                      value={settings.backgroundOffsetY}
                      onChange={(e) => setSettings((prev) => ({ ...prev, backgroundOffsetY: parseFloat(e.target.value) || 0 }))}
                      step="0.5"
                      className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                {/* Rotation */}
                <div>
                  <label className="flex justify-between text-sm text-gray-600 mb-2">
                    <span>Rotation</span>
                    <span>{settings.backgroundRotation}°</span>
                  </label>
                  <Slider
                    value={[settings.backgroundRotation]}
                    onValueChange={([value]) => setSettings((prev) => ({ ...prev, backgroundRotation: value }))}
                    min={-180}
                    max={180}
                    step={1}
                    className="w-full"
                  />
                </div>
              </div>
            )}

            {/* Bouton sauvegarder */}
            {settings.backgroundImage && (
              <div className="flex justify-end pt-4 border-t">
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
              </div>
            )}
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

        {/* Zone de danger */}
        <Card className="border-red-200 bg-red-50">
          <CardHeader>
            <CardTitle className="text-red-700">Zone de danger</CardTitle>
            <CardDescription className="text-red-600">
              Actions irréversibles - utilisez avec précaution
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <h4 className="text-sm font-medium text-gray-900 mb-1">
                    Supprimer toutes mes données
                  </h4>
                  <p className="text-sm text-gray-600">
                    Supprime toutes vos cultures, planches, récoltes, arbres et objets.
                    Les référentiels (espèces, ITPs, etc.) sont conservés.
                  </p>
                </div>
                <Button
                  variant="destructive"
                  onClick={handleDeleteAllData}
                  disabled={deleting}
                >
                  {deleting ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Suppression...
                    </>
                  ) : (
                    <>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Tout supprimer
                    </>
                  )}
                </Button>
              </div>
              <div className="p-3 bg-white border border-red-300 rounded-lg">
                <p className="text-xs text-red-700">
                  ⚠️ Cette action est <strong>irréversible</strong>. Exportez vos données avant si vous souhaitez les conserver.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  )
}
