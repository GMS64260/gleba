type DashboardHistoryMode = "push" | "replace"

/**
 * Synchronise les onglets du dashboard avec sa query sans relancer une
 * navigation vers `/`.
 *
 * La racine authentifiée est réécrite en interne vers `/dashboard`. Une
 * navigation App Router vers `/?...` peut alors être dédupliquée contre la
 * route déjà rendue et ne pas mettre à jour les onglets contrôlés. L'API
 * History native est intégrée au routeur Next et notifie `useSearchParams`.
 */
export function updateDashboardSearchParams(
  params: URLSearchParams,
  mode: DashboardHistoryMode,
) {
  const query = params.toString()
  const url = `${window.location.pathname}${query ? `?${query}` : ""}${window.location.hash}`

  if (mode === "push") {
    window.history.pushState(null, "", url)
  } else {
    window.history.replaceState(null, "", url)
  }
}
