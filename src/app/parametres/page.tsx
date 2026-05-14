/**
 * Page Paramètres
 */

'use client'

import * as React from 'react'
import Link from 'next/link'
import { ArrowLeft, Settings, Save, Download, Upload, Loader2, ImageIcon, Trash2, Key, Copy, Check, RefreshCw, Bot, CloudSun, Layers, Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { StationMeteoConfig } from '@/components/meteo'
import { useToast } from '@/hooks/use-toast'
import { Slider } from '@/components/ui/slider'
import { useModules } from '@/hooks/use-modules'
import { MODULES, MODULE_IDS, type ModuleId } from '@/lib/modules'

// Clé localStorage pour les parametres
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
  // MCP / API Token
  const [mcpLoading, setMcpLoading] = React.useState(false)
  const [mcpToken, setMcpToken] = React.useState<string | null>(null)
  const [mcpMaskedToken, setMcpMaskedToken] = React.useState<string | null>(null)
  const [mcpHasToken, setMcpHasToken] = React.useState(false)
  const [mcpCopied, setMcpCopied] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const imageInputRef = React.useRef<HTMLInputElement>(null)

  // Charger les parametres au montage
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

  // Charger le statut du token MCP
  React.useEffect(() => {
    fetch('/api/user/api-token')
      .then(r => r.json())
      .then(data => {
        setMcpHasToken(data.hasToken)
        setMcpMaskedToken(data.maskedToken || null)
      })
      .catch(() => {})
  }, [])

  const handleGenerateToken = async () => {
    if (mcpHasToken && !confirm('Un token existe déjà. Le régénérer va invalider le précédent. Continuer ?')) return
    setMcpLoading(true)
    try {
      const res = await fetch('/api/user/api-token', { method: 'POST' })
      const data = await res.json()
      if (data.token) {
        setMcpToken(data.token)
        setMcpHasToken(true)
        setMcpMaskedToken(null)
        toast({ title: 'Token généré', description: 'Copiez-le maintenant, il ne sera plus affiché en clair.' })
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de générer le token' })
    } finally {
      setMcpLoading(false)
    }
  }

  const handleRevokeToken = async () => {
    if (!confirm('Révoquer le token ? Les connexions MCP existantes seront coupées.')) return
    setMcpLoading(true)
    try {
      await fetch('/api/user/api-token', { method: 'DELETE' })
      setMcpToken(null)
      setMcpMaskedToken(null)
      setMcpHasToken(false)
      toast({ title: 'Token révoqué' })
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de révoquer le token' })
    } finally {
      setMcpLoading(false)
    }
  }

  const handleCopyMcp = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setMcpCopied(label)
      setTimeout(() => setMcpCopied(null), 2000)
      toast({ title: 'Copié !' })
    })
  }

  // Génère la config Claude Desktop JSON
  const claudeDesktopConfig = mcpToken
    ? JSON.stringify({
        mcpServers: {
          gleba: {
            command: 'npx',
            args: ['-y', '@gleba/mcp-server'],
            env: {
              GLEBA_URL: typeof window !== 'undefined' ? window.location.origin : 'https://gleba.fr',
              GLEBA_TOKEN: mcpToken,
            },
          },
        },
      }, null, 2)
    : null

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
        title: 'Image supprimée',
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
    <div className="min-h-screen bg-slate-50 aurora-bg-subtle">
      <div className="fixed inset-0 dot-grid opacity-40 pointer-events-none" aria-hidden="true" />
      {/* Header */}
      <header className="border-b bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Accueil
              </Button>
            </Link>
            <div className="flex items-center gap-2">
              <Settings className="h-6 w-6 text-slate-600" />
              <h1 className="text-xl font-bold">Paramètres</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6 max-w-4xl space-y-6">
        {/* Identité légale de l'exploitation (PROMPT 14) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5 text-slate-600" />
              Identité de l'exploitation
            </CardTitle>
            <CardDescription>
              Raison sociale, SIRET, régime fiscal, coordonnées bancaires. Apparaissent sur factures, devis et exports comptables.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/parametres/exploitation">
              <Button variant="outline">
                <Building2 className="h-4 w-4 mr-2" />
                Configurer l'exploitation
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Modules actifs */}
        <ModulesSection />

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
              <h4 className="text-sm font-medium text-slate-900 mb-3">Dimensions du plan</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Largeur (m)</label>
                  <input
                    type="number"
                    name="planWidth"
                    value={settings.planWidth}
                    onChange={handleChange}
                    min="10"
                    max="200"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Hauteur (m)</label>
                  <input
                    type="number"
                    name="planHeight"
                    value={settings.planHeight}
                    onChange={handleChange}
                    min="10"
                    max="200"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Grille (m)</label>
                  <input
                    type="number"
                    name="gridSize"
                    value={settings.gridSize}
                    onChange={handleChange}
                    min="0.5"
                    max="5"
                    step="0.5"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Dimensions par défaut des planches */}
            <div>
              <h4 className="text-sm font-medium text-slate-900 mb-3">
                Dimensions par défaut des planches
              </h4>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Largeur (m)</label>
                  <input
                    type="number"
                    name="defaultPlancheLargeur"
                    value={settings.defaultPlancheLargeur}
                    onChange={handleChange}
                    min="0.3"
                    max="2"
                    step="0.1"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Longueur (m)</label>
                  <input
                    type="number"
                    name="defaultPlancheLongueur"
                    value={settings.defaultPlancheLongueur}
                    onChange={handleChange}
                    min="1"
                    max="50"
                    step="0.5"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Couleurs */}
            <div>
              <h4 className="text-sm font-medium text-slate-900 mb-3">Couleurs</h4>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Planches</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      name="plancheColor"
                      value={settings.plancheColor}
                      onChange={handleChange}
                      className="h-10 w-14 rounded border border-slate-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={settings.plancheColor}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, plancheColor: e.target.value }))
                      }
                      className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Sélection</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      name="plancheSelectedColor"
                      value={settings.plancheSelectedColor}
                      onChange={handleChange}
                      className="h-10 w-14 rounded border border-slate-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={settings.plancheSelectedColor}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, plancheSelectedColor: e.target.value }))
                      }
                      className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-600 mb-1">Grille</label>
                  <div className="flex gap-2">
                    <input
                      type="color"
                      name="gridColor"
                      value={settings.gridColor}
                      onChange={handleChange}
                      className="h-10 w-14 rounded border border-slate-300 cursor-pointer"
                    />
                    <input
                      type="text"
                      value={settings.gridColor}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, gridColor: e.target.value }))
                      }
                      className="flex-1 rounded-md border border-slate-300 px-3 py-2 text-sm"
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
                  <div className="relative border rounded-lg overflow-hidden bg-slate-100">
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
                  className="border-2 border-dashed border-slate-300 rounded-lg p-8 text-center cursor-pointer hover:border-green-500 hover:bg-green-50 transition-colors"
                >
                  <ImageIcon className="h-12 w-12 text-slate-400 mx-auto mb-3" />
                  <p className="text-sm text-slate-600">
                    Cliquez pour ajouter une image satellite
                  </p>
                  <p className="text-xs text-slate-400 mt-1">
                    JPG, PNG (max 10 MB)
                  </p>
                </div>
              )}
            </div>

            {/* Parametres de l'image */}
            {settings.backgroundImage && (
              <div className="space-y-4 pt-4 border-t">
                <h4 className="text-sm font-medium text-slate-900">Ajustements</h4>

                {/* Opacite */}
                <div>
                  <label className="flex justify-between text-sm text-slate-600 mb-2">
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
                  <label className="flex justify-between text-sm text-slate-600 mb-2">
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
                  <p className="text-xs text-slate-400 mt-1">
                    Ajustez pour que l'image corresponde a l'echelle reelle de votre jardin
                  </p>
                </div>

                {/* Position X/Y */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Decalage X (m)</label>
                    <input
                      type="number"
                      value={settings.backgroundOffsetX}
                      onChange={(e) => setSettings((prev) => ({ ...prev, backgroundOffsetX: parseFloat(e.target.value) || 0 }))}
                      step="0.5"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm text-slate-600 mb-1">Decalage Y (m)</label>
                    <input
                      type="number"
                      value={settings.backgroundOffsetY}
                      onChange={(e) => setSettings((prev) => ({ ...prev, backgroundOffsetY: parseFloat(e.target.value) || 0 }))}
                      step="0.5"
                      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                    />
                  </div>
                </div>

                {/* Rotation */}
                <div>
                  <label className="flex justify-between text-sm text-slate-600 mb-2">
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
                <h4 className="text-sm font-medium text-slate-900">Exporter</h4>
                <p className="text-sm text-slate-500">
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
                <h4 className="text-sm font-medium text-slate-900">Importer</h4>
                <p className="text-sm text-slate-500">
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

        {/* Stations météo */}
        {/* Sécurité : changement de mot de passe */}
        <ChangePasswordSection />

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CloudSun className="h-5 w-5" />
              Stations meteo
            </CardTitle>
            <CardDescription>
              Connectez votre station meteo personnelle pour des données ultra-locales sur vos parcelles
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StationMeteoConfig />
          </CardContent>
        </Card>

        {/* Connexion MCP / IA */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" />
              Connexion MCP / IA
            </CardTitle>
            <CardDescription>
              Connectez votre assistant IA (Claude, ChatGPT, etc.) pour interagir avec votre ferme en langage naturel
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Statut du token */}
            <div className="space-y-3">
              <h4 className="text-sm font-medium text-slate-900 flex items-center gap-2">
                <Key className="h-4 w-4" />
                Token API
              </h4>

              {mcpHasToken && !mcpToken && (
                <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <div className="h-2 w-2 bg-green-500 rounded-full" />
                  <span className="text-sm text-green-700">
                    Token actif : <code className="bg-green-100 px-1 rounded">{mcpMaskedToken}</code>
                  </span>
                </div>
              )}

              {mcpToken && (
                <div className="space-y-2">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                    <p className="text-xs text-amber-700 font-medium mb-2">
                      Copiez ce token maintenant. Il ne sera plus affiché en clair.
                    </p>
                    <div className="flex items-center gap-2">
                      <code className="flex-1 text-xs bg-white border rounded px-2 py-1.5 font-mono break-all select-all">
                        {mcpToken}
                      </code>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCopyMcp(mcpToken, 'token')}
                      >
                        {mcpCopied === 'token' ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant={mcpHasToken ? 'outline' : 'default'}
                  onClick={handleGenerateToken}
                  disabled={mcpLoading}
                >
                  {mcpLoading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : mcpHasToken ? (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  ) : (
                    <Key className="h-4 w-4 mr-2" />
                  )}
                  {mcpHasToken ? 'Régénérer' : 'Générer un token'}
                </Button>
                {mcpHasToken && (
                  <Button
                    variant="outline"
                    onClick={handleRevokeToken}
                    disabled={mcpLoading}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Révoquer
                  </Button>
                )}
              </div>
            </div>

            {/* Configuration Claude Desktop */}
            {mcpToken && (
              <div className="space-y-3 pt-4 border-t">
                <h4 className="text-sm font-medium text-slate-900">
                  Configuration Claude Desktop
                </h4>
                <p className="text-sm text-slate-500">
                  Ajoutez cette configuration dans le fichier <code className="bg-slate-100 px-1 rounded text-xs">claude_desktop_config.json</code> de Claude Desktop :
                </p>
                <div className="relative">
                  <pre className="text-xs bg-slate-900 text-green-400 p-4 rounded-lg overflow-x-auto font-mono">
                    {claudeDesktopConfig}
                  </pre>
                  <Button
                    variant="outline"
                    size="sm"
                    className="absolute top-2 right-2 bg-slate-800 text-white hover:bg-slate-700 border-slate-600"
                    onClick={() => handleCopyMcp(claudeDesktopConfig!, 'config')}
                  >
                    {mcpCopied === 'config' ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>

                <div className="space-y-2 text-sm text-slate-600">
                  <p className="font-medium text-slate-900">Installation :</p>
                  <ol className="list-decimal list-inside space-y-1 text-xs">
                    <li>Ouvrez Claude Desktop &rarr; Settings &rarr; Developer &rarr; Edit Config</li>
                    <li>Collez la configuration ci-dessus</li>
                    <li>Redémarrez Claude Desktop</li>
                    <li>Les outils Gleba apparaissent dans la liste des serveurs MCP</li>
                  </ol>
                </div>
              </div>
            )}

            {/* Guide */}
            {!mcpToken && (
              <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  <strong>MCP (Model Context Protocol)</strong> permet à votre assistant IA d'interagir directement
                  avec vos données Gleba. Vous pourrez par exemple dire :
                </p>
                <ul className="mt-2 text-sm text-blue-700 space-y-1">
                  <li>&laquo; Qu'est-ce que je dois faire en maraîchage cette semaine ? &raquo;</li>
                  <li>&laquo; Enregistre 3kg de tomates récoltées sur la planche S4 &raquo;</li>
                  <li>&laquo; Combien d'oeufs mes poules ont pondu ce mois-ci ? &raquo;</li>
                </ul>
              </div>
            )}
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
                  <h4 className="text-sm font-medium text-slate-900 mb-1">
                    Supprimer toutes mes données
                  </h4>
                  <p className="text-sm text-slate-600">
                    Supprimé toutes vos cultures, planches, recoltes, arbres et objets.
                    Les référentiels (especes, ITPs, etc.) sont conservés.
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

// ============================================================
// Section : Modules actifs (personnalisation de la nav)
// ============================================================

function ModulesSection() {
  const { toast } = useToast()
  const { modules, loading, save } = useModules()
  const [saving, setSaving] = React.useState(false)

  const toggle = async (id: ModuleId, active: boolean) => {
    const next = active ? [...modules, id] : modules.filter((m) => m !== id)
    // Empêcher de tout désactiver : au moins un module doit rester
    if (next.length === 0) {
      toast({ title: "Au moins un module doit rester actif", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      await save(next)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5 text-emerald-600" />
          Modules actifs
        </CardTitle>
        <CardDescription>
          Choisissez les modules à afficher dans votre navigation. Les modules désactivés restent accessibles par URL directe mais ne s'affichent plus dans la barre de navigation.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {MODULE_IDS.map((id) => {
          const def = MODULES[id]
          const active = modules.includes(id)
          return (
            <div
              key={id}
              className="flex items-center justify-between gap-4 p-3 border rounded-lg hover:bg-slate-50/50 transition-colors"
            >
              <div className="flex-1 min-w-0">
                <Label htmlFor={`module-${id}`} className="font-medium text-sm cursor-pointer">
                  {def.label}
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">{def.description}</p>
              </div>
              <Switch
                id={`module-${id}`}
                checked={active}
                disabled={loading || saving}
                onCheckedChange={(checked) => toggle(id, checked)}
              />
            </div>
          )
        })}
        <p className="text-xs text-muted-foreground italic pt-2">
          💡 Astuce : un changement est visible immédiatement après rechargement de la page.
        </p>
      </CardContent>
    </Card>
  )
}

// ============================================================
// Section : Changement de mot de passe (self-service)
// ============================================================

function ChangePasswordSection() {
  const { toast } = useToast()
  const [currentPassword, setCurrentPassword] = React.useState("")
  const [newPassword, setNewPassword] = React.useState("")
  const [confirmPassword, setConfirmPassword] = React.useState("")
  const [showCurrent, setShowCurrent] = React.useState(false)
  const [showNew, setShowNew] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) {
      toast({ variant: "destructive", title: "Confirmation différente du nouveau mot de passe" })
      return
    }
    if (newPassword.length < 12) {
      toast({ variant: "destructive", title: "Au moins 12 caractères requis" })
      return
    }
    setSubmitting(true)
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast({
          variant: "destructive",
          title: data.error || "Erreur lors du changement",
        })
        return
      }
      toast({ title: "Mot de passe modifié ✓" })
      setCurrentPassword("")
      setNewPassword("")
      setConfirmPassword("")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Key className="h-5 w-5" />
          Sécurité — Mot de passe
        </CardTitle>
        <CardDescription>
          Changez votre mot de passe. Minimum 12 caractères, différent de l'actuel.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-3 max-w-md">
          <div>
            <Label htmlFor="cp-current">Mot de passe actuel</Label>
            <div className="flex gap-2">
              <Input
                id="cp-current"
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowCurrent((v) => !v)}
              >
                {showCurrent ? "Cacher" : "Voir"}
              </Button>
            </div>
          </div>
          <div>
            <Label htmlFor="cp-new">Nouveau mot de passe</Label>
            <div className="flex gap-2">
              <Input
                id="cp-new"
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                minLength={12}
                required
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowNew((v) => !v)}
              >
                {showNew ? "Cacher" : "Voir"}
              </Button>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              {newPassword.length}/12 caractères minimum
            </p>
          </div>
          <div>
            <Label htmlFor="cp-confirm">Confirmer le nouveau mot de passe</Label>
            <Input
              id="cp-confirm"
              type={showNew ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
            {confirmPassword && newPassword !== confirmPassword && (
              <p className="text-[11px] text-red-600 mt-1">
                Les mots de passe ne correspondent pas
              </p>
            )}
          </div>
          <Button
            type="submit"
            disabled={
              submitting ||
              !currentPassword ||
              !newPassword ||
              newPassword !== confirmPassword ||
              newPassword.length < 12
            }
          >
            {submitting ? "Mise à jour..." : "Changer le mot de passe"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
