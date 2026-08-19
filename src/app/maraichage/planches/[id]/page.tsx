/**
 * Page detail d'une planche
 */

'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { PlancheHistory, RotationAdvice } from '@/components/planche'
import { PlancheInfoTable } from '@/components/planches/PlancheInfoTable'
import { alertDialog } from '@/lib/global-dialog'
import { etapeCycleRotation } from '@/lib/rotation/etape-cycle'

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
  /**
   * QA cmswy9fyr — année de départ du cycle de rotation. Elle décide de la PHASE
   * de la planche : deux planches sur la même rotation peuvent être à des étapes
   * différentes, ce qui est le principe même d'un étalement. Le libellé « Année
   * rotation » ne le disait pas, et laissée vide la phase retombe sur un ancrage
   * arbitraire (epoch fixe, cf. getCulturesPrevues) sans que rien ne l'indique.
   */
  annee: number | null
  rotationId: string | null
  /** Renvoyée par l'API avec ses étapes (cf. GET /api/planches/[id]). */
  rotation: {
    id: string
    nbAnnees: number | null
    details: { annee: number; itpId: string | null }[]
  } | null
  typeSol: string | null
  retentionEau: string | null
  parcelleGeoId: string | null
  parcelleGeo: { id: string; nom: string; surface: number | null; centroidLat: number | null; centroidLng: number | null } | null
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
        <div className="text-center text-slate-500">Chargement...</div>
      </div>
    )
  }

  if (error || !planche) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <p className="text-red-500">{error || 'Planche non trouvée'}</p>
          <Link href="/maraichage/planches" className="mt-4 text-blue-600 hover:underline">
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
              href="/maraichage/planches"
              className="text-slate-500 hover:text-slate-700"
            >
              Planches
            </Link>
            <span className="text-slate-400">/</span>
            <span className="font-medium text-slate-900">{planche.nom || planche.id}</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            {planche.nom || `Planche ${planche.id}`}
          </h1>
        </div>
        <div className="flex gap-2">
          <Link
            href={`/maraichage/cultures/new?plancheId=${encodeURIComponent(planche.id)}`}
            className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
          >
            + Nouvelle culture
          </Link>
          <button
            onClick={() => router.push('/maraichage/planches')}
            className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Retour
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`border-b-2 px-1 py-4 text-sm font-medium ${
                activeTab === tab.id
                  ? 'border-green-500 text-green-600'
                  : 'border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-700'
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
          <PlancheInfoTable
            planche={planche}
            onUpdate={fetchPlanche}
            // L'URL de la fiche accepte l'identifiant : après un renommage, on
            // s'y recale pour ne plus dépendre du libellé (cf. conventions).
            onRenamed={() => router.replace(`/maraichage/planches/${encodeURIComponent(planche.id)}`)}
          />
        )}
        {activeTab === 'history' && <PlancheHistory plancheId={planche.id} />}
        {activeTab === 'rotation' && (
          <div className="space-y-6">
            <RotationAncrage planche={planche} />
            <RotationAdvice plancheId={planche.id} />
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * Rotation affectée à la planche, position dans le cycle et ancrage.
 *
 * Ticket cmsx6348h (QA 2026-08-17) : l'onglet nommé « Rotation » n'affichait
 * que l'état du sol et les conseils de succession. Ni la rotation affectée, ni
 * l'année de départ du cycle — qui décide pourtant de la phase de la planche —
 * n'y figuraient. Deux planches de la même rotation suivant des successions
 * différentes restaient donc inexplicables depuis cet onglet, alors que la
 * cause (une planche sans année de départ retombe sur un ancrage arbitraire)
 * est lisible et corrigeable.
 */
function RotationAncrage({ planche }: { planche: Planche }) {
  if (!planche.rotationId) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <p className="text-sm font-medium text-slate-700">Aucune rotation affectée</p>
        <p className="mt-1 text-sm text-slate-500">
          Les conseils ci-dessous reposent alors uniquement sur l&apos;historique des cultures de
          la planche. Affectez une rotation depuis l&apos;onglet Informations pour planifier une
          succession.
        </p>
      </div>
    )
  }

  const nbAnnees = planche.rotation?.nbAnnees || planche.rotation?.details.length || 0
  const anneeCourante = new Date().getFullYear()
  const etape = nbAnnees ? etapeCycleRotation(anneeCourante, planche.annee, nbAnnees) : null
  const itpEtape = planche.rotation?.details.find((d) => d.annee === etape)?.itpId ?? null

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Rotation affectée</p>
          <p className="text-base font-semibold text-slate-900">{planche.rotationId}</p>
        </div>
        {etape !== null && (
          <p className="text-sm text-slate-700">
            étape <span className="font-semibold">{etape}</span>/{nbAnnees} en {anneeCourante}
            {itpEtape ? <span className="text-slate-500"> · {itpEtape}</span> : null}
          </p>
        )}
      </div>
      <p className="mt-3 text-sm text-slate-600">
        Départ du cycle :{' '}
        {planche.annee ? (
          <span className="font-medium text-slate-900">
            {planche.annee} (étape 1 cette année-là)
          </span>
        ) : (
          <span className="font-medium text-amber-700">
            non défini — la phase du cycle est arbitraire
          </span>
        )}
      </p>
      {!planche.annee && (
        <p className="mt-1 text-sm text-amber-700">
          Renseignez « Année de départ du cycle de rotation » dans l&apos;onglet Informations pour
          décider à quelle étape cette planche démarre. Sans elle, deux planches de la même
          rotation suivent des successions décalées sans raison lisible.
        </p>
      )}
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
      await alertDialog(err instanceof Error ? err.message : 'Erreur inconnue')
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
      <div className="rounded-lg border border-slate-200 bg-white p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Modifier les informations</h3>
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              disabled={saving}
              className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
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
            <label className="block text-sm font-medium text-slate-700">Identifiant</label>
            <input
              type="text"
              value={planche.id}
              disabled
              className="mt-1 block w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Nom</label>
            <input
              type="text"
              name="nom"
              value={formData.nom}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Ilot</label>
            <input
              type="text"
              name="ilot"
              value={formData.ilot}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Type</label>
            <select
              name="type"
              value={formData.type}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500"
            >
              <option value="">-</option>
              {PLANCHE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Irrigation</label>
            <select
              name="irrigation"
              value={formData.irrigation}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500"
            >
              <option value="">-</option>
              {PLANCHE_IRRIGATION.map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Type de sol</label>
            <select
              name="typeSol"
              value={formData.typeSol}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500"
            >
              <option value="">Non renseigné</option>
              {TYPES_SOL.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Rétention eau</label>
            <select
              name="retentionEau"
              value={formData.retentionEau}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500"
            >
              <option value="">Non renseigné</option>
              {RETENTION_EAU.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Année de départ du cycle de rotation
            </label>
            <input
              type="number"
              name="annee"
              min="2000"
              max="2100"
              value={formData.annee}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500"
            />
            <p className="mt-1 text-xs text-slate-500">
              Année où cette planche est à l&apos;étape 1 de sa rotation. C&apos;est elle qui décale le
              cycle d&apos;une planche à l&apos;autre. Laissée vide, la phase est arbitraire.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Orientation</label>
            <select
              name="orientation"
              value={formData.orientation}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500"
            >
              <option value="">-</option>
              <option value="N-S">Nord-Sud</option>
              <option value="E-O">Est-Ouest</option>
              <option value="NE-SO">Nord-Est / Sud-Ouest</option>
              <option value="NO-SE">Nord-Ouest / Sud-Est</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Largeur (m)</label>
            <input
              type="number"
              name="largeur"
              step="0.01"
              value={formData.largeur}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Longueur (m)</label>
            <input
              type="number"
              name="longueur"
              step="0.1"
              value={formData.longueur}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Surface calculée (m²)</label>
            <input
              type="text"
              value={calculatedSurface}
              disabled
              className="mt-1 block w-full rounded-md border border-slate-300 bg-slate-100 px-3 py-2 text-sm text-slate-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Rotation 2D (°)</label>
            <input
              type="number"
              name="rotation2D"
              step="1"
              value={formData.rotation2D}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Position X</label>
            <input
              type="number"
              name="posX"
              step="0.1"
              value={formData.posX}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">Position Y</label>
            <input
              type="number"
              name="posY"
              step="0.1"
              value={formData.posY}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500"
            />
          </div>
        </div>

        <div className="mt-4">
          <label className="block text-sm font-medium text-slate-700">Notes</label>
          <textarea
            name="notes"
            rows={3}
            value={formData.notes}
            onChange={handleChange}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-green-500 focus:ring-green-500"
          />
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-6">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-slate-900">Informations générales</h3>
        <button
          onClick={() => setIsEditing(true)}
          className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
        >
          <Pencil className="h-4 w-4" />
          Modifier
        </button>
      </div>
      <dl className="grid grid-cols-2 gap-4">
        <div>
          <dt className="text-sm font-medium text-slate-500">Identifiant</dt>
          <dd className="mt-1 text-sm text-slate-900">{planche.id}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Nom</dt>
          <dd className="mt-1 text-sm text-slate-900">{planche.nom || '-'}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Ilot</dt>
          <dd className="mt-1 text-sm text-slate-900">{planche.ilot || '-'}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Type</dt>
          <dd className="mt-1 text-sm text-slate-900">{planche.type || '-'}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Irrigation</dt>
          <dd className="mt-1 text-sm text-slate-900">{planche.irrigation || '-'}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Départ du cycle de rotation</dt>
          <dd className="mt-1 text-sm text-slate-900">
            {planche.annee ? (
              <>
                {planche.annee} <span className="text-slate-500">(étape 1 cette année-là)</span>
              </>
            ) : planche.rotationId ? (
              <span className="text-amber-700">
                non défini — la phase du cycle est arbitraire
              </span>
            ) : (
              '-'
            )}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Orientation</dt>
          <dd className="mt-1 text-sm text-slate-900">{planche.orientation || '-'}</dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Largeur</dt>
          <dd className="mt-1 text-sm text-slate-900">
            {planche.largeur !== null ? `${planche.largeur} m` : '-'}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Longueur</dt>
          <dd className="mt-1 text-sm text-slate-900">
            {planche.longueur !== null ? `${planche.longueur} m` : '-'}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Surface</dt>
          <dd className="mt-1 text-sm text-slate-900">
            {planche.surface !== null ? `${planche.surface} m²` : '-'}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Rotation 2D</dt>
          <dd className="mt-1 text-sm text-slate-900">
            {planche.rotation2D !== null ? `${planche.rotation2D}°` : '0°'}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Position X</dt>
          <dd className="mt-1 text-sm text-slate-900">
            {planche.posX !== null ? planche.posX : '-'}
          </dd>
        </div>
        <div>
          <dt className="text-sm font-medium text-slate-500">Position Y</dt>
          <dd className="mt-1 text-sm text-slate-900">
            {planche.posY !== null ? planche.posY : '-'}
          </dd>
        </div>
      </dl>
      {planche.notes && (
        <div className="mt-4">
          <dt className="text-sm font-medium text-slate-500">Notes</dt>
          <dd className="mt-1 whitespace-pre-wrap text-sm text-slate-900">{planche.notes}</dd>
        </div>
      )}
    </div>
  )
} */
