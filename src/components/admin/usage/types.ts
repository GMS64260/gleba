/** Contrat de /api/admin/usage et /api/admin/usage/:id, côté interface. */

import type { GroupeUsageId, Segment } from "@/lib/admin-usage-groupes"
import type { ModuleId } from "@/lib/modules"

export type { GroupeUsageId, Segment }

export interface UsageGroupe {
  fenetre: number
  total: number
  derniere: string | null
}

export interface CompteUsage {
  id: string
  email: string
  name: string | null
  active: boolean
  createdAt: string
  segment: Segment
  activeDaysTotal: number
  activeDaysInWindow: number
  activeWeeksInWindow: number
  firstActivity: string | null
  lastActivity: string | null
  modulesActifs: ModuleId[]
  usage: Record<GroupeUsageId, UsageGroupe>
  saisiesFenetre: number
  contentTotal: number
  derniereSaisie: string | null
  assistant: { questionsFenetre: number; questionsTotal: number; conversationsFenetre: number; derniere: string | null }
  connexions: { fenetre: number; mobile: number; derniere: string | null }
  notifications: { appareils: number; mobile: number }
  equipe: { membres: number; membreDe: string | null }
}

export interface ModuleResume {
  id: GroupeUsageId
  libelle: string
  module: boolean
  actives: number | null
  utilisateurs: number
  saisies: number
}

export interface UsageData {
  range: { days: number; bucket: string; start: string }
  excluded: { demo: boolean; adminCount: number }
  totalRealUsers: number
  resume: {
    actifsPeriode: number
    reguliers: number
    nouveauxInscrits: number
    assistant: number
    sansSaisie: number
    semainesFenetre: number
  }
  segments: Record<Segment, number>
  modules: ModuleResume[]
  tendance: {
    buckets: string[]
    actifs: number[]
    inscriptions: number[]
    saisies: Record<GroupeUsageId, number[]>
  }
  ranking: CompteUsage[]
  series: { buckets: string[]; users: Array<{ id: string; email: string; name: string | null; values: number[] }> }
}

export interface FicheUsage {
  calendrier: { debut: string; jours: string[] }
  sources: Array<{
    source: string
    libelle: string
    groupe: GroupeUsageId
    total: number
    fenetre: number
    derniere: string | null
  }>
  hebdo: { semaines: string[]; parGroupe: Record<GroupeUsageId, number[]> }
}
