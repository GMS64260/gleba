/**
 * Cellule « Localisation » du registre phytosanitaire à l'écran.
 *
 * Contre-revue CR-PHY-03 (tour 2) : le tableau n'affichait que le nom de
 * planche relu de la fiche actuelle (« Non renseigné » pour un traitement
 * d'arbre) et ignorait la localisation et la conduite biologique FIGÉES au
 * jour du traitement, pourtant fournies par `genererRegistrePhyto` et
 * restituées par l'export. L'écran, le CSV et le PDF lisent désormais la
 * même valeur.
 *
 * Ligne ancienne, jamais figée (aucune reprise par déduction) : la valeur est
 * relue des fiches actuelles, et l'écran le dit.
 */
export interface LieuRegistre {
  parcelle: string
  localisation: string
  /** Localisation réglementaire : figée si `contexteFige`, sinon relue des fiches. */
  localisationReglementaire?: string | null
  conduiteBio?: boolean | null
  contexteFige?: boolean
}

const NON_RENSEIGNE = "Non renseigné"

export function LieuTraitementRegistre({ entry }: { entry: LieuRegistre }) {
  const reglementaire = entry.localisationReglementaire?.trim() || null
  const fige = entry.contexteFige === true
  const parcelle = entry.parcelle && entry.parcelle !== NON_RENSEIGNE ? entry.parcelle : null
  const bio = entry.conduiteBio == null ? null : entry.conduiteBio ? "Conduite biologique" : "Conduite non biologique"

  if (fige) {
    return (
      <>
        {reglementaire ?? NON_RENSEIGNE}
        {bio && <span className="text-xs text-slate-500 block">{bio}</span>}
      </>
    )
  }

  const detail = reglementaire ?? (entry.localisation || null)
  return (
    <>
      {parcelle ?? (detail ? null : NON_RENSEIGNE)}
      {detail && <span className={parcelle ? "text-xs text-slate-500 block" : undefined}>{detail}</span>}
      {bio && <span className="text-xs text-slate-500 block">{bio}</span>}
      {(reglementaire || bio) && (
        <span className="text-xs text-amber-700 block">
          Fiche actuelle : ligne enregistrée avant la conservation de la localisation du jour
        </span>
      )}
    </>
  )
}
