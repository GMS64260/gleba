/**
 * Catalogue Gleba officiel des filières « compagnie / équin / NAC »
 * (Phase 0 des modes d'élevage) : espèces **et** races/variétés associées.
 *
 * Pourquoi ici et pas dans le seed : le contenu est du référentiel métier, il
 * doit être testable (cohérence des ids, libellés d'espèce de base, unicité des
 * races) sans ouvrir de connexion Prisma. Les seeds l'importent :
 *   - `prisma/seed-especes-compagnie.ts` → especes_animales
 *   - `prisma/seed-races-compagnie.ts`   → races_animales
 *
 * Conventions
 * - `id` = espèce de base (préfixe avant `_`, cf. `espece-base.ts`), sans
 *   accent ni majuscule. Tout nouveau préfixe doit avoir son libellé FR dans
 *   `espece-base.ts` (couvert par le test).
 * - Le token `production` n'a pas de sens hors rente : le seed stocke la valeur
 *   neutre "compagnie" (masquée par l'UI, cf. `filiere-ui.ts`). Ce qui compte
 *   est `filiere`.
 * - Le modèle espèce/race est volontairement souple (comme pour la rente où
 *   « Lacaune » est une race d'ovin) : pour les NAC on range sous « race » ce
 *   que le milieu appelle variété, morph ou type — c'est le niveau que
 *   l'éleveur saisit sur une fiche animal.
 *
 * cf. docs/elevage-modes-phase0-spec.md
 */

import type { Filiere } from "./filiere"

export type TypeEspece = "volaille" | "mammifere_petit" | "mammifere_grand" | "autre"

export type EspeceCatalogue = {
  id: string
  nom: string
  type: TypeEspece
  /** Filière métier — jamais `rente` dans ce catalogue. */
  filiere: Exclude<Filiere, "rente">
  categorieReglementaire: string
  /** Jours (mammifères). */
  dureeGestation?: number
  /** Jours (oiseaux, reptiles : incubation). */
  dureeCouvaison?: number
  /** kg. */
  poidsAdulte?: number
  couleur?: string
  description?: string
}

export type RaceCatalogue = {
  nom: string
  /** Pays/région d'origine du standard (null pour une variété de couleur). */
  origine?: string
  /** Tokens libres consommés par les filtres : compagnie, garde, chasse, variété… */
  aptitudes?: string[]
  description?: string
}

// ————————————————————————————————————————————————————————————————
// Espèces
// ————————————————————————————————————————————————————————————————

