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
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { StationMeteoConfig } from '@/components/meteo'
import { useToast } from '@/hooks/use-toast'
import { useModules } from '@/hooks/use-modules'
import { MODULES, MODULE_IDS, type ModuleId } from '@/lib/modules'
import { confirmDialog } from '@/lib/global-dialog'
import { todayLocalISO } from '@/lib/format-utils'

// Clé localStorage pour les parametres
const SETTINGS_KEY = 'gleba_settings'
// BUG #10 (QA Camille 2026-05-15) — la clé serveur où on persiste les
// settings du plan jardin via /api/user/preferences (UserPreference).
const SETTINGS_PREF_KEY = 'gardenSettings'

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
  // BUG #10 : indicateur de synchronisation serveur. `null` = pas encore
  // tenté, `true` = dernière save serveur OK, `false` = échec serveur
  // (localStorage seul). `lastSyncedAt` = horodatage dernier OK.
  const [serverSynced, setServerSynced] = React.useState<boolean | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = React.useState<Date | null>(null)
  const [exporting, setExporting] = React.useState(false)
  const [importing, setImporting] = React.useState(false)
  const [deleting, setDeleting] = React.useState(false)
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false)
  const [deleteConfirmation, setDeleteConfirmation] = React.useState('')
  // MCP / API Token
  const [mcpLoading, setMcpLoading] = React.useState(false)
  const [mcpToken, setMcpToken] = React.useState<string | null>(null)
  const [mcpMaskedToken, setMcpMaskedToken] = React.useState<string | null>(null)
  const [mcpHasToken, setMcpHasToken] = React.useState(false)
  const [mcpCopied, setMcpCopied] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const fullFileInputRef = React.useRef<HTMLInputElement>(null)
  const [exportingFull, setExportingFull] = React.useState(false)
  const [importingFull, setImportingFull] = React.useState(false)

  // Charger les paramètres au montage.
  // BUG #10 : on essaie d'abord le serveur (`/api/user/preferences`) ; si
  // une préférence `gardenSettings` y est présente, on l'utilise et on
  // synchronise localStorage. Sinon fallback sur localStorage (offline /
  // user qui n'a jamais sauvegardé).
  React.useEffect(() => {
    let cancelled = false
    const hydrate = async () => {
      // 1. fallback immédiat localStorage pour ne pas afficher les defaults
      const stored = localStorage.getItem(SETTINGS_KEY)
      if (stored) {
        try {
          const parsed = JSON.parse(stored)
          setSettings({ ...defaultSettings, ...parsed })
        } catch {
          // ignore
        }
      }
      // 2. tentative serveur
      try {
        const res = await fetch('/api/user/preferences')
        if (!res.ok) return
        const prefs = await res.json()
        const remote = prefs?.[SETTINGS_PREF_KEY]
        if (remote && typeof remote === 'object' && !cancelled) {
          const merged = { ...defaultSettings, ...remote }
          setSettings(merged)
          localStorage.setItem(SETTINGS_KEY, JSON.stringify(merged))
          setServerSynced(true)
          setLastSyncedAt(new Date())
        }
      } catch {
        // offline : on garde localStorage
        if (!cancelled) setServerSynced(false)
      }
    }
    hydrate()
    return () => { cancelled = true }
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
    if (mcpHasToken && !(await confirmDialog('Un token existe déjà. Le régénérer va invalider le précédent. Continuer ?'))) return
    setMcpLoading(true)
    try {
      const res = await fetch('/api/user/api-token', { method: 'POST' })
      const data = await res.json().catch(() => null)
      if (res.ok && data?.token) {
        setMcpToken(data.token)
        setMcpHasToken(true)
        setMcpMaskedToken(null)
        toast({ title: 'Token généré', description: 'Copiez-le maintenant, il ne sera plus affiché en clair.' })
      } else {
        // Audit #88 : sans ce cas, un échec serveur (sans token) ne montrait rien.
        toast({ variant: 'destructive', title: 'Erreur', description: data?.error || 'Le token n\'a pas pu être généré' })
      }
    } catch {
      toast({ variant: 'destructive', title: 'Erreur', description: 'Impossible de générer le token' })
    } finally {
      setMcpLoading(false)
    }
  }

  const handleRevokeToken = async () => {
    if (!(await confirmDialog('Révoquer le token ? Les connexions MCP existantes seront coupées.'))) return
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

  const handleSave = async () => {
    setSaving(true)
    // BUG #10 : on écrit localStorage SYNCHRONIQUEMENT (UX immédiate) puis
    // on POST au serveur. Si le POST échoue, on prévient l'utilisateur que
    // la valeur n'est que locale (perdue au changement de navigateur).
    let localOk = false
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
      localOk = true
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erreur localStorage',
        description: "Impossible d'écrire dans le stockage local (mode privé ?)",
      })
    }
    try {
      const res = await fetch('/api/user/preferences', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [SETTINGS_PREF_KEY]: settings }),
      })
      if (res.ok) {
        setServerSynced(true)
        setLastSyncedAt(new Date())
        toast({
          title: 'Paramètres enregistrés',
          description: 'Vos préférences ont été sauvegardées sur le serveur.',
        })
      } else {
        setServerSynced(false)
        toast({
          variant: 'destructive',
          title: localOk ? 'Sauvegarde locale seule' : 'Erreur',
          description: `Le serveur a refusé (HTTP ${res.status}). ${localOk ? 'Les préférences restent dans ce navigateur uniquement.' : ''}`,
        })
      }
    } catch (err) {
      setServerSynced(false)
      toast({
        variant: 'destructive',
        title: localOk ? 'Sauvegarde locale seule' : 'Erreur',
        description: localOk
          ? 'Sauvegarde serveur indisponible (offline ?). Préférences locales uniquement.'
          : err instanceof Error ? err.message : 'Erreur réseau',
      })
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (await confirmDialog('Réinitialiser tous les paramètres aux valeurs par défaut ?')) {
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
      a.download = `gleba_export_${todayLocalISO()}.${format === 'json' ? 'json' : 'zip'}`
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

  // Sauvegarde COMPLÈTE du compte (toutes données + référentiels) — migration
  const handleExportFull = async () => {
    setExportingFull(true)
    try {
      const response = await fetch('/api/account/export')
      if (!response.ok) throw new Error('Erreur export')
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `gleba_sauvegarde_complete_${todayLocalISO()}.json`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
      toast({
        title: 'Sauvegarde complète téléchargée',
        description: 'Conservez ce fichier précieusement. Il contient toutes vos données.',
      })
    } catch {
      toast({
        variant: 'destructive',
        title: 'Erreur',
        description: 'Impossible de générer la sauvegarde complète',
      })
    } finally {
      setExportingFull(false)
    }
  }

  const handleFullImportClick = () => {
    fullFileInputRef.current?.click()
  }

  const handleFullFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const ok = await confirmDialog(
      'Restaurer une sauvegarde complète ?\n\n' +
        'Recommandé sur un compte VIERGE (instance fraîchement installée). ' +
        "Sur un compte déjà rempli, l'import est annulé pour éviter tout conflit — " +
        'aucune donnée existante ne sera modifiée.\n\nContinuer ?'
    )
    if (!ok) {
      if (fullFileInputRef.current) fullFileInputRef.current.value = ''
      return
    }

    setImportingFull(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const response = await fetch('/api/account/import', {
        method: 'POST',
        body: formData,
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Erreur import')

      const warn = Array.isArray(result.warnings) && result.warnings.length
        ? ` (${result.warnings.length} avertissement${result.warnings.length > 1 ? 's' : ''})`
        : ''
      toast({
        title: 'Restauration réussie',
        description: (result.message || 'Données restaurées') + warn,
      })
    } catch (err) {
      toast({
        variant: 'destructive',
        title: 'Échec de la restauration',
        description: err instanceof Error ? err.message : 'Impossible de restaurer la sauvegarde',
      })
    } finally {
      setImportingFull(false)
      if (fullFileInputRef.current) fullFileInputRef.current.value = ''
    }
  }

  // Suppression de toutes les données utilisateur
  const handleDeleteAllData = async () => {
    if (deleteConfirmation !== 'SUPPRIMER') {
      toast({
        title: 'Confirmation requise',
        description: 'Tapez SUPPRIMER en majuscules pour confirmer.',
        variant: 'destructive',
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
      setDeleteDialogOpen(false)

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

        {/* Bug cmp8snsxp (Marc 2026-05-16) — feature request multi-user/
            devise/unités. En attendant l'implémentation complète, on
            communique clairement que la roadmap est prévue, pour ne pas
            laisser le chef d'exploitation deviner. */}
        <Card>
          <CardHeader>
            <CardTitle>Équipe, devise et unités</CardTitle>
            <CardDescription>
              Configuration multi-utilisateurs, devise et système d&apos;unités
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
              <p className="text-sm text-amber-900 font-medium mb-2">
                À venir — feature sur la roadmap
              </p>
              <ul className="text-xs text-amber-800 space-y-1 list-disc pl-4">
                <li>
                  <strong>Multi-utilisateurs</strong> : invitez votre équipe
                  (employé, saisonnier, comptable) avec rôles et droits par
                  module — Q3 2026.
                </li>
                <li>
                  <strong>Devise</strong> : EUR par défaut ; CHF, USD à la
                  demande. Contactez-nous si besoin urgent.
                </li>
                <li>
                  <strong>Unités</strong> : système métrique (kg, m) ; système
                  impérial (lb, ft) à venir pour les utilisateurs hors-Europe.
                </li>
              </ul>
              <p className="text-xs text-amber-700 mt-3">
                Vous pouvez nous signaler vos besoins via le bouton « Feedback »
                en bas à droite ; chaque demande remonte directement à l&apos;équipe.
              </p>
            </div>
          </CardContent>
        </Card>

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
            <div className="flex flex-col gap-2 pt-4 border-t">
              <div className="flex justify-between">
                <Button variant="outline" onClick={handleReset}>
                  Réinitialiser
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  <Save className="h-4 w-4 mr-2" />
                  {saving ? 'Enregistrement...' : 'Enregistrer'}
                </Button>
              </div>
              {/* BUG #10 : indicateur de synchronisation serveur */}
              {serverSynced === true && lastSyncedAt && (
                <p className="text-xs text-emerald-600 text-right">
                  ✓ Synchronisé sur le serveur ({lastSyncedAt.toLocaleTimeString('fr-FR')})
                </p>
              )}
              {serverSynced === false && (
                <p className="text-xs text-amber-600 text-right">
                  ⚠️ Préférences locales uniquement (perdues si vous changez de navigateur)
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Image de fond — gérée depuis l'éditeur 2D (persistance serveur) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ImageIcon className="h-5 w-5" />
              Image de fond (satellite)
            </CardTitle>
            <CardDescription>
              L&apos;image satellite ou photo de drone se gère désormais directement sur le plan du
              jardin (bouton « Fond ») : import, opacité, rotation et calibration de l&apos;échelle en
              2 clics. Elle est enregistrée sur votre compte et synchronisée entre vos appareils.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/jardin">
              <Button variant="outline">
                <ImageIcon className="h-4 w-4 mr-2" />
                Ouvrir le plan du jardin
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Sauvegarde complète & migration */}
        <Card>
          <CardHeader>
            <CardTitle>Sauvegarde & portabilité</CardTitle>
            <CardDescription>
              Emportez toutes vos données où vous voulez. Idéal pour migrer vers votre
              propre serveur (Raspberry Pi, NAS…).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              {/* Sauvegarde complète */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-slate-900">Sauvegarde complète</h4>
                <p className="text-sm text-slate-500">
                  Un seul fichier avec <strong>toutes</strong> vos données : potager, verger,
                  élevage, comptabilité, stocks, préférences. Vos données vous appartiennent.
                </p>
                <Button onClick={handleExportFull} disabled={exportingFull}>
                  {exportingFull ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  {exportingFull ? 'Préparation…' : 'Télécharger ma sauvegarde'}
                </Button>
              </div>

              {/* Restauration / migration */}
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-slate-900">Restaurer / migrer</h4>
                <p className="text-sm text-slate-500">
                  Importez une sauvegarde complète sur cette instance. À faire sur un
                  compte <strong>vierge</strong> (ex. votre nouvelle installation).
                </p>
                <input
                  ref={fullFileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFullFileChange}
                  className="hidden"
                />
                <Button variant="outline" onClick={handleFullImportClick} disabled={importingFull}>
                  {importingFull ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  {importingFull ? 'Restauration…' : 'Restaurer une sauvegarde'}
                </Button>
              </div>
            </div>

            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <p className="text-sm text-emerald-800">
                <strong>Migrer vers mon propre serveur :</strong> téléchargez votre sauvegarde
                ici, installez Gleba chez vous (voir la documentation d'auto-hébergement),
                créez votre compte sur la nouvelle instance, puis restaurez le fichier. Vous
                récupérez tout, sans repartir de zéro.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Export tabulaire (avancé) */}
        <Card>
          <CardHeader>
            <CardTitle>Export tabulaire (avancé)</CardTitle>
            <CardDescription>
              Pour tableur ou analyse. N'inclut que le module potager (planches, cultures,
              récoltes) — pour une vraie sauvegarde, utilisez « Sauvegarde complète » ci-dessus.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-slate-900">Exporter (partiel)</h4>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => handleExport('json')} disabled={exporting}>
                    {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                    JSON
                  </Button>
                  <Button variant="outline" onClick={() => handleExport('csv')} disabled={exporting}>
                    {exporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Download className="h-4 w-4 mr-2" />}
                    CSV
                  </Button>
                </div>
              </div>
              <div className="space-y-3">
                <h4 className="text-sm font-medium text-slate-900">Importer (partiel)</h4>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".json"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button variant="outline" onClick={handleImportClick} disabled={importing}>
                  {importing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                  {importing ? 'Import en cours...' : 'Importer JSON'}
                </Button>
              </div>
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
                  onClick={() => {
                    setDeleteConfirmation('')
                    setDeleteDialogOpen(true)
                  }}
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

      <Dialog open={deleteDialogOpen} onOpenChange={(nextOpen) => {
        if (!deleting) setDeleteDialogOpen(nextOpen)
      }}>
        <DialogContent className="max-h-[calc(100dvh-1rem)] overflow-y-auto sm:max-w-[460px]">
          <DialogHeader>
            <div className="mb-2 flex h-11 w-11 items-center justify-center rounded-xl bg-red-100">
              <Trash2 className="h-5 w-5 text-red-700" />
            </div>
            <DialogTitle>Supprimer toutes vos données ?</DialogTitle>
            <DialogDescription>Cette action est irréversible. Les référentiels Gleba seront conservés.</DialogDescription>
          </DialogHeader>
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
            <p className="font-medium">Seront définitivement supprimés :</p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-red-800">
              <li>Cultures, récoltes et irrigations</li>
              <li>Planches et fertilisations</li>
              <li>Arbres, objets du jardin et notes</li>
            </ul>
          </div>
          <div className="space-y-2">
            <Label htmlFor="delete-all-confirmation">Tapez <strong>SUPPRIMER</strong> pour confirmer</Label>
            <Input
              id="delete-all-confirmation"
              autoFocus
              autoComplete="off"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              className="h-11"
            />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)} disabled={deleting}>Conserver mes données</Button>
            <Button variant="destructive" onClick={handleDeleteAllData} disabled={deleting || deleteConfirmation !== 'SUPPRIMER'}>
              {deleting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Supprimer définitivement
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ============================================================
// Section : Modules actifs (personnalisation de la nav)
// ============================================================

function ModulesSection() {
  const { toast } = useToast()
  // BUG #10 — on lit `loading` pour ne PAS afficher les toggles tant que la
  // valeur serveur (`modulesActifs`) n'est pas arrivée : sinon ils restent
  // bloqués sur la valeur par défaut (tous ON) après un reload, désynchro de
  // la préférence réelle renvoyée par GET /api/user/preferences.
  const { modules, save, loading } = useModules()
  const [saving, setSaving] = React.useState(false)

  const toggle = async (id: ModuleId, active: boolean) => {
    // BUG #1 (QA Camille 2026-05-15) : on lit `modules` au moment du clic et
    // on garde la liste passée à `save()` cohérente — le hook fait
    // l'optimistic update immédiatement (le Switch se reflète à l'écran)
    // puis appelle l'API.
    const next = active ? [...modules, id] : modules.filter((m) => m !== id)
    // Empêcher de tout désactiver : au moins un module doit rester
    if (next.length === 0) {
      toast({ title: "Au moins un module doit rester actif", variant: "destructive" })
      return
    }
    setSaving(true)
    try {
      const result = await save(next)
      if (!result.ok) {
        toast({
          variant: "destructive",
          title: "Échec de la sauvegarde des préférences",
          description: result.error || "Le changement a été annulé. Vérifiez votre connexion.",
        })
      }
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
        {loading ? (
          // Tant que la préférence serveur n'est pas chargée, on n'affiche pas
          // l'état des toggles (évite le faux "tout ON" du défaut).
          MODULE_IDS.map((id) => (
            <div
              key={id}
              className="flex items-center justify-between gap-4 p-3 border rounded-lg animate-pulse"
            >
              <div className="flex-1 min-w-0 space-y-2">
                <div className="h-4 w-32 bg-slate-200 rounded" />
                <div className="h-3 w-48 bg-slate-100 rounded" />
              </div>
              <div className="h-5 w-9 bg-slate-200 rounded-full" />
            </div>
          ))
        ) : MODULE_IDS.map((id) => {
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
                disabled={saving}
                onCheckedChange={(checked) => toggle(id, checked)}
                data-testid={`module-toggle-${id}`}
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
