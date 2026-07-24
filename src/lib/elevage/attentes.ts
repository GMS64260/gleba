/**
 * Consolidation des délais d'attente (remise en vente lait / viande).
 *
 * Un « traitement » est souvent plusieurs injections (mêmes produit + animal,
 * sur quelques jours). Réglementairement, le délai d'attente court à partir de
 * la DERNIÈRE injection. Historiquement chaque ligne de soin portait sa propre
 * fenêtre → deux défauts remontés par la QA (2026-07-24) :
 *   - #2 : la fenêtre était ancrée sur la 1re injection (lait rendu vendable
 *     trop tôt — risque sanitaire) ;
 *   - #9 : chaque ligne émettait sa propre échéance → doublons dans
 *     « Prochaines échéances » et compteur d'urgences gonflé.
 *
 * On regroupe donc les soins par (cible, produit) et on ancre la fenêtre sur la
 * DERNIÈRE injection du traitement — administrée OU planifiée, à condition que
 * le traitement ait déjà commencé (≥ 1 injection faite). Une seule échéance par
 * traitement. Helper partagé par /api/elevage/attentes et /api/elevage/agenda.
 */

export interface SoinAttenteRow {
  id: number
  animalId: number | null
  lotId: number | null
  type: string
  produit: string | null
  produitId: string | null
  date: Date
  datePrevue: Date | null
  fait: boolean
  tempsAttenteLaitJ: number | null
  tempsAttenteViandeJ: number | null
  nbInjections: number | null
  intervalleInjectionsHeures: number | null
  /** Libellés pré-résolus (côté requête) pour éviter un 2ᵉ round-trip. */
  cibleLabel: string
  cibleNom: string | null
  traitementLabel: string
}

export type CibleType = 'animal' | 'lot' | 'global'

export interface AttenteConsolidee {
  key: string
  soinIds: number[]
  cible: { type: CibleType; id: number | null; label: string; nom: string | null }
  traitement: string
  /** Date de la dernière injection (ancre de la fenêtre). */
  derniereInjection: Date
  /** Fin d'attente lait (dernière injection + délai lait), ou null. */
  finAttenteLait: Date | null
  /** Fin d'attente viande (dernière injection + délai viande), ou null. */
  finAttenteViande: Date | null
}

function floorDayUTC(d: Date): Date {
  const x = new Date(d)
  x.setUTCHours(0, 0, 0, 0)
  return x
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d)
  x.setUTCDate(x.getUTCDate() + days)
  return x
}

/**
 * Date effective de la dernière injection d'une ligne : date d'administration
 * (ou date prévue si planifiée) étendue de (nbInjections − 1) × intervalle si un
 * protocole multi-injections est saisi sur la ligne (cf. PROMPT 30).
 */
function derniereInjectionLigne(s: SoinAttenteRow): Date {
  const base = s.fait ? s.date : s.datePrevue ?? s.date
  const n = s.nbInjections ?? 1
  const h = s.intervalleInjectionsHeures
  if (n > 1 && h) {
    return new Date(base.getTime() + (n - 1) * h * 3_600_000)
  }
  return base
}

function cibleOf(s: SoinAttenteRow): { type: CibleType; id: number | null } {
  if (s.animalId != null) return { type: 'animal', id: s.animalId }
  if (s.lotId != null) return { type: 'lot', id: s.lotId }
  return { type: 'global', id: null }
}

function groupKey(s: SoinAttenteRow): string {
  const { type, id } = cibleOf(s)
  // On préfère la FK produit ; sinon le libellé produit normalisé ; sinon le
  // type de soin. Deux cures du même produit espacées de plusieurs mois ne se
  // mélangent pas car la requête ne remonte que les fenêtres encore actives
  // (les cures anciennes ont expiré).
  const traitement = (s.produitId ?? s.produit?.trim().toLowerCase() ?? s.type).toString()
  return `${type}:${id ?? 'null'}:${traitement}`
}