export const ESPECES_COMPAGNIE: EspeceCatalogue[] = [
  // — Compagnie (chiens & chats) —
  { id: "chien", nom: "Chien", type: "mammifere_grand", filiere: "compagnie", categorieReglementaire: "Carnivore domestique", dureeGestation: 63, poidsAdulte: 25, couleur: "#8b5e3c", description: "Élevage canin. Identification I-CAD obligatoire avant 4 mois ; races au LOF (SCC)." },
  { id: "chat", nom: "Chat", type: "mammifere_petit", filiere: "compagnie", categorieReglementaire: "Carnivore domestique", dureeGestation: 65, poidsAdulte: 4, couleur: "#6b7280", description: "Élevage félin. Identification I-CAD obligatoire avant 7 mois ; races au LOOF." },

  // — Équins (régime SIRE/IFCE) —
  { id: "cheval", nom: "Cheval", type: "mammifere_grand", filiere: "equin", categorieReglementaire: "Équin", dureeGestation: 340, poidsAdulte: 500, couleur: "#7c5a3a", description: "Équidé : carte d'immatriculation SIRE, transpondeur et document d'identification obligatoires." },
  { id: "poney", nom: "Poney", type: "mammifere_grand", filiere: "equin", categorieReglementaire: "Équin", dureeGestation: 335, poidsAdulte: 300, couleur: "#a1724a", description: "Équidé de taille ≤ 1,48 m au garrot (toisage SIRE). Mêmes obligations d'identification que le cheval." },
  { id: "ane", nom: "Âne", type: "mammifere_grand", filiere: "equin", categorieReglementaire: "Équin", dureeGestation: 365, poidsAdulte: 250, couleur: "#9ca3af", description: "Équidé. Gestation longue (≈ 12 mois). Identification SIRE." },
  { id: "mulet", nom: "Mulet / Bardot", type: "mammifere_grand", filiere: "equin", categorieReglementaire: "Équin", dureeGestation: 350, poidsAdulte: 400, couleur: "#8a8578", description: "Hybride âne × cheval, stérile : pas de reproduction attendue. Immatriculation SIRE en tant qu'équidé." },

  // — NAC : mammifères —
  { id: "furet", nom: "Furet", type: "mammifere_petit", filiere: "nac", categorieReglementaire: "Carnivore domestique", dureeGestation: 42, poidsAdulte: 1.2, couleur: "#d6c39a", description: "Mustélidé de compagnie : identification I-CAD et vaccination rage recommandées (obligatoires pour voyager)." },
  { id: "lapin_nain", nom: "Lapin nain", type: "mammifere_petit", filiere: "nac", categorieReglementaire: "Autre", dureeGestation: 31, poidsAdulte: 1.5, couleur: "#c4b5a0", description: "Lagomorphe de compagnie. Vaccination myxomatose/VHD conseillée en élevage." },
  { id: "cobaye", nom: "Cochon d'Inde", type: "mammifere_petit", filiere: "nac", categorieReglementaire: "Autre", dureeGestation: 68, poidsAdulte: 1, couleur: "#c98b5e", description: "Rongeur de compagnie. Gestation longue, petits nidicoles autonomes." },
  { id: "hamster", nom: "Hamster", type: "mammifere_petit", filiere: "nac", categorieReglementaire: "Autre", dureeGestation: 18, poidsAdulte: 0.15, couleur: "#e0b06b", description: "Rongeur de compagnie, solitaire (le doré surtout) : loger séparément après sevrage." },
  { id: "rat", nom: "Rat domestique", type: "mammifere_petit", filiere: "nac", categorieReglementaire: "Autre", dureeGestation: 22, poidsAdulte: 0.45, couleur: "#94a3b8", description: "Rongeur social de compagnie (Rattus norvegicus domestica) : à maintenir en groupe de même sexe." },
  { id: "souris", nom: "Souris domestique", type: "mammifere_petit", filiere: "nac", categorieReglementaire: "Autre", dureeGestation: 20, poidsAdulte: 0.03, couleur: "#cbd5e1", description: "Rongeur de compagnie. Maturité très précoce (5-6 semaines) : séparer les sexes tôt." },
  { id: "gerbille", nom: "Gerbille", type: "mammifere_petit", filiere: "nac", categorieReglementaire: "Autre", dureeGestation: 25, poidsAdulte: 0.08, couleur: "#d9a86c", description: "Gerbille de Mongolie : rongeur diurne, vit en couple stable ou en fratrie." },
  { id: "chinchilla", nom: "Chinchilla", type: "mammifere_petit", filiere: "nac", categorieReglementaire: "Autre", dureeGestation: 111, poidsAdulte: 0.6, couleur: "#a8a29e", description: "Rongeur de compagnie : gestation longue (≈ 111 j), petits nés déjà poilus et autonomes. Bain de sable indispensable." },
  { id: "octodon", nom: "Octodon (dègue du Chili)", type: "mammifere_petit", filiere: "nac", categorieReglementaire: "Autre", dureeGestation: 90, poidsAdulte: 0.25, couleur: "#b08968", description: "Rongeur diurne social. Prédisposition au diabète : aucun aliment sucré." },
  { id: "cochon_nain", nom: "Cochon nain", type: "mammifere_grand", filiere: "nac", categorieReglementaire: "Porcin", dureeGestation: 114, poidsAdulte: 70, couleur: "#e8b4b8", description: "Suidé : détention soumise à déclaration (EDE/BDPORC), interdiction de nourrir avec des déchets de cuisine. Poids adulte souvent très sous-estimé." },

  // — NAC : oiseaux —
  { id: "perruche", nom: "Perruche", type: "autre", filiere: "nac", categorieReglementaire: "Autre", dureeCouvaison: 18, poidsAdulte: 0.04, couleur: "#4ade80", description: "Oiseau d'ornement. Élevage en volière ; marquage par bague fermée pour la traçabilité des jeunes." },
  { id: "calopsitte", nom: "Calopsitte élégante", type: "autre", filiere: "nac", categorieReglementaire: "Autre", dureeCouvaison: 19, poidsAdulte: 0.1, couleur: "#fbbf24", description: "Perruche huppée d'Australie. Couples reproducteurs stables, 4-6 œufs par couvée." },
  { id: "inseparable", nom: "Inséparable", type: "autre", filiere: "nac", categorieReglementaire: "Autre", dureeCouvaison: 23, poidsAdulte: 0.05, couleur: "#34d399", description: "Agapornis : petit psittacidé vivant en couple. Bague fermée conseillée pour les jeunes." },
  { id: "perroquet", nom: "Perroquet", type: "autre", filiere: "nac", categorieReglementaire: "Autre", dureeCouvaison: 28, poidsAdulte: 0.45, couleur: "#38bdf8", description: "Psittacidé de grande taille : espèces majoritairement CITES (annexe I ou II) — marquage, registre d'élevage et certificats de cession obligatoires." },
  { id: "canari", nom: "Canari", type: "autre", filiere: "nac", categorieReglementaire: "Autre", dureeCouvaison: 14, poidsAdulte: 0.02, couleur: "#facc15", description: "Oiseau d'ornement (chant, posture, couleur). 2 à 3 couvées par saison." },
  { id: "mandarin", nom: "Diamant mandarin", type: "autre", filiere: "nac", categorieReglementaire: "Autre", dureeCouvaison: 14, poidsAdulte: 0.013, couleur: "#fb923c", description: "Estrildidé grégaire, reproduction facile en volière. Limiter les couvées à 3 par an." },

  // — NAC : reptiles & amphibiens —
  { id: "tortue_terrestre", nom: "Tortue terrestre", type: "autre", filiere: "nac", categorieReglementaire: "Autre", dureeCouvaison: 90, poidsAdulte: 3, couleur: "#84cc16", description: "Espèces CITES : registre d'élevage (i-Fap/AFB), marquage et déclaration de détention obligatoires selon l'espèce et le nombre. Hibernation à respecter." },
  { id: "gecko_leopard", nom: "Gecko léopard", type: "autre", filiere: "nac", categorieReglementaire: "Autre", dureeCouvaison: 50, poidsAdulte: 0.07, couleur: "#fcd34d", description: "Eublepharis macularius : reptile terrestre nocturne, détermination du sexe par la température d'incubation." },
  { id: "gecko_crete", nom: "Gecko à crête", type: "autre", filiere: "nac", categorieReglementaire: "Autre", dureeCouvaison: 65, poidsAdulte: 0.045, couleur: "#f97316", description: "Correlophus ciliatus : arboricole, pontes de 2 œufs répétées sur la saison." },
  { id: "pogona", nom: "Agame barbu (Pogona)", type: "autre", filiere: "nac", categorieReglementaire: "Autre", dureeCouvaison: 60, poidsAdulte: 0.45, couleur: "#f59e0b", description: "Pogona vitticeps : lézard diurne héliophile (UVB indispensables). Pontes de 15-25 œufs." },
  { id: "serpent_des_bles", nom: "Serpent des blés", type: "autre", filiere: "nac", categorieReglementaire: "Autre", dureeCouvaison: 60, poidsAdulte: 0.9, couleur: "#ef4444", description: "Pantherophis guttatus : colubridé non venimeux, l'espèce d'initiation. Ponte après cycle hivernal." },
  { id: "python_royal", nom: "Python royal", type: "autre", filiere: "nac", categorieReglementaire: "Autre", dureeCouvaison: 55, poidsAdulte: 1.8, couleur: "#78350f", description: "Python regius : CITES annexe II (certificat de cession). Éviter les morphs à troubles neurologiques (type « spider ») en sélection." },
  { id: "axolotl", nom: "Axolotl", type: "autre", filiere: "nac", categorieReglementaire: "Autre", dureeCouvaison: 15, poidsAdulte: 0.12, couleur: "#f9a8d4", description: "Amphibien néotène aquatique (Ambystoma mexicanum), CITES annexe II. Eau fraîche 16-18 °C, jamais de gravier ingérable." },
]

