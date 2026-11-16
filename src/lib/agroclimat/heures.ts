/**
 * Températures horaires reconstruites à partir du minimum et du maximum du
 * jour.
 *
 * Les modèles de froid et de chaleur des arbres fruitiers travaillent heure par
 * heure, alors que les archives climatiques (SAFRAN, capteurs agrégés, stations)
 * ne donnent que deux valeurs par jour. La reconstruction suit Linvill (1990),
 * telle que l'applique le paquet R `chillR` (`daylength`, `make_hourly_temps`) :
 * sinusoïde entre le lever et le coucher du soleil, décroissance logarithmique
 * la nuit jusqu'au minimum du lendemain. La durée du jour vient de la latitude
 * (Spencer 1971, Almorox 2005).
 *
 * Référence : Linvill DE (1990), HortScience 25(1), 14-16.
 */

export interface JourMinMax {
  /** Rang du jour dans l'année, 1 à 366. */
  rang: number
  tmin: number
  tmax: number
}

interface Soleil {
  lever: number
  coucher: number
  duree: number
}

/** Heures de lever et de coucher du soleil (heure solaire) et durée du jour. */
export function soleilDuJour(latitude: number, rang: number): Soleil {
  const gamma = ((2 * Math.PI) / 365) * (rang - 1)
  const declinaison =
    (180 / Math.PI) *
    (0.006918 -
      0.399912 * Math.cos(gamma) +
      0.070257 * Math.sin(gamma) -
      0.006758 * Math.cos(2 * gamma) +
      0.000907 * Math.sin(2 * gamma) -
      0.002697 * Math.cos(3 * gamma) +
      0.00148 * Math.sin(3 * gamma))
  const rad = Math.PI / 180
  const cosAngle =
    (Math.sin(-0.8333 * rad) - Math.sin(latitude * rad) * Math.sin(declinaison * rad)) /
    (Math.cos(latitude * rad) * Math.cos(declinaison * rad))
  // Nuit ou jour polaire : pas de lever ni de coucher.
  if (cosAngle > 1) return { lever: 12, coucher: 12, duree: 0 }
  if (cosAngle < -1) return { lever: 0, coucher: 24, duree: 24 }
  const demiJour = Math.acos(cosAngle) / (15 * rad)
  return { lever: 12 - demiJour, coucher: 12 + demiJour, duree: 2 * demiJour }
}

/**
 * Températures des 24 heures de chaque jour, à la suite (24 × nombre de jours).
 * Les jours doivent se suivre sans trou. Le matin du premier jour et la soirée
 * du dernier, qui dépendent d'un voisin absent, prennent le minimum du jour.
 */
export function temperaturesHoraires(latitude: number, jours: readonly JourMinMax[]): number[] {
  const n = jours.length
  const sortie = new Array<number>(n * 24)
  const soleils = jours.map((j) => soleilDuJour(latitude, j.rang))

  for (let i = 0; i < n; i++) {
    const { tmin, tmax } = jours[i]
    const s = soleils[i]
    const base = i * 24

    if (s.duree === 0 || s.duree === 24) {
      sortie.fill((tmax + tmin) / 2, base, base + 24)
      continue
    }

    const precedent = i > 0 ? jours[i - 1] : null
    const suivant = i < n - 1 ? jours[i + 1] : null
    const coucherPrecedent = i > 0 ? soleils[i - 1].coucher : soleilDuJour(latitude, jours[i].rang - 1).coucher
    const leverSuivant = i < n - 1 ? soleils[i + 1].lever : soleilDuJour(latitude, jours[i].rang + 1).lever

    const tCoucher = tmin + (tmax - tmin) * Math.sin((Math.PI * (s.coucher - s.lever)) / (s.duree + 4))
    const tCoucherPrecedent = precedent
      ? precedent.tmin + (precedent.tmax - precedent.tmin) * Math.sin((Math.PI * s.duree) / (s.duree + 4))
      : null

    for (let h = 0; h < 24; h++) {
      let t: number
      if (h >= s.coucher) {
        t =
          suivant === null
            ? tmin
            : tCoucher -
              ((tCoucher - suivant.tmin) / Math.log(24 - (s.coucher - leverSuivant) + 1)) * Math.log(h - s.coucher + 1)
      } else if (h > s.lever) {
        t = tmin + (tmax - tmin) * Math.sin((Math.PI * (h - s.lever)) / (s.duree + 4))
      } else {
        t =
          tCoucherPrecedent === null
            ? tmin
            : tCoucherPrecedent -
              ((tCoucherPrecedent - tmin) / Math.log(Math.max(1, 24 - (coucherPrecedent - s.lever)))) *
                Math.log(h + 24 - coucherPrecedent + 1)
      }
      sortie[base + h] = t
    }
  }
  return sortie
}
