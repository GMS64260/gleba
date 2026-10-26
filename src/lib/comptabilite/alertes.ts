/** Même périmètre pour le compteur et la liste ouverte depuis le tableau de bord. */
export const STATUTS_COMMANDES_EN_ATTENTE = ['nouveau', 'confirmee', 'prete'] as const

export function liensAlertesCompta(annee: number) {
  return {
    creances: '/comptabilite/factures?tab=impayees',
    commandes: `/boutique?tab=commandes&statut=en_attente&annee=${annee}`,
    stocks: '/comptabilite/stocks?alerte=bas#stocks-bas',
  }
}