// ————————————————————————————————————————————————————————————————
// Races / variétés
// ————————————————————————————————————————————————————————————————

/** Race inscrite à un livre généalogique (LOF, LOOF, SIRE, standards FCI…). */
const r = (nom: string, origine: string, aptitudes: string[], description?: string): RaceCatalogue => ({
  nom,
  origine,
  aptitudes,
  ...(description ? { description } : {}),
})

/** Variété, morph ou type : même modèle en base, mais pas un standard de race. */
const v = (nom: string, description?: string): RaceCatalogue => ({
  nom,
  aptitudes: ["variété"],
  ...(description ? { description } : {}),
})

const RACES_CHIEN: RaceCatalogue[] = [
  // Bergers & bouviers
  r("Berger allemand", "Allemagne", ["garde", "utilitaire", "sport"]),
  r("Berger belge Malinois", "Belgique", ["garde", "utilitaire", "sport"]),
  r("Berger belge Tervueren", "Belgique", ["garde", "sport", "compagnie"]),
  r("Berger belge Groenendael", "Belgique", ["garde", "sport", "compagnie"]),
  r("Berger australien", "États-Unis", ["troupeau", "sport", "compagnie"]),
  r("Border collie", "Royaume-Uni", ["troupeau", "sport"]),
  r("Beauceron", "France", ["garde", "troupeau"]),
  r("Briard", "France", ["troupeau", "garde"]),
  r("Berger des Pyrénées", "France", ["troupeau"]),
  r("Montagne des Pyrénées", "France", ["garde troupeau"], "Patou : chien de protection de troupeau."),
  r("Berger blanc suisse", "Suisse", ["compagnie", "sport"]),
  r("Colley à poil long", "Royaume-Uni", ["compagnie", "troupeau"]),
  r("Shetland (Sheltie)", "Royaume-Uni", ["troupeau", "compagnie", "sport"]),
  r("Welsh corgi Pembroke", "Royaume-Uni", ["troupeau", "compagnie"]),
  r("Bouvier bernois", "Suisse", ["compagnie", "garde"]),
  r("Bouvier des Flandres", "Belgique", ["garde", "troupeau"]),
  r("Chien-loup tchécoslovaque", "Tchéquie", ["sport", "compagnie"]),
  // Pinschers, schnauzers & molossoïdes
  r("Rottweiler", "Allemagne", ["garde", "utilitaire"], "Chien de 2e catégorie (loi du 6 janvier 1999) : permis de détention, muselière et laisse sur la voie publique."),
  r("Doberman", "Allemagne", ["garde", "sport"]),
  r("Boxer", "Allemagne", ["compagnie", "garde"]),
  r("Schnauzer moyen", "Allemagne", ["compagnie", "garde"]),
  r("Dogue allemand", "Allemagne", ["compagnie", "garde"]),
  r("Dogue de Bordeaux", "France", ["garde", "compagnie"]),
  r("Cane corso", "Italie", ["garde"]),
  r("Mastiff", "Royaume-Uni", ["garde"], "Non inscrit au LOF, relève de la 1re catégorie (élevage interdit)."),
  r("Bullmastiff", "Royaume-Uni", ["garde"]),
  r("Tosa", "Japon", ["garde"], "2e catégorie si inscrit au LOF, 1re catégorie sinon (élevage interdit)."),
  r("Terre-Neuve", "Canada", ["eau", "compagnie", "secours"]),
  r("Saint-Bernard", "Suisse", ["compagnie", "secours"]),
  r("Léonberg", "Allemagne", ["compagnie", "eau"]),
  r("Bouledogue français", "France", ["compagnie"], "Race brachycéphale : surveiller la tolérance à l'effort et à la chaleur."),
  r("Bulldog anglais", "Royaume-Uni", ["compagnie"], "Race brachycéphale ; mise-bas souvent par césarienne."),
  r("Shar peï", "Chine", ["compagnie", "garde"]),
  // Terriers
  r("American Staffordshire terrier", "États-Unis", ["compagnie", "sport"], "2e catégorie si inscrit au LOF, 1re catégorie sinon (élevage interdit)."),
  r("Staffordshire bull terrier", "Royaume-Uni", ["compagnie", "sport"]),
  r("Bull terrier", "Royaume-Uni", ["compagnie"]),
  r("Jack Russell terrier", "Royaume-Uni", ["chasse", "compagnie", "sport"]),
  r("Parson Russell terrier", "Royaume-Uni", ["chasse", "compagnie"]),
  r("Fox terrier à poil dur", "Royaume-Uni", ["chasse", "compagnie"]),
  r("Yorkshire terrier", "Royaume-Uni", ["compagnie"]),
  r("West Highland white terrier", "Royaume-Uni", ["compagnie"]),
  r("Cairn terrier", "Royaume-Uni", ["compagnie", "chasse"]),
  r("Scottish terrier", "Royaume-Uni", ["compagnie"]),
  r("Airedale terrier", "Royaume-Uni", ["utilitaire", "compagnie"]),
  // Teckels & chiens courants
  r("Teckel poil ras", "Allemagne", ["chasse", "compagnie"]),
  r("Teckel poil long", "Allemagne", ["chasse", "compagnie"]),
  r("Teckel poil dur", "Allemagne", ["chasse", "compagnie"]),
  r("Beagle", "Royaume-Uni", ["chasse", "compagnie"]),
  r("Basset hound", "Royaume-Uni", ["chasse", "compagnie"]),
  r("Basset artésien normand", "France", ["chasse"]),
  r("Grand bleu de Gascogne", "France", ["chasse"]),
  r("Griffon nivernais", "France", ["chasse"]),
  r("Rhodesian ridgeback", "Afrique du Sud", ["chasse", "garde", "compagnie"]),
  // Chiens d'arrêt
  r("Épagneul breton", "France", ["chasse", "compagnie"]),
  r("Épagneul français", "France", ["chasse"]),
  r("Braque français type Pyrénées", "France", ["chasse"]),
  r("Braque allemand à poil court", "Allemagne", ["chasse", "sport"]),
  r("Braque hongrois (Vizsla)", "Hongrie", ["chasse", "sport"]),
  r("Griffon Korthals", "France", ["chasse"]),
  r("Weimaraner", "Allemagne", ["chasse", "sport"]),
  r("Setter anglais", "Royaume-Uni", ["chasse"]),
  r("Setter irlandais rouge", "Irlande", ["chasse"]),
  r("Pointer", "Royaume-Uni", ["chasse"]),
  // Rapporteurs, leveurs & chiens d'eau
  r("Labrador retriever", "Royaume-Uni", ["compagnie", "chasse", "assistance"]),
  r("Golden retriever", "Royaume-Uni", ["compagnie", "assistance", "chasse"]),
  r("Retriever de la Nouvelle-Écosse", "Canada", ["chasse", "sport"]),
  r("Cocker anglais", "Royaume-Uni", ["chasse", "compagnie"]),
  r("Cocker américain", "États-Unis", ["compagnie"]),
  r("Springer anglais", "Royaume-Uni", ["chasse"]),
  r("Barbet", "France", ["eau", "chasse", "compagnie"]),
  r("Caniche", "France", ["compagnie", "sport"], "Quatre tailles : toy, nain, moyen, grand."),
  // Chiens d'agrément
  r("Cavalier King Charles spaniel", "Royaume-Uni", ["compagnie"]),
  r("Chihuahua", "Mexique", ["compagnie"]),
  r("Bichon frisé", "France", ["compagnie"]),
  r("Bichon maltais", "Italie", ["compagnie"]),
  r("Coton de Tuléar", "Madagascar", ["compagnie"]),
  r("Carlin", "Chine", ["compagnie"], "Race brachycéphale : surveiller respiration et chaleur."),
  r("Shih tzu", "Chine", ["compagnie"]),
  r("Lhassa apso", "Tibet", ["compagnie"]),
  r("Spitz nain (poméranien)", "Allemagne", ["compagnie"]),
  r("Épagneul nain continental (papillon)", "France", ["compagnie", "sport"]),
  r("Boston terrier", "États-Unis", ["compagnie"]),
  r("Dalmatien", "Croatie", ["compagnie", "sport"]),
  // Spitz & primitifs
  r("Husky sibérien", "États-Unis", ["traîneau", "sport"]),
  r("Malamute d'Alaska", "États-Unis", ["traîneau"]),
  r("Samoyède", "Russie", ["traîneau", "compagnie"]),
  r("Akita inu", "Japon", ["compagnie", "garde"]),
  r("Shiba inu", "Japon", ["compagnie"]),
  r("Basenji", "Afrique centrale", ["chasse", "compagnie"]),
  // Lévriers
  r("Whippet", "Royaume-Uni", ["course", "compagnie"]),
  r("Greyhound", "Royaume-Uni", ["course"]),
  r("Barzoï", "Russie", ["course", "compagnie"]),
]

