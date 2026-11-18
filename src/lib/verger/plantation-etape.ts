interface EtatEtape {
  type: string
  dateRealisation: Date | null
}

interface EtatCampagne {
  statut: string
  datePlantationReelle: Date | null
}

/** À calculer sur l'étape et la campagne relues sous verrou. */
export function resoudrePlantationEtape(
  etape: EtatEtape,
  campagne: EtatCampagne,
  changement: { type?: string; fait?: boolean; dateRealisation?: Date | null },
  maintenant = new Date(),
): { dateRealisation: Date | null | undefined; campagne: EtatCampagne | null } {
  if ((changement.type ?? etape.type) !== "plantation" || changement.fait === undefined) {
    return { dateRealisation: changement.dateRealisation, campagne: null }
  }

  // Une seule date pour les deux lignes ; un rejeu réutilise la date persistée.
  const dateRealisation = changement.fait
    ? changement.dateRealisation ?? etape.dateRealisation ?? maintenant
    : null
  let suivante: EtatCampagne | null = null
  if (changement.fait) {
    suivante = {
      datePlantationReelle: dateRealisation,
      statut: ["planifiee", "prep_sol"].includes(campagne.statut) ? "plantation" : campagne.statut,
    }
  } else if (etape.dateRealisation && campagne.datePlantationReelle
    && etape.dateRealisation.getTime() === campagne.datePlantationReelle.getTime()) {
    // Convention existante : seules des dates identiques rattachent la date
    // de campagne à cette étape. Une autre date saisie reste indépendante.
    suivante = {
      datePlantationReelle: null,
      statut: ["terminee", "echec"].includes(campagne.statut) ? campagne.statut : "planifiee",
    }
  }
  if (suivante?.statut === campagne.statut
    && suivante.datePlantationReelle?.getTime() === campagne.datePlantationReelle?.getTime()) {
    suivante = null
  }
  return { dateRealisation, campagne: suivante }
}
