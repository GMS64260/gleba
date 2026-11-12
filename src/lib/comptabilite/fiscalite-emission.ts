/**
 * Fiscalité d'un brouillon de facture au moment de son émission.
 *
 * COM-01 (revue Codex du 2026-11-12) : `creerFacture` applique au brouillon la
 * franchise en base (art. 293 B CGI), les autres régimes hors TVA et
 * l'exonération du client : lignes à TVA 0, totaux, mention de régime.
 * L'émission ne rafraîchissait que l'instantané de l'émetteur. Un brouillon
 * créé au réel puis émis en franchise facturait une TVA due par le seul fait
 * d'être facturée (art. 283-3 CGI), sans mention 293 B ; l'inverse émettait au
 * réel une facture à TVA 0 portant la mention de franchise.
 *
 * Un brouillon passé à TVA 0 a perdu les taux de ses lignes : un recalcul
 * fidèle est impossible. L'émission est donc refusée quand la fiscalité a
 * changé, et le brouillon se recrée.
 */
import { factureSansTaxe } from '@/lib/territoires'

/** Mention de régime portée en pied de facture (même table que les mentions par défaut). */
export function mentionDeRegime(regimeTva?: string | null): '293b' | 'rfa' | 'exoneration' | null {
  if (regimeTva === 'franchise-293b') return '293b'
  if (regimeTva === 'rfa') return 'rfa'
  if (regimeTva === 'non-assujetti') return 'exoneration'
  return null
}

function regimeDeInstantane(instantane: unknown): string | null {
  if (!instantane || typeof instantane !== 'object') return null
  const regime = (instantane as { regimeTva?: unknown }).regimeTva
  return typeof regime === 'string' ? regime : null
}

/** Motif de refus d'émission, ou `null` si la fiscalité du brouillon vaut toujours. */
export function refusFiscaliteChangee(
  brouillon: {
    emetteurSnapshot: unknown
    totalTVA: number | null
    lignes: readonly { tauxTVA: number | null; montantTVA?: number | null }[]
  },
  instantaneEmission: unknown,
  clientExonere: boolean,
): string | null {
  const avant = regimeDeInstantane(brouillon.emetteurSnapshot)
  const apres = regimeDeInstantane(instantaneEmission)
  if (factureSansTaxe(avant) !== factureSansTaxe(apres) || mentionDeRegime(avant) !== mentionDeRegime(apres)) {
    return `Le régime de TVA de l'exploitation a changé depuis la création de ce brouillon (${avant ?? 'non renseigné'} → ${apres ?? 'non renseigné'}) : ses lignes, ses totaux et ses mentions ne correspondent plus. Recréez le brouillon pour l'émettre.`
  }
  const factureDeLaTva =
    (brouillon.totalTVA ?? 0) !== 0 || brouillon.lignes.some((l) => (l.tauxTVA ?? 0) > 0 || (l.montantTVA ?? 0) !== 0)
  if (clientExonere && factureDeLaTva) {
    return "Le client est désormais exonéré de TVA, mais ce brouillon en facture : ses lignes et ses totaux ne correspondent plus. Recréez le brouillon pour l'émettre."
  }
  return null
}