const RACES_CHAT: RaceCatalogue[] = [
  r("Européen (celtic shorthair)", "Europe", ["compagnie"]),
  r("Maine coon", "États-Unis", ["compagnie"], "Poil long. Dépister HCM et dysplasie de la hanche."),
  r("Sacré de Birmanie", "France", ["compagnie"], "Poil long, colourpoint aux gants blancs."),
  r("Ragdoll", "États-Unis", ["compagnie"], "Poil long. Dépistage HCM conseillé."),
  r("Ragamuffin", "États-Unis", ["compagnie"]),
  r("Bengal", "États-Unis", ["compagnie"], "Issu d'hybridation ancienne : générations F1-F4 réglementées, F5+ domestiques."),
  r("Savannah", "États-Unis", ["compagnie"], "Hybride de serval : F1-F4 relèvent de la faune non domestique (autorisation de détention)."),
  r("Chausie", "États-Unis", ["compagnie"]),
  r("British shorthair", "Royaume-Uni", ["compagnie"]),
  r("British longhair", "Royaume-Uni", ["compagnie"]),
  r("Chartreux", "France", ["compagnie"]),
  r("Persan", "Iran", ["compagnie"], "Brachycéphale à poil long : dépistage PKD, entretien quotidien."),
  r("Exotic shorthair", "États-Unis", ["compagnie"]),
  r("Sphynx", "Canada", ["compagnie"], "Sans poil : besoins thermiques et nettoyage cutané spécifiques."),
  r("Peterbald", "Russie", ["compagnie"]),
  r("Donskoy", "Russie", ["compagnie"]),
  r("Siamois", "Thaïlande", ["compagnie"]),
  r("Thaï", "Thaïlande", ["compagnie"]),
  r("Oriental", "Royaume-Uni", ["compagnie"]),
  r("Balinais", "États-Unis", ["compagnie"]),
  r("Tonkinois", "Canada", ["compagnie"]),
  r("Burmese", "Birmanie", ["compagnie"]),
  r("Bombay", "États-Unis", ["compagnie"]),
  r("Abyssin", "Éthiopie", ["compagnie"]),
  r("Somali", "États-Unis", ["compagnie"]),
  r("Norvégien", "Norvège", ["compagnie"], "Poil long, très rustique."),
  r("Sibérien", "Russie", ["compagnie"], "Poil long, rustique."),
  r("Neva Masquerade", "Russie", ["compagnie"], "Variété colourpoint du sibérien."),
  r("Angora turc", "Turquie", ["compagnie"]),
  r("Turc de Van", "Turquie", ["compagnie"]),
  r("Bleu russe", "Russie", ["compagnie"]),
  r("Nebelung", "États-Unis", ["compagnie"]),
  r("Korat", "Thaïlande", ["compagnie"]),
  r("Mau égyptien", "Égypte", ["compagnie"]),
  r("Ocicat", "États-Unis", ["compagnie"]),
  r("Devon rex", "Royaume-Uni", ["compagnie"]),
  r("Cornish rex", "Royaume-Uni", ["compagnie"]),
  r("German rex", "Allemagne", ["compagnie"]),
  r("Selkirk rex", "États-Unis", ["compagnie"]),
  r("LaPerm", "États-Unis", ["compagnie"]),
  r("Scottish fold", "Royaume-Uni", ["compagnie"], "Oreilles pliées liées à une ostéochondrodysplasie : mariage fold × straight imposé."),
  r("Scottish straight", "Royaume-Uni", ["compagnie"]),
  r("Highland fold", "Royaume-Uni", ["compagnie"]),
  r("Highland straight", "Royaume-Uni", ["compagnie"]),
  r("American curl", "États-Unis", ["compagnie"]),
  r("American shorthair", "États-Unis", ["compagnie"]),
  r("Manx", "Île de Man", ["compagnie"], "Anomalie caudale : ne jamais accoupler deux sujets sans queue."),
  r("Snowshoe", "États-Unis", ["compagnie"]),
  r("Singapura", "Singapour", ["compagnie"]),
  r("Pixie-bob", "États-Unis", ["compagnie"]),
  r("Sokoké", "Kenya", ["compagnie"]),
  r("Khao Manee", "Thaïlande", ["compagnie"]),
]

