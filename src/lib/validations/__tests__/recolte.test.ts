/**
 * BUG-07 — tests : un statut « vendu » exige prix + date + client.
 */

import { describe, it, expect } from 'vitest'
import { recoltePatchSchema } from '../recolte'

describe('recoltePatchSchema (BUG-07 vendu = prix + date + client)', () => {
  const validVendu = {
    statut: 'vendu' as const,
    prixKg: 5,
    dateVente: new Date('2026-05-14'),
    clientNom: 'Marché du village',
  }

  it('accepte une vente complète', () => {
    const r = recoltePatchSchema.safeParse(validVendu)
    expect(r.success).toBe(true)
  })

  it('refuse statut=vendu sans prix', () => {
    const r = recoltePatchSchema.safeParse({ ...validVendu, prixKg: null, prixTotal: null })
    expect(r.success).toBe(false)
    if (!r.success) {
      const issues = r.error.flatten().fieldErrors
      expect(issues.prixKg?.[0]).toMatch(/prix/i)
    }
  })

  it('refuse statut=vendu avec prixKg=0', () => {
    const r = recoltePatchSchema.safeParse({ ...validVendu, prixKg: 0 })
    expect(r.success).toBe(false)
  })

  it('accepte vendu si prixTotal présent même sans prixKg', () => {
    const r = recoltePatchSchema.safeParse({ ...validVendu, prixKg: null, prixTotal: 25 })
    expect(r.success).toBe(true)
  })

  it('refuse statut=vendu sans date de vente', () => {
    const r = recoltePatchSchema.safeParse({ ...validVendu, dateVente: null })
    expect(r.success).toBe(false)
    if (!r.success) {
      expect(r.error.flatten().fieldErrors.dateVente).toBeDefined()
    }
  })

  it('refuse statut=vendu sans client (id ni nom)', () => {
    const r = recoltePatchSchema.safeParse({ ...validVendu, clientNom: null, clientId: null })
    expect(r.success).toBe(false)
  })

  it('accepte vendu si clientId présent mais clientNom null', () => {
    const r = recoltePatchSchema.safeParse({ ...validVendu, clientNom: null, clientId: 'cl_123' })
    expect(r.success).toBe(true)
  })

  it('accepte autres statuts (en_stock, perte) sans contrainte prix/date', () => {
    expect(recoltePatchSchema.safeParse({ statut: 'en_stock' }).success).toBe(true)
    expect(recoltePatchSchema.safeParse({ statut: 'perte' }).success).toBe(true)
    expect(recoltePatchSchema.safeParse({ statut: 'consomme' }).success).toBe(true)
  })

  it('accepte un patch sans champ statut (édition de notes par exemple)', () => {
    const r = recoltePatchSchema.safeParse({ notes: 'oublié de peser' })
    expect(r.success).toBe(true)
  })
})
