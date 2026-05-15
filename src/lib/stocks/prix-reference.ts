/**
 * QA 2026-05-15 — Bug #12 : valorisation des stocks à 0 € sur la démo
 * (2 268 œufs, 12,5 kg pommes, 20 arbres…) parce que la route stocks
 * s'appuyait sur le prix moyen issu **des ventes observées de
 * l'utilisateur**. Si pas de vente → prix=null → valeur=0.
 *
 * Règle documentée :
 *   1. Si la `Recolte`/`ProductionOeuf` a un prixKg / prixUnitaire
 *      saisi → on prend cette valeur.
 *   2. Sinon, on prend la **moyenne des ventes** récentes (90 derniers
 *      jours) sur cette espèce/arbre.
 *   3. Sinon, on prend le **prix indicatif de référence** ci-dessous
 *      (sourcé FNAB / Réseau Vivea / mercuriales bio FR 2024-2025).
 *   4. Sinon, on affiche `null` (la UI montrera "—" plutôt qu'un faux 0).
 *
 * Les prix sont **indicatifs** et peuvent être surchargés via la
 * saisie d'un prix de vente réel sur n'importe quelle Recolte.
 */

/** Prix de référence €/kg pour la production maraîchère. */
const PRIX_REF_KG: Record<string, number> = {
  // Légumes feuilles
  "Salade": 4.0,
  "Laitue": 4.0,
  "Mâche": 18.0,
  "Roquette": 14.0,
  "Épinard": 6.0,
  "Blette": 3.5,
  // Solanacées
  "Tomate": 5.5,
  "Poivron": 6.5,
  "Aubergine": 5.5,
  "Pomme de terre": 2.0,
  // Cucurbitacées
  "Courgette": 3.0,
  "Concombre": 3.5,
  "Courge": 2.5,
  "Potimarron": 2.8,
  "Butternut": 2.8,
  "Melon": 4.5,
  // Racines / Bulbes
  "Carotte": 2.5,
  "Radis": 4.0,
  "Betterave": 3.0,
  "Navet": 3.0,
  "Oignon": 3.0,
  "Ail": 12.0,
  "Échalote": 8.0,
  "Poireau": 3.5,
  // Légumineuses
  "Petit pois": 6.0,
  "Pois": 6.0,
  "Haricot vert": 7.0,
  "Haricot": 7.0,
  "Fève": 5.0,
  // Brassicacées
  "Chou": 3.0,
  "Chou pommé": 3.0,
  "Chou-fleur": 3.5,
  "Chou brocoli": 4.5,
  "Chou kale": 5.0,
  // Aromatiques
  "Basilic": 30.0,
  "Persil": 18.0,
  "Coriandre": 22.0,
  "Aneth": 22.0,
  // Fruits du verger (au kg)
  "Pommier": 3.0,
  "Poirier": 3.5,
  "Cerisier": 8.0,
  "Prunier": 5.0,
  "Pêcher": 5.0,
  "Abricotier": 6.0,
  "Figuier": 8.0,
}

/** Prix de référence pour la production animale. */
export const PRIX_REF_OEUF_UNITAIRE = 0.45 // €/œuf en bio direct producteur

/**
 * Retourne le prix indicatif €/kg pour une espèce maraîchère/fruitière.
 * Renvoie null si l'espèce n'a pas de barème (on garde un null explicite
 * pour ne pas masquer l'absence de donnée).
 */
export function prixReferenceKg(especeId: string | null | undefined): number | null {
  if (!especeId) return null
  // Match exact
  if (PRIX_REF_KG[especeId] != null) return PRIX_REF_KG[especeId]
  // Match insensible à la casse / accents
  const norm = especeId.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
  for (const [key, prix] of Object.entries(PRIX_REF_KG)) {
    if (key.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "") === norm) {
      return prix
    }
  }
  return null
}
