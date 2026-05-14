/**
 * API État onboarding (PROMPT 22 §1).
 *
 * GET   → { completed: boolean }
 * POST  → marque onboarding_completed=true (idempotent)
 *
 * Stocké dans UserPreference (key: 'onboarding_completed', value: 'true'|'false').
 */

import { NextResponse } from 'next/server'
import { requireAuthApi } from '@/lib/auth-utils'
import prisma from '@/lib/prisma'

const KEY = 'onboarding_completed'

export async function GET() {
  const { session, error } = await requireAuthApi()
  if (error) return error

  const pref = await prisma.userPreference.findUnique({
    where: { userId_key: { userId: session.user.id, key: KEY } },
  })
  return NextResponse.json({ completed: pref?.value === 'true' })
}

export async function POST() {
  const { session, error } = await requireAuthApi()
  if (error) return error

  await prisma.userPreference.upsert({
    where: { userId_key: { userId: session.user.id, key: KEY } },
    create: { userId: session.user.id, key: KEY, value: 'true' },
    update: { value: 'true' },
  })
  return NextResponse.json({ completed: true })
}