const MAX_GAP_MEME_CURE_MS = 7 * 86_400_000

/**
 * Regroupe des lignes de soin en échéances de délai d'attente consolidées.
 * Ne conserve que les traitements COMMENCÉS (≥ 1 injection faite) dont la
 * fenêtre lait et/ou viande est encore active à `today`.
 *
 * @param soins  lignes candidates : injections faites (fenêtre active) ET
 *               injections planifiées à venir du même traitement.
 * @param today  jour de référence (aplati UTC recommandé).
 */
export function consoliderAttentes(soins: SoinAttenteRow[], today: Date): AttenteConsolidee[] {
  const t0 = floorDayUTC(today).getTime()
  const groupesProduit = new Map<string, SoinAttenteRow[]>()
  for (const s of soins) {
    const k = groupKey(s)
    const arr = groupesProduit.get(k)
    if (arr) arr.push(s)
    else groupesProduit.set(k, [s])
  }

  // Deux cures du même produit restent distinctes. Pour les anciennes données,
  // qui n'ont pas d'identifiant de protocole, on ne regroupe que des lignes
  // séparées de sept jours au maximum.
  const groups = new Map<string, SoinAttenteRow[]>()
  for (const [baseKey, membres] of groupesProduit) {
    const tries = [...membres].sort(
      (a, b) => derniereInjectionLigne(a).getTime() - derniereInjectionLigne(b).getTime(),
    )
    let cluster = 0
    let precedent: Date | null = null
    for (const membre of tries) {
      const courant = derniereInjectionLigne(membre)
      if (precedent && courant.getTime() - precedent.getTime() > MAX_GAP_MEME_CURE_MS) cluster += 1
      const key = `${baseKey}:cure-${cluster}`
      const arr = groups.get(key)
      if (arr) arr.push(membre)
      else groups.set(key, [membre])
      precedent = courant
    }
  }

  const result: AttenteConsolidee[] = []
  for (const [key, membres] of groups) {
    // Traitement commencé uniquement (au moins une injection administrée).
    const faits = membres.filter((m) => m.fait)
    if (faits.length === 0) continue

    // Ancre = dernière injection du traitement (faite ou planifiée à venir).
    let ancre = derniereInjectionLigne(faits[0])
    for (const m of membres) {
      const d = derniereInjectionLigne(m)
      if (d.getTime() > ancre.getTime()) ancre = d
    }

    const tempsLait = Math.max(0, ...membres.map((m) => m.tempsAttenteLaitJ ?? 0))
    const tempsViande = Math.max(0, ...membres.map((m) => m.tempsAttenteViandeJ ?? 0))
    const finLait = tempsLait > 0 ? addDays(ancre, tempsLait) : null
    const finViande = tempsViande > 0 ? addDays(ancre, tempsViande) : null

    const laitActif = finLait != null && floorDayUTC(finLait).getTime() >= t0
    const viandeActif = finViande != null && floorDayUTC(finViande).getTime() >= t0
    if (!laitActif && !viandeActif) continue

    const rep = membres[0]
    const c = cibleOf(rep)
    result.push({
      key,
      soinIds: membres.map((m) => m.id),
      cible: { type: c.type, id: c.id, label: rep.cibleLabel, nom: rep.cibleNom },
      traitement: rep.traitementLabel,
      derniereInjection: ancre,
      finAttenteLait: laitActif ? finLait : null,
      finAttenteViande: viandeActif ? finViande : null,
    })
  }

  // Tri : échéance lait la plus proche d'abord, puis viande.
  result.sort((a, b) => {
    const ax = (a.finAttenteLait ?? a.finAttenteViande)!.getTime()
    const bx = (b.finAttenteLait ?? b.finAttenteViande)!.getTime()
    return ax - bx
  })
  return result
}

/** Date de remise en vente = lendemain de la fin d'attente (jour de fin encore écarté). */
export function remiseVente(fin: Date | null): Date | null {
  if (!fin) return null
  return addDays(floorDayUTC(fin), 1)
}
