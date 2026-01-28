/**
 * Badge pour afficher le statut d'une rotation
 */

'use client'

import { cn } from '@/lib/utils'

interface RotationBadgeProps {
  status: 'safe' | 'warning' | 'blocked'
  size?: 'sm' | 'md'
  className?: string
}

export function RotationBadge({ status, size = 'md', className }: RotationBadgeProps) {
  const labels = {
    safe: 'OK',
    warning: 'Attention',
    blocked: 'Bloqué',
  }

  const colors = {
    safe: 'bg-green-100 text-green-800 border-green-300',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    blocked: 'bg-red-100 text-red-800 border-red-300',
  }

  const sizes = {
    sm: 'text-xs px-1.5 py-0.5',
    md: 'text-sm px-2 py-1',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium',
        colors[status],
        sizes[size],
        className
      )}
    >
      {labels[status]}
    </span>
  )
}

interface FamilyBadgeProps {
  familleId: string
  familleNom: string
  familleCouleur: string | null
  className?: string
}

export function FamilyBadge({ familleId, familleNom, familleCouleur, className }: FamilyBadgeProps) {
  const bgColor = familleCouleur || '#6b7280'

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2 py-1 text-xs font-medium text-white',
        className
      )}
      style={{ backgroundColor: bgColor }}
    >
      {familleNom || familleId}
    </span>
  )
}