const RACES_CHEVAL: RaceCatalogue[] = [
  // Selle & sport
  r("Selle français", "France", ["selle", "sport", "obstacle"]),
  r("Anglo-arabe", "France", ["selle", "sport", "endurance"]),
  r("Pur-sang arabe", "Péninsule arabique", ["endurance", "selle"]),
  r("Pur-sang anglais", "Royaume-Uni", ["course", "selle"]),
  r("AQPS", "France", ["course", "selle"], "Autre que pur-sang : cheval de course d'obstacle."),
  r("Trotteur français", "France", ["course", "attelage"]),
  r("Hanovrien", "Allemagne", ["sport", "dressage"]),
  r("Holsteiner", "Allemagne", ["sport", "obstacle"]),
  r("Oldenbourg", "Allemagne", ["sport", "dressage"]),
  r("Westphalien", "Allemagne", ["sport", "dressage"]),
  r("Trakehner", "Allemagne", ["sport", "dressage"]),
  r("KWPN", "Pays-Bas", ["sport", "obstacle"]),
  r("Lusitanien", "Portugal", ["dressage", "travail", "selle"]),
  r("Pure race espagnole (PRE)", "Espagne", ["dressage", "selle"]),
  r("Frison", "Pays-Bas", ["attelage", "dressage", "spectacle"]),
  r("Akhal-Téké", "Turkménistan", ["endurance", "selle"]),
  r("Barbe", "Maghreb", ["selle", "endurance"]),
  r("Arabe-barbe", "Maghreb", ["selle", "endurance"]),
  // Western & loisir
  r("Quarter horse", "États-Unis", ["western", "loisir"]),
  r("Paint horse", "États-Unis", ["western", "loisir"]),
  r("Appaloosa", "États-Unis", ["western", "loisir"]),
  r("Criollo", "Argentine", ["western", "endurance"]),
  r("Irish cob", "Irlande", ["loisir", "attelage"]),
  r("Curly", "États-Unis", ["loisir"], "Poil bouclé, souvent mieux toléré par les personnes allergiques."),
  // Races françaises rustiques & de trait
  r("Camargue", "France", ["travail", "loisir"], "Race rustique élevée en manade."),
  r("Mérens", "France", ["loisir", "randonnée"], "Cheval de montagne ariégeois, très rustique."),
  r("Castillonnais", "France", ["loisir", "attelage"]),
  r("Henson", "France", ["loisir", "randonnée"]),
  r("Comtois", "France", ["trait", "attelage"]),
  r("Percheron", "France", ["trait", "attelage"]),
  r("Breton", "France", ["trait", "attelage"]),
  r("Ardennais", "France", ["trait"]),
  r("Trait du Nord", "France", ["trait"]),
  r("Boulonnais", "France", ["trait"]),
  r("Auxois", "France", ["trait"]),
  r("Cob normand", "France", ["attelage", "loisir"]),
  r("Trait poitevin mulassier", "France", ["trait", "mulassier"], "Race support de la production mulassière avec le baudet du Poitou."),
  r("Haflinger", "Autriche", ["loisir", "attelage"]),
  r("Fjord", "Norvège", ["loisir", "attelage"]),
  r("Islandais", "Islande", ["loisir", "randonnée"], "Allures supplémentaires (tölt)."),
]

