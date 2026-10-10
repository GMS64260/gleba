"use client"

import * as React from "react"
// eslint-disable-next-line no-restricted-imports -- seul point d'entrée autorisé
import { ResponsiveContainer as RechartsResponsiveContainer } from "recharts"

/**
 * `ResponsiveContainer` de Recharts sans le warning du premier rendu.
 *
 * Ticket cmv29ksh8 (QA 2026-10-10) — cinq warnings « The width(-1) and
 * height(-1) of chart should be greater than 0 » à chaque chargement de
 * /verger, un par graphique. Recharts 3 part d'une taille -1 × -1
 * (`initialDimension`) en attendant la mesure du conteneur, et avertit dès
 * ce premier rendu, quel que soit le CSS : tout graphique de l'app le
 * faisait (la piste CSS de `ui/chart.tsx` ne pouvait rien).
 *
 * 0 × 1 garde le comportement visuel : le graphique ne se dessine qu'avec
 * largeur ET hauteur positives (`RootSurface`), donc rien avant la mesure,
 * comme avec -1 ; le warning, lui, ne part que si aucune des deux ne l'est.
 * Un vrai conteneur nul (onglet masqué) continue d'avertir après mesure.
 */
const TAILLE_AVANT_MESURE = { width: 0, height: 1 }

type Props = React.ComponentProps<typeof RechartsResponsiveContainer>

export const ResponsiveContainer = React.forwardRef<HTMLDivElement, Props>(function ResponsiveContainer(
  { initialDimension = TAILLE_AVANT_MESURE, ...props },
  ref,
) {
  return <RechartsResponsiveContainer ref={ref} initialDimension={initialDimension} {...props} />
})
