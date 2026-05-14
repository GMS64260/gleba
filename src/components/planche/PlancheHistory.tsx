/**
 * Composant d'affichage de l'historique d'une planche
 */

'use client'

import { useState, useEffect } from 'react'
import { CultureHistory, FertilisationHistory, PlancheHistory as PlancheHistoryType } from '@/lib/rotation'
import { FamilyBadge } from './RotationBadge'
import { format } from 'date-fns'
import { fr } from 'date-fns/locale'

interface PlancheHistoryProps {
  plancheId: string
}

export function PlancheHistory({ plancheId }: PlancheHistoryProps) {
  const [history, setHistory] = useState<PlancheHistoryType | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedYear, setSelectedYear] = useState<number | 'all'>('all')

  useEffect(() => {
    async function fetchHistory() {
      try {
        setLoading(true)
        const res = await fetch(`/api/planches/${encodeURIComponent(plancheId)}/history`)
        if (!res.ok) throw new Error('Erreur lors du chargement')
        const data = await res.json()
        setHistory(data)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Erreur inconnue')
      } finally {
        setLoading(false)
      }
    }
    fetchHistory()
  }, [plancheId])

  if (loading) {
    return <div className="p-4 text-center text-slate-500">Chargement...</div>
  }

  if (error) {
    return <div className="p-4 text-center text-red-500">{error}</div>
  }

  if (!history) {
    return <div className="p-4 text-center text-slate-500">Aucune donnée</div>
  }

  const filteredCultures =
    selectedYear === 'all'
      ? history.cultures
      : history.cultures.filter((c) => c.annee === selectedYear)

  const filteredFertilisations =
    selectedYear === 'all'
      ? history.fertilisations
      : history.fertilisations.filter((f) => new Date(f.date).getFullYear() === selectedYear)

  // Grouper les cultures par annee
  const culturesByYear = filteredCultures.reduce(
    (acc, culture) => {
      const year = culture.annee
      if (!acc[year]) acc[year] = []
      acc[year].push(culture)
      return acc
    },
    {} as Record<number, CultureHistory[]>
  )

  const years = Object.keys(culturesByYear)
    .map(Number)
    .sort((a, b) => b - a)

  return (
    <div className="space-y-6">
      {/* Filtre par annee */}
      <div className="flex items-center gap-2">
        <label className="text-sm font-medium text-slate-700">Année :</label>
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(e.target.value === 'all' ? 'all' : Number(e.target.value))}
          className="rounded-md border border-slate-300 px-3 py-1.5 text-sm"
        >
          <option value="all">Toutes</option>
          {history.yearsAvailable.map((year) => (
            <option key={year} value={year}>
              {year}
            </option>
          ))}
        </select>
      </div>

      {/* Cultures */}
      <div>
        <h3 className="mb-3 text-lg font-semibold text-slate-900">Cultures</h3>
        {years.length === 0 ? (
          <p className="text-sm text-slate-500">Aucune culture enregistrée</p>
        ) : (
          <div className="space-y-6">
            {years.map((year) => (
              <div key={year} className="rounded-lg border border-slate-200 bg-white p-4">
                <h4 className="mb-3 text-base font-medium text-slate-800">{year}</h4>
                <div className="space-y-3">
                  {culturesByYear[year].map((culture) => (
                    <CultureCard key={culture.id} culture={culture} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Fertilisations */}
      {filteredFertilisations.length > 0 && (
        <div>
          <h3 className="mb-3 text-lg font-semibold text-slate-900">Fertilisations</h3>
          <div className="rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-slate-500">
                    Date
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-slate-500">
                    Fertilisant
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-slate-500">
                    Quantité
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium uppercase text-slate-500">
                    N-P-K
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredFertilisations.map((f) => (
                  <tr key={f.id}>
                    <td className="whitespace-nowrap px-4 py-2 text-sm text-slate-900">
                      {formatDate(f.date)}
                    </td>
                    <td className="px-4 py-2 text-sm text-slate-900">{f.fertilisantNom}</td>
                    <td className="px-4 py-2 text-sm text-slate-900">{f.quantite} kg</td>
                    <td className="px-4 py-2 text-sm text-slate-500">
                      {f.n ?? '-'}-{f.p ?? '-'}-{f.k ?? '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function CultureCard({ culture }: { culture: CultureHistory }) {
  const stateColors: Record<string, string> = {
    Planifiée: 'text-slate-500',
    Semée: 'text-blue-600',
    Plantée: 'text-green-600',
    'En récolte': 'text-orange-600',
    Terminée: 'text-slate-400',
    Vivace: 'text-purple-600',
    'Non significative': 'text-slate-400',
  }

  return (
    <div className="flex items-start justify-between rounded-md bg-slate-50 p-3">
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="font-medium text-slate-900">{culture.especeNom}</span>
          {culture.familleId && (
            <FamilyBadge
              familleId={culture.familleId}
              familleNom={culture.familleNom || culture.familleId}
              familleCouleur={culture.familleCouleur}
            />
          )}
        </div>
        <div className="flex items-center gap-4 text-sm text-slate-500">
          <span className={stateColors[culture.etat] || 'text-slate-500'}>{culture.etat}</span>
          {culture.dateSemis && <span>Semis: {formatDate(culture.dateSemis)}</span>}
          {culture.datePlantation && <span>Plantation: {formatDate(culture.datePlantation)}</span>}
          {culture.dateRecolte && <span>Récolte: {formatDate(culture.dateRecolte)}</span>}
        </div>
      </div>
      {culture.totalRecolte > 0 && (
        <div className="text-right">
          <div className="text-lg font-semibold text-green-600">{culture.totalRecolte} kg</div>
          <div className="text-xs text-slate-500">
            {culture.recoltes.length} recolte{culture.recoltes.length > 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  )
}

function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, 'd MMM yyyy', { locale: fr })
}
