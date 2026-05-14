/**
 * Glossaire des termes métier de Gleba.
 *
 * Utilisé par <GlossaireTerm /> pour afficher des tooltips contextuels,
 * et potentiellement par une page Glossaire dans les parametres.
 *
 * Les clés sont normalisées en MAJUSCULES (ou la casse canonique du terme)
 * — la recherche est insensible à la casse via getGlossaireEntry().
 */

export interface GlossaireEntry {
  label: string
  definition: string
}

export const GLOSSAIRE: Record<string, GlossaireEntry> = {
  ITP: {
    label: "ITP — Itinéraire Technique de Production",
    definition:
      "Séquence type des étapes de culture d'une espèce : semis → repiquage → plantation → entretien → récolte. " +
      "Un ITP sert de modèle réutilisable pour planifier vos cultures.",
  },
  ZTP: {
    label: "ZTP — Zone Technique de Production",
    definition:
      "Regroupement géographique de planches partageant des caractéristiques similaires " +
      "(exposition, sol, irrigation). Sert à organiser vos rotations.",
  },
  Planche: {
    label: "Planche de culture",
    definition:
      "Bande de culture rectangulaire (typiquement 80 cm de large sur 10 m de long) " +
      "qui constitue l'unité de base d'un potager maraîcher.",
  },
  Rotation: {
    label: "Rotation des cultures",
    definition:
      "Plan pluriannuel qui consiste à ne pas cultiver la même famille botanique au même endroit " +
      "deux années de suite, afin de limiter maladies et épuisement du sol.",
  },
  "Famille botanique": {
    label: "Famille botanique",
    definition:
      "Regroupement d'espèces partageant des ravageurs et besoins nutritifs communs. " +
      "Exemple : Solanacées = tomates, aubergines, poivrons, pommes de terre.",
  },
  "Campagne de plantation": {
    label: "Campagne de plantation",
    definition:
      "Plantation en lot de N arbres ou plants sur une zone donnée (verger, haie, replantation forestière). " +
      "Permet de suivre la croissance et la mortalité d'une cohorte.",
  },
  "Régénération naturelle": {
    label: "Régénération naturelle",
    definition:
      "Repousse spontanée d'arbres sans intervention humaine (semis naturel à partir des arbres adultes). " +
      "Mode de gestion forestière à coût quasi nul.",
  },
  DAR: {
    label: "DAR — Délai Avant Récolte",
    definition:
      "Nombre de jours minimum à respecter entre l'application d'un traitement phytosanitaire " +
      "et la récolte de la culture concernée. Garantit la sécurité alimentaire.",
  },
  AMM: {
    label: "AMM — Autorisation de Mise sur le Marché",
    definition:
      "Numéro officiel attribué à chaque produit phytosanitaire autorisé en France. " +
      "À reporter sur le cahier d'enregistrement des traitements.",
  },
  TVA: {
    label: "TVA — Taxe sur la Valeur Ajoutée",
    definition:
      "Impôt indirect sur la consommation. En agriculture, les taux courants sont 5,5 % (produits alimentaires) " +
      "et 20 % (équipements, services).",
  },
  HT: {
    label: "HT — Hors Taxes",
    definition: "Montant avant application de la TVA. C'est le revenu réel encaissé par l'exploitant.",
  },
  TTC: {
    label: "TTC — Toutes Taxes Comprises",
    definition: "Montant final payé par le client, incluant la TVA. C'est le prix affiché en boutique.",
  },
  CA: {
    label: "CA — Chiffre d'Affaires",
    definition:
      "Somme des ventes HT sur une période (mois, trimestre, année). Ne correspond pas au bénéfice : " +
      "il faut en déduire les charges pour obtenir la marge.",
  },
  BRF: {
    label: "BRF — Bois Raméal Fragmenté",
    definition:
      "Broyat de jeunes branches utilisé comme paillage organique. Nourrit le sol, " +
      "limite l'évaporation et freine la pousse des adventices.",
  },
  MAEC: {
    label: "MAEC — Mesure Agro-Environnementale et Climatique",
    definition:
      "Aide PAC versée aux exploitants qui s'engagent sur des pratiques bénéfiques pour l'environnement " +
      "(haies, couverts végétaux, réduction des intrants…).",
  },
  "Auto-compta": {
    label: "Auto-compta — Comptabilité automatique",
    definition:
      "Génération automatique des écritures comptables (recettes, dépenses) à partir des ventes " +
      "et achats opérationnels enregistrés dans Gleba. Évite la double saisie.",
  },
  PAC: {
    label: "PAC — Politique Agricole Commune",
    definition:
      "Cadre européen de soutien à l'agriculture. Verse des aides aux exploitants selon la surface " +
      "et les pratiques (déclaration annuelle obligatoire).",
  },
  "Marge brute": {
    label: "Marge brute",
    definition:
      "Revenus moins dépenses directes liées à la production (semences, intrants, eau). " +
      "Ne tient pas compte des charges de structure (loyer, amortissement).",
  },
}

/**
 * Recherche une entrée du glossaire, insensible à la casse.
 */
export function getGlossaireEntry(term: string): GlossaireEntry | undefined {
  const direct = GLOSSAIRE[term]
  if (direct) return direct
  const normalized = term.trim().toLowerCase()
  const found = Object.entries(GLOSSAIRE).find(
    ([key]) => key.toLowerCase() === normalized
  )
  return found?.[1]
}

/**
 * Liste triée des entrées (utile pour une page Glossaire).
 */
export function listGlossaireEntries(): Array<{ key: string } & GlossaireEntry> {
  return Object.entries(GLOSSAIRE)
    .map(([key, value]) => ({ key, ...value }))
    .sort((a, b) => a.key.localeCompare(b.key, "fr"))
}
