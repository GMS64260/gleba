/**
 * Date réelle d'un soin ou d'une injection que l'éleveur coche « fait ».
 *
 * Une échéance du jour (ou de la veille) est validée en un geste, à l'instant
 * présent. Une échéance plus ancienne est presque toujours une ressaisie : on
 * demande le jour réel au lieu d'horodater le clic, qui daterait le traitement
 * d'aujourd'hui et repousserait d'autant la fin du délai d'attente (et, pour la
 * première injection, tout le calendrier du protocole). Même règle que le
 * carnet de soins (`changerInjection`), appliquée au Calendrier, à la Tournée
 * et au tableau de bord.
 */

const UN_JOUR_MS = 24 * 3_600_000

export function echeanceAncienne(echeance: string | Date | null | undefined, maintenant = new Date()): boolean {
  if (!echeance) return false
  const prevue = new Date(echeance)
  return !Number.isNaN(prevue.getTime()) && maintenant.getTime() - prevue.getTime() > UN_JOUR_MS
}

const versJourFr = (date: Date) =>
  `${String(date.getDate()).padStart(2, '0')}/${String(date.getMonth() + 1).padStart(2, '0')}/${date.getFullYear()}`

/**
 * Lit un jour « JJ/MM/AAAA » (ou « AAAA-MM-JJ ») et rend midi, heure locale, de
 * ce jour ; `null` si la saisie n'est pas un jour valide ou est dans le futur.
 */
export function lireJourRealisation(saisie: string, maintenant = new Date()): Date | null {
  const texte = saisie.trim()
  const fr = /^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/.exec(texte)
  const iso = /^(\d{4})-(\d{2})-(\d{2})$/.exec(texte)
  const [annee, mois, jour] = fr
    ? [Number(fr[3]), Number(fr[2]), Number(fr[1])]
    : iso
      ? [Number(iso[1]), Number(iso[2]), Number(iso[3])]
      : [NaN, NaN, NaN]
  if (![annee, mois, jour].every(Number.isInteger)) return null
  const date = new Date(annee, mois - 1, jour, 12, 0, 0, 0)
  if (date.getFullYear() !== annee || date.getMonth() !== mois - 1 || date.getDate() !== jour) return null
  const finAujourdhui = new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate(), 23, 59, 59, 999)
  return date.getTime() > finAujourdhui.getTime() ? null : date
}

/**
 * Date ISO à envoyer pour un « fait » : l'instant présent, ou le jour demandé à
 * l'éleveur quand l'échéance est ancienne. `null` : abandon (annulation, ou
 * saisie invalide, signalée).
 */
export function dateRealisationPourFait(echeance: string | Date | null | undefined, quoi = 'Ce soin'): string | null {
  if (!echeanceAncienne(echeance)) return new Date().toISOString()
  const prevue = new Date(echeance as string | Date)
  const saisie = window.prompt(
    `${quoi} était prévu le ${versJourFr(prevue)}. Quel jour a-t-il été fait ? (JJ/MM/AAAA)`,
    versJourFr(prevue),
  )
  if (saisie === null) return null
  const date = lireJourRealisation(saisie)
  if (!date) {
    window.alert('Date non reconnue ou dans le futur : rien n’a été enregistré. Saisissez un jour au format JJ/MM/AAAA.')
    return null
  }
  return date.toISOString()
}
