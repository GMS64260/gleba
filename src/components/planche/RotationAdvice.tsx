/**
 * Composant d'affichage des conseils de rotation
 */

'use client'

import { useState, useEffect } from 'react'
import { RotationAdvice as RotationAdviceType } from '@/lib/rotation'
import { RotationBadge, FamilyBadge } from './RotationBadge'

interface RotationAdviceProps {
  plancheId: string
  year?: number
}

export function RotationAdvice({ plancheId, year }: RotationAdviceProps) {
  const [advice, setAdvice] = useState<RotationAdviceType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const targetYear = year || new Date().getFullYear()

  useEffect(() => {
    async function fetchAdvice() {
      try {
        setLoading(true)
        const res = await fetch(
          `/api/planches/${encodeURIComponent(plancheId)}/rotation-advice?year=${targetYear}`
        )
        if (!res.ok) throw new Error('Erreur lors du chargement')
        const data = await res.json()
        setAdvice(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      } finally {
        setLoading(false)
      }
    }
    fetchAdvice()
  }, [plancheId, targetYear])

  if (loading) {
    return <div className="p-4 text-center text-gray-500">Chargement...</div>
  }

  if (error) {
    return <div className="p-4 text-center text-red-500">{error}</div>
  }

  if (!advice) {
    return <div className="p-4 text-center text-gray-500">Aucune donnée</div>
  }

  return (
    <div className="space-y-6">
      {/* État du sol */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <h3 className="mb-3 text-lg font-semibold text-gray-900">État estimé du sol</h3>
        <div className="grid grid-cols-3 gap-4">
          <SoilIndicator label="Azote (N)" status={advice.soilStatus.estimatedN} />
          <SoilIndicator label="Phosphore (P)" status={advice.soilStatus.estimatedP} />
          <SoilIndicator label="Potassium (K)" status={advice.soilStatus.estimatedK} />
        </div>
        {advice.soilStatus.suggestion && (
          <p className="mt-3 text-sm text-gray-600">{advice.soilStatus.suggestion}</p>
        )}
        {advice.soilStatus.lastHeavyFeeder && (
          <p className="mt-2 text-sm text-gray-500">
            Dernière culture gourmande : {advice.soilStatus.lastHeavyFeeder.especeId} en{' '}
            {advice.soilStatus.lastHeavyFeeder.year}
          </p>
        )}
      </div>

      {/* Familles bloquées */}
      <div className="rounded-lg border border-red-200 bg-red-50 p-4">
        <h3 className="mb-3 flex items-center gap-2 text-lg font-semibold text-red-900">
          <span>Familles bloquées</span>
          <span className="rounded-full bg-red-200 px-2 py-0.5 text-sm">
            {advice.blockedFamilies.length}
          </span>
        </h3>
        {advice.blockedFamilies.length === 0 ? (
          <p className="text-sm text-gray-600">Aucune famille bloquée - toutes sont disponibles !</p>
        ) : (
          <div className="space-y-2">
            {advice.blockedFamilies.map((blocked) => (
              <div
                key={blocked.familleId}
                className="flex items-center justify-between rounded-md bg-white p-3"
              >
                <div className="flex items-center gap-2">
                  <FamilyBadge
                    familleId={blocked.familleId}
                    familleNom={blocked.familleNom}
                    familleCouleur={blocked.familleCouleur}
                  />
                  <span className="text-sm text-gray-600">{blocked.reason}</span>
                </div>
                <span className="rounded bg-red-100 px-2 py-1 text-sm font-medium text-red-800">
                  +{blocked.yearsRemaining} an{blocked.yearsRemaining > 1 ? 's' : ''}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Familles recommandées */}
      <div className="rounded-lg border border-green-200 bg-green-50 p-4">
        <h3 className="mb-3 text-lg font-semibold text-green-900">Familles recommandées</h3>
        {advice.recommendedFamilies.length === 0 ? (
          <p className="text-sm text-gray-600">Aucune recommandation spécifique</p>
        ) : (
          <div className="space-y-2">
            {advice.recommendedFamilies.slice(0, 8).map((rec) => (
              <div
                key={rec.familleId}
                className="flex items-center justify-between rounded-md bg-white p-3"
              >
                <div className="flex items-center gap-2">
                  <FamilyBadge
                    familleId={rec.familleId}
                    familleNom={rec.familleNom}
                    familleCouleur={rec.familleCouleur}
                  />
                  <span className="text-sm text-gray-600">{rec.reason}</span>
                </div>
                <ScoreBar score={rec.score} />
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Cultures récentes */}
      {advice.recentCultures.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h3 className="mb-3 text-lg font-semibold text-gray-900">Cultures récentes (5 ans)</h3>
          <div className="flex flex-wrap gap-2">
            {advice.recentCultures.map((culture, idx) => (
              <span
                key={idx}
                className="rounded-full bg-gray-100 px-3 py-1 text-sm text-gray-700"
              >
                {culture.annee} - {culture.especeId}
                {culture.besoinN !== null && culture.besoinN >= 4 && (
                  <span className="ml-1 text-orange-600" title="Culture gourmande en azote">
                    *
                  </span>
                )}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function SoilIndicator({
  label,
  status,
}: {
  label: string
  status: 'depleted' | 'normal' | 'enriched'
}) {
  const colors = {
    depleted: 'bg-red-100 text-red-800 border-red-300',
    normal: 'bg-gray-100 text-gray-800 border-gray-300',
    enriched: 'bg-green-100 text-green-800 border-green-300',
  }

  const labels = {
    depleted: 'Appauvri',
    normal: 'Normal',
    enriched: 'Enrichi',
  }

  return (
    <div className="text-center">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div
        className={`mt-1 rounded-full border px-3 py-1 text-sm font-medium ${colors[status]}`}
      >
        {labels[status]}
      </div>
    </div>
  )
}

function ScoreBar({ score }: { score: number }) {
  const color =
    score >= 80 ? 'bg-green-500' : score >= 50 ? 'bg-yellow-500' : 'bg-gray-400'

  return (
    <div className="flex items-center gap-2">
      <div className="h-2 w-16 overflow-hidden rounded-full bg-gray-200">
        <div className={`h-full ${color}`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-xs text-gray-500">{score}</span>
    </div>
  )
}

/**
 * Composant compact pour afficher dans le formulaire de culture
 */
interface RotationAdviceCompactProps {
  plancheId: string
  especeId?: string
  year?: number
  onAdviceLoaded?: (advice: RotationAdviceType) => void
}

export function RotationAdviceCompact({
  plancheId,
  especeId,
  year,
  onAdviceLoaded,
}: RotationAdviceCompactProps) {
  const [advice, setAdvice] = useState<RotationAdviceType | null>(null)
  const [loading, setLoading] = useState(true)
  const targetYear = year || new Date().getFullYear()

  useEffect(() => {
    async function fetchAdvice() {
      try {
        setLoading(true)
        const url = new URL(
          `/api/planches/${encodeURIComponent(plancheId)}/rotation-advice`,
          window.location.origin
        )
        url.searchParams.set('year', String(targetYear))
        if (especeId) url.searchParams.set('especeId', especeId)

        const res = await fetch(url)
        if (!res.ok) return
        const data = await res.json()
        setAdvice(data)
        onAdviceLoaded?.(data)
      } catch {
        // Silently fail
      } finally {
        setLoading(false)
      }
    }
    fetchAdvice()
  }, [plancheId, especeId, targetYear, onAdviceLoaded])

  if (loading || !advice) return null

  // Si une espèce est sélectionnée, afficher le conseil spécifique
  if (advice.especeAdvice) {
    return (
      <div
        className={`rounded-lg border p-3 ${
          advice.especeAdvice.status === 'blocked'
            ? 'border-red-300 bg-red-50'
            : advice.especeAdvice.status === 'warning'
              ? 'border-yellow-300 bg-yellow-50'
              : 'border-green-300 bg-green-50'
        }`}
      >
        <div className="flex items-center gap-2">
          <RotationBadge status={advice.especeAdvice.status} size="sm" />
          <span className="text-sm font-medium">{advice.especeAdvice.message}</span>
        </div>
        {advice.especeAdvice.details.length > 0 && (
          <ul className="mt-2 space-y-1 text-xs text-gray-600">
            {advice.especeAdvice.details.map((detail, idx) => (
              <li key={idx}>• {detail}</li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  // Sinon, afficher un résumé
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="text-sm font-medium text-gray-700">Conseils rotation pour {targetYear}</div>
      <div className="mt-2 flex flex-wrap gap-1">
        {advice.blockedFamilies.length > 0 && (
          <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-700">
            {advice.blockedFamilies.length} famille{advice.blockedFamilies.length > 1 ? 's' : ''}{' '}
            bloquée{advice.blockedFamilies.length > 1 ? 's' : ''}
          </span>
        )}
        {advice.recommendedFamilies.filter((r) => r.score >= 80).length > 0 && (
          <span className="rounded bg-green-100 px-2 py-0.5 text-xs text-green-700">
            {advice.recommendedFamilies.filter((r) => r.score >= 80).length} recommandée
            {advice.recommendedFamilies.filter((r) => r.score >= 80).length > 1 ? 's' : ''}
          </span>
        )}
      </div>
    </div>
  )
}