const RACES_PONEY: RaceCatalogue[] = [
  r("Poney français de selle", "France", ["poney-club", "sport"]),
  r("Connemara", "Irlande", ["sport", "poney-club"]),
  r("New forest", "Royaume-Uni", ["poney-club", "sport"]),
  r("Welsh mountain (section A)", "Royaume-Uni", ["poney-club"]),
  r("Welsh poney (section B)", "Royaume-Uni", ["poney-club", "sport"]),
  r("Welsh poney de type cob (section C)", "Royaume-Uni", ["attelage", "loisir"]),
  r("Welsh cob (section D)", "Royaume-Uni", ["attelage", "sport"]),
  r("Shetland", "Royaume-Uni", ["poney-club", "attelage"]),
  r("Dartmoor", "Royaume-Uni", ["poney-club"]),
  r("Exmoor", "Royaume-Uni", ["loisir"], "Poney primitif très rustique."),
  r("Highland", "Royaume-Uni", ["loisir", "attelage"]),
  r("Fell", "Royaume-Uni", ["loisir", "attelage"]),
  r("Landais", "France", ["loisir"], "Race française à petits effectifs."),
  r("Pottok", "France", ["loisir", "randonnée"], "Poney basque rustique."),
  r("Poney des Amériques", "États-Unis", ["western", "poney-club"]),
  r("Poney de selle allemand", "Allemagne", ["sport", "poney-club"]),
]

const RACES_ANE: RaceCatalogue[] = [
  r("Baudet du Poitou", "France", ["mulassier", "trait"], "Race à très petits effectifs, support de la production mulassière."),
  r("Âne normand", "France", ["attelage", "bât"]),
  r("Âne du Cotentin", "France", ["attelage", "bât"]),
  r("Âne de Provence", "France", ["bât", "randonnée"]),
  r("Âne des Pyrénées", "France", ["bât", "randonnée"]),
  r("Âne du Bourbonnais", "France", ["attelage", "bât"]),
  r("Grand noir du Berry", "France", ["attelage", "trait"]),
  // Sans standard : pas d'origine renseignée.
  { nom: "Âne commun", aptitudes: ["compagnie", "débroussaillage"], description: "Sans race définie : immatriculation SIRE en « origine constatée »." },
  r("Âne miniature méditerranéen", "Italie", ["compagnie"]),
]

const RACES_MULET: RaceCatalogue[] = [
  r("Mulet poitevin", "France", ["trait", "bât"]),
  r("Mule des Pyrénées", "France", ["bât", "randonnée"]),
  r("Bardot", "France", ["bât"], "Produit inverse : père cheval × mère ânesse."),
]

