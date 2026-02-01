/**
 * Page détail d'une planche
 */

'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PlancheHistory, RotationAdvice } from '@/components/planche'
import { PlancheInfoTable } from '@/components/planches/PlancheInfoTable'

interface Planche {
  id: string
  nom: string | null
  ilot: string | null
  surface: number | null
  largeur: number | null
  longueur: number | null
  orientation: string | null
  posX: number | null
  posY: number | null
  rotation2D: number | null
  notes: string | null
  type: string | null
  irrigation: string | null
  annee: number | null
  typeSol: string | null
  retentionEau: string | null
}

const PLANCHE_TYPES = ['Serre', 'Plein champ', 'Tunnel', 'Chassis']
const PLANCHE_IRRIGATION = ['Goutte-a-goutte', 'Aspersion', 'Manuel', 'Aucun']
const TYPES_SOL = ['Argileux', 'Limoneux', 'Sableux', 'Mixte']
const RETENTION_EAU = ['Faible', 'Moyenne', 'Élevée']

interface PageProps {
  params: Promise<{ id: string }>
}

export default function PlancheDetailPage({ params }: PageProps) {
  const { id } = use(params)
  const plancheId = decodeURIComponent(id)
  const router = useRouter()

  const [planche, setPlanche] = useState<Planche | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'info' | 'history' | 'rotation'>('info')

  const fetchPlanche = async () => {
    try {
      setLoading(true)
      const res = await fetch(`/api/planches/${encodeURIComponent(plancheId)}`)
      if (!res.ok) {
        if (res.status === 404) {
          setError('Planche non trouvée')
        } else {
          throw new Error('Erreur lors du chargement')
        }
        return
      }
      const data = await res.json()
      setPlanche(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPlanche()
  }, [plancheId])

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-gray-500">Chargement...</div>
      </div>
    )
  }

  if (error || !planche) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <p className="text-red-500">{error || 'Planche non trouvée'}</p>
          <Link href="/planches" className="mt-4 text-blue-600 hover:underline">
            Retour à la liste
          </Link>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'info' as const, label: 'Informations' },
    { id: 'history' as const, label: 'Historique' },
    { id: 'rotation' as const, label: 'Rotation' },
  ]

  return (
    <div className="container mx-auto p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Link
              href="/planches"
              className="text-gray-500 hover:text-gray-700"
            >
              Planches
            </Link>
            <span className="text-gray-400">/</span>
            <span className="font-medium text-gray-900">{planche.nom || planche.id}</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-gray-900">
            {planche.nom || `Planche ${planche.id}`}
          </h1>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/cultures/new?plancheId=${encodeURIComponent(planche.id)}`}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            + Nouvelle culture
          </Link>
          <button
            onClick={() => router.push('/planches')}
            className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Retour
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 px-1 py-4 text-sm font-medium ${
                activeTab === tab.id
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      <div className="mt-6">
        {activeTab === 'info' && (
          <PlancheInfoTable planche={planche} onUpdate={fetchPlanche} />
        )}
        {activeTab === 'history' && <PlancheHistory plancheId={planche.id} />}
        {activeTab === 'rotation' && <RotationAdvice plancheId={planche.id} />}
      </div>
    </div>
  )
}

// ===== Ancien composant PlancheInfo supprimé - remplacé par PlancheInfoTable =====
/* function PlancheInfo({ planche, onUpdate }: PlancheInfoProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formData, setFormData] = useState({
    nom: planche.nom || '',
    ilot: planche.ilot || '',
    largeur: planche.largeur?.toString() || '',
    longueur: planche.longueur?.toString() || '',
    orientation: planche.orientation || '',
    posX: planche.posX?.toString() || '',
    posY: planche.posY?.toString() || '',
    rotation2D: planche.rotation2D?.toString() || '0',
    notes: planche.notes || '',
    type: planche.type || '',
    irrigation: planche.irrigation || '',
    annee: planche.annee?.toString() || '',
    typeSol: planche.typeSol || '',
    retentionEau: planche.retentionEau || '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const body = {
        nom: formData.nom || null,
        ilot: formData.ilot || null,
        largeur: formData.largeur ? parseFloat(formData.largeur) : null,
        longueur: formData.longueur ? parseFloat(formData.longueur) : null,
        orientation: formData.orientation || null,
        posX: formData.posX ? parseFloat(formData.posX) : null,
        posY: formData.posY ? parseFloat(formData.posY) : null,
        rotation2D: formData.rotation2D ? parseFloat(formData.rotation2D) : 0,
        notes: formData.notes || null,
        type: formData.type || null,
        irrigation: formData.irrigation || null,
        annee: formData.annee ? parseInt(formData.annee) : null,
        typeSol: formData.typeSol || null,
        retentionEau: formData.retentionEau || null,
      }

      const res = await fetch(`/api/planches/${encodeURIComponent(planche.id)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })

      if (!res.ok) {
        throw new Error('Erreur lors de la sauvegarde')
      }

      setIsEditing(false)
      onUpdate()
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur inconnue')
    } finally {
      setSaving(false)
    }
  }

  const handleCancel = () => {
    setFormData({
      nom: planche.nom || '',
      ilot: planche.ilot || '',
      largeur: planche.largeur?.toString() || '',
      longueur: planche.longueur?.toString() || '',
      orientation: planche.orientation || '',
      posX: planche.posX?.toString() || '',
      posY: planche.posY?.toString() || '',
      rotation2D: planche.rotation2D?.toString() || '0',
      notes: planche.notes || '',
      type: planche.type || '',
      irrigation: planche.irrigation || '',
      annee: planche.annee?.toString() || '',
      typeSol: planche.typeSol || '',
      retentionEau: planche.retentionEau || '',
    })
    setIsEditing(false)
  }

  // Calcul surface automatique
  const calculatedSurface =
    formData.largeur && formData.longueur
      ? (parseFloat(formData.largeur) * parseFloat(formData.longueur)).toFixed(2)
      : planche.surface?.toFixed(2) || '-'

  if (isEditing) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">Modifier les informations</h3>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              disabled={saving}
              className="flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <X className="h-4 w-4" />
              Annuler
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-1 rounded-md bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
            >
              <Save className="h-4 w-4" />
              {saving ? 'Enregistrement...' : 'Enregistrer'}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Identifiant</label>
            <input
              type="text"
              value={planche.id}
              disabled
              className="mt-1 block w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Nom</label>
            <input
              type="text"
              name="nom"
              value={formData.nom}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Ilot</label>
            <input
              type="text"
              name="ilot"
              value={formData.ilot}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Type</label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500"
            >
              <option value="">-</option>
              {PLANCHE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Irrigation</label>
            <select
              name="irrigation"
              value={formData.irrigation}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500"
            >
              <option value="">-</option>
              {PLANCHE_IRRIGATION.map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Type de sol</label>
            <select
              name="typeSol"
              value={formData.typeSol}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500"
            >
              <option value="">Non renseigné</option>
              {TYPES_SOL.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Rétention eau</label>
            <select
              name="retentionEau"
              value={formData.retentionEau}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500"
            >
              <option value="">Non renseigné</option>
              {RETENTION_EAU.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Annee rotation</label>
            <input
              type="number"
              name="annee"
              min="2000"
              max="2100"
              value={formData.annee}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Orientation</label>
            <select
              name="orientation"
              value={formData.orientation}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500"
            >
              <option value="">-</option>
              <option value="N-S">Nord-Sud</option>
              <option value="E-O">Est-Ouest</option>
              <option value="NE-SO">Nord-Est / Sud-Ouest</option>
              <option value="NO-SE">Nord-Ouest / Sud-Est</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Largeur (m)</label>
            <input
              type="number"
              name="largeur"
              step="0.01"
              value={formData.largeur}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Longueur (m)</label>
            <input
              type="number"
              name="longueur"
              step="0.1"
              value={formData.longueur}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Surface calculée (m²)</label>
            <input
              type="text"
              value={calculatedSurface}
              disabled
              className="mt-1 block w-full rounded-md border border-gray-300 bg-gray-100 px-3 py-2 text-sm text-gray-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Rotation 2D (°)</label>
            <input
              type="number"
              name="rotation2D"
              step="1"
              value={formData.rotation2D}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Position X</label>
            <input
              type="number"
              name="posX"
              step="0.1"
              value={formData.posX}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">Position Y</label>
            <input
              type="number"
              name="posY"
              step="0.1"
              value={formData.posY}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700">Notes</label>
          <textarea
            name="notes"
            rows={3}
            value={formData.notes}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-gray-900">Informations générales</h3>
        <button
          onClick={() => setIsEditing(true)}
          className="flex items-center gap-1 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          <Pencil className="h-4 w-4" />
          Modifier
        </button>
      </div>
      <dl className="grid grid-cols-2 gap-4">
        <div>
          <dt className="text-sm font-medium text-gray-500">Identifiant</dt>
          <dd className="mt-1 text-sm text-gray-900">{planche.id}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">Nom</dt>
          <dd className="mt-1 text-sm text-gray-900">{planche.nom || '-'}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">Ilot</dt>
          <dd className="mt-1 text-sm text-gray-900">{planche.ilot || '-'}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">Type</dt>
          <dd className="mt-1 text-sm text-gray-900">{planche.type || '-'}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">Irrigation</dt>
          <dd className="mt-1 text-sm text-gray-900">{planche.irrigation || '-'}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">Annee rotation</dt>
          <dd className="mt-1 text-sm text-gray-900">{planche.annee || '-'}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">Orientation</dt>
          <dd className="mt-1 text-sm text-gray-900">{planche.orientation || '-'}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">Largeur</dt>
          <dd className="mt-1 text-sm text-gray-900">
            {planche.largeur !== null ? `${planche.largeur} m` : '-'}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">Longueur</dt>
          <dd className="mt-1 text-sm text-gray-900">
            {planche.longueur !== null ? `${planche.longueur} m` : '-'}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">Surface</dt>
          <dd className="mt-1 text-sm text-gray-900">
            {planche.surface !== null ? `${planche.surface} m²` : '-'}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">Rotation 2D</dt>
          <dd className="mt-1 text-sm text-gray-900">
            {planche.rotation2D !== null ? `${planche.rotation2D}°` : '0°'}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">Position X</dt>
          <dd className="mt-1 text-sm text-gray-900">
            {planche.posX !== null ? planche.posX : '-'}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-gray-500">Position Y</dt>
          <dd className="mt-1 text-sm text-gray-900">
            {planche.posY !== null ? planche.posY : '-'}
          </dd>
        </div>
      </dl>
      {planche.notes && (
        <div className="mt-4">
          <dt className="text-sm font-medium text-gray-500">Notes</dt>
          <dd className="mt-1 whitespace-pre-wrap text-sm text-gray-900">{planche.notes}</dd>
        </div>
      )}
    </div>
  )
} */