export const RACES_COMPAGNIE: Record<string, RaceCatalogue[]> = {
  // — Compagnie —
  chien: RACES_CHIEN,
  chat: RACES_CHAT,
  // — Équins —
  cheval: RACES_CHEVAL,
  poney: RACES_PONEY,
  ane: RACES_ANE,
  mulet: RACES_MULET,
  // — NAC : mammifères (variétés reconnues par les clubs d'éleveurs) —
  furet: [
    v("Putoisé", "Robe sauvage (masque et extrémités foncées)."),
    v("Zibeline"),
    v("Champagne"),
    v("Chocolat"),
    v("Cinnamon"),
    v("Albinos"),
    v("Blanc aux yeux noirs (DEW)"),
    v("Argenté"),
    v("Panda"),
    v("Blaze"),
    v("Silver mitt"),
  ],
  lapin_nain: [
    r("Nain de couleur", "Allemagne", ["compagnie"]),
    r("Hermine de Lutterbach", "France", ["compagnie"]),
    r("Nain bélier", "Pays-Bas", ["compagnie"]),
    r("Bélier anglais", "Royaume-Uni", ["compagnie"]),
    r("Rex nain", "France", ["compagnie"]),
    r("Angora nain", "Turquie", ["compagnie", "poil"]),
    r("Tête de lion", "Belgique", ["compagnie"]),
    r("Hollandais nain", "Pays-Bas", ["compagnie"]),
    r("Papillon nain", "Allemagne", ["compagnie"]),
    r("Polonais", "Pologne", ["compagnie"]),
    r("Fuzzy lop", "États-Unis", ["compagnie"]),
    r("Nain satin", "États-Unis", ["compagnie"]),
  ],
  cobaye: [
    r("Poil lisse (self)", "Pérou", ["compagnie"]),
    r("Abyssin", "Pérou", ["compagnie"], "Poil en rosettes."),
    r("Péruvien", "Pérou", ["compagnie"], "Poil long : toilettage indispensable."),
    r("Sheltie", "Royaume-Uni", ["compagnie"]),
    r("Coronet", "Royaume-Uni", ["compagnie"]),
    r("Texel", "Royaume-Uni", ["compagnie"]),
    r("Rex", "Royaume-Uni", ["compagnie"]),
    r("Alpaga", "Royaume-Uni", ["compagnie"]),
    r("Mérino", "Royaume-Uni", ["compagnie"]),
    r("Skinny", "Pays-Bas", ["compagnie"], "Quasi nu : besoins thermiques et alimentaires accrus."),
    r("Baldwin", "États-Unis", ["compagnie"]),
    r("Himalayen", "Royaume-Uni", ["compagnie"]),
  ],
  hamster: [
    r("Doré (syrien)", "Syrie", ["compagnie"], "Strictement solitaire à partir de 5 semaines."),
    r("Angora (syrien poil long)", "Syrie", ["compagnie"]),
    r("Nain russe (Campbell)", "Asie centrale", ["compagnie"]),
    r("Nain Winter White", "Sibérie", ["compagnie"]),
    r("Roborovski", "Mongolie", ["compagnie"]),
    r("Chinois", "Chine", ["compagnie"]),
  ],
  rat: [
    v("Standard"),
    v("Rex"),
    v("Dumbo"),
    v("Husky"),
    v("Satin"),
    v("Nu (sphynx)", "Sans poil : sensible au froid et aux lésions cutanées."),
    v("Manx", "Sans queue : thermorégulation et équilibre altérés."),
  ],
  souris: [v("Standard"), v("Satin"), v("Angora"), v("Rex"), v("Nue")],
  gerbille: [
    v("Agouti (sauvage)"),
    v("Or"),
    v("Argentée"),
    v("Noire"),
    v("Lilas"),
    v("Panda"),
    v("Pie"),
  ],
  chinchilla: [
    v("Standard gris"),
    v("Beige"),
    v("Blanc mosaïque"),
    v("Black velvet"),
    v("Violet"),
    v("Saphir"),
    v("Ébène"),
  ],
  octodon: [v("Agouti (sauvage)"), v("Bleu"), v("Sable"), v("Pie")],
  cochon_nain: [
    r("Kunekune", "Nouvelle-Zélande", ["compagnie", "pâturage"]),
    r("Vietnamien (pot-bellied)", "Vietnam", ["compagnie"]),
    r("Göttingen", "Allemagne", ["compagnie"]),
    r("Juliana", "États-Unis", ["compagnie"]),
    r("Mini-pig américain", "États-Unis", ["compagnie"]),
  ],
  // — NAC : oiseaux —
  perruche: [
    r("Ondulée", "Australie", ["compagnie", "volière"]),
    r("Ondulée anglaise (de posture)", "Royaume-Uni", ["exposition"]),
    r("Catherine", "Asie", ["volière"]),
    r("De Bourke", "Australie", ["volière"]),
    r("Omnicolore", "Australie", ["volière"]),
    r("Turquoisine", "Australie", ["volière"]),
    r("Splendide", "Australie", ["volière"]),
    r("À croupion rouge", "Australie", ["volière"]),
    r("À collier", "Asie", ["volière"], "Psittacula krameri : espèce CITES annexe II."),
  ],
  calopsitte: [
    v("Gris (sauvage)"),
    v("Lutino"),
    v("Perlé"),
    v("Pie"),
    v("Cinnamon"),
    v("Face blanche"),
    v("Albinos"),
    v("Fallow"),
  ],
  inseparable: [
    r("Roseicollis", "Afrique australe", ["volière"]),
    r("De Fischer", "Afrique de l'Est", ["volière"]),
    r("Masqué (personata)", "Afrique de l'Est", ["volière"]),
    r("De Lilian (nyasa)", "Afrique de l'Est", ["volière"]),
    r("Nigrigenis", "Afrique australe", ["volière"]),
    r("Taranta", "Éthiopie", ["volière"]),
  ],
  perroquet: [
    r("Gris du Gabon", "Afrique centrale", ["compagnie"], "CITES annexe I : cession encadrée, marquage et registre obligatoires."),
    r("Youyou du Sénégal", "Afrique de l'Ouest", ["compagnie"]),
    r("Amazone à front bleu", "Amérique du Sud", ["compagnie"]),
    r("Ara ararauna", "Amérique du Sud", ["volière"]),
    r("Ara chloroptère", "Amérique du Sud", ["volière"]),
    r("Cacatoès rosalbin", "Australie", ["volière"]),
    r("Cacatoès à huppe jaune", "Indonésie", ["volière"], "CITES annexe I."),
    r("Eclectus", "Océanie", ["volière"]),
    r("Pionus", "Amérique du Sud", ["compagnie"]),
    r("Conure soleil", "Amérique du Sud", ["volière"], "CITES annexe II."),
  ],
  canari: [
    r("Malinois (waterslager)", "Belgique", ["chant"]),
    r("Harz (harzer roller)", "Allemagne", ["chant"]),
    r("Timbrado", "Espagne", ["chant"]),
    r("Frisé du Nord", "France", ["posture", "exposition"]),
    r("Frisé parisien", "France", ["posture", "exposition"]),
    r("Bossu belge", "Belgique", ["posture"]),
    r("Gloster", "Royaume-Uni", ["posture"]),
    r("Yorkshire", "Royaume-Uni", ["posture"]),
    r("Norwich", "Royaume-Uni", ["posture"]),
    r("Border", "Royaume-Uni", ["posture"]),
    r("Lizard", "Royaume-Uni", ["posture"]),
    r("Fife fancy", "Royaume-Uni", ["posture"]),
    r("Canari de couleur rouge", "Europe", ["couleur"]),
    r("Canari mosaïque", "Europe", ["couleur"]),
  ],
  mandarin: [
    v("Gris (sauvage)"),
    v("Blanc"),
    v("Pie"),
    v("Isabelle"),
    v("Joues noires"),
    v("Masqué"),
    v("Poitrine orange"),
    v("Huppé"),
  ],
  // — NAC : reptiles & amphibiens —
  tortue_terrestre: [
    r("Tortue d'Hermann", "Méditerranée", ["terrarium", "extérieur"], "CITES annexe II : déclaration de détention (i-Fap) et marquage obligatoires."),
    r("Tortue grecque", "Méditerranée", ["extérieur"], "CITES annexe II."),
    r("Tortue bordée", "Grèce", ["extérieur"], "CITES annexe II."),
    r("Tortue des steppes (Horsfield)", "Asie centrale", ["extérieur"], "CITES annexe II."),
    r("Tortue sillonnée", "Sahel", ["extérieur"], "Adulte > 40 kg : engagement à vie, CITES annexe II."),
    r("Tortue étoilée d'Inde", "Inde", ["terrarium"], "CITES annexe I."),
  ],
  gecko_leopard: [
    v("Sauvage (wild type)"),
    v("High yellow"),
    v("Tangerine"),
    v("Mack snow"),
    v("Albinos Tremper"),
    v("Albinos Bell"),
    v("Albinos Rainwater"),
    v("Blizzard"),
    v("Murphy patternless"),
    v("Eclipse"),
    v("Radar"),
    v("Super giant"),
  ],
  gecko_crete: [
    v("Patternless"),
    v("Flame"),
    v("Harlequin"),
    v("Extreme harlequin"),
    v("Pinstripe"),
    v("Dalmatien"),
    v("Tricolore"),
    v("Lilly white", "Létal à l'état homozygote : ne jamais accoupler deux Lilly white."),
  ],
  pogona: [
    v("Classique (sauvage)"),
    v("Hypomélanistique"),
    v("Translucide"),
    v("Leatherback"),
    v("Citrus"),
    v("Red"),
    v("Witblits"),
    v("Zero"),
    v("Dunner"),
    v("Silkback", "Sans écailles : fragilité cutanée majeure, sélection déconseillée."),
  ],
  serpent_des_bles: [
    v("Sauvage (carolina)"),
    v("Okeetee"),
    v("Amélanistique"),
    v("Anérythrique"),
    v("Snow"),
    v("Blizzard"),
    v("Motley"),
    v("Stripe"),
    v("Lavande"),
    v("Caramel"),
    v("Palmetto"),
  ],
  python_royal: [
    v("Classique (wild type)"),
    v("Pastel"),
    v("Super pastel"),
    v("Mojave"),
    v("Lesser"),
    v("Butter"),
    v("Banana"),
    v("Albinos"),
    v("Piebald"),
    v("Clown"),
    v("Ghost"),
    v("Enchi"),
    v("Yellow belly"),
    v("Fire"),
  ],
  axolotl: [
    v("Sauvage (wild type)"),
    v("Leucistique"),
    v("Albinos doré"),
    v("Albinos blanc"),
    v("Mélanoïde"),
    v("Copper"),
  ],
}

/** Races/variétés du catalogue officiel pour une espèce (vide si inconnue). */
export function racesCatalogue(especeId: string): RaceCatalogue[] {
  return RACES_COMPAGNIE[especeId] ?? []
}

/** Nombre total d'associations race↔espèce du catalogue (contrôle de seed). */
export function totalRacesCatalogue(): number {
  return Object.values(RACES_COMPAGNIE).reduce((n, races) => n + races.length, 0)
}
