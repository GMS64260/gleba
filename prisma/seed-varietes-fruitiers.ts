/**
 * Referentiel varietal pour arbres fruitiers communs en France
 *
 * Sources: gerbeaud.com, rustica.fr, CTIFL, Wikipedia, pepinieres-charge.com,
 *          promessedefleurs.com, truffaut.com, pepinieres-gromolard.com,
 *          silencecapousse-chezvous.fr, plantgrape.fr, croqueurs-national.fr
 *
 * Ce fichier exporte un tableau de varietes fruitieres avec leurs attributs agronomiques.
 * Les valeurs "null" indiquent une donnee non confirmee par les sources consultees.
 *
 * Usage: peut etre importe dans seed.ts ou utilise pour creer une table de reference.
 */

export interface VarieteFruitier {
  espece: string;            // Nom commun de l'espece (Pommier, Poirier, etc.)
  variete: string;           // Nom du cultivar
  floraisonMois: string;     // Mois de floraison (ex: "avril", "mars-avril")
  floraisonGroupe: string | null; // Groupe de floraison (A/B/C/D) ou null si non applicable
  recolteDebut: string;      // Mois debut de recolte
  recolteFin: string;        // Mois fin de recolte
  couleurFruit: string;      // Couleur principale du fruit
  poidsmoyenG: number | null; // Poids moyen du fruit en grammes
  rendementKg: number | null;  // Rendement moyen en kg par arbre adulte
  conservationJours: number | null; // Duree de conservation en jours
  autofertile: boolean;      // True si autofertile
  groupePollinisation: string | null; // Groupe de pollinisation (si applicable)
  pollinisateursRecommandes: string[]; // Noms des varietes pollinisatrices recommandees
  saveur: string;            // Description de la saveur
  resistanceMaladies: string; // Description des resistances et sensibilites
  vigueur: string;           // "faible", "moyenne", "forte"
  notes: string | null;      // Notes supplementaires
}

export const varieteFruitiers: VarieteFruitier[] = [

  // ============================================================
  // POMMIER (Malus domestica)
  // ============================================================

  {
    espece: "Pommier",
    variete: "Golden Delicious",
    floraisonMois: "avril",
    floraisonGroupe: "C",
    recolteDebut: "septembre",
    recolteFin: "octobre",
    couleurFruit: "jaune dore",
    poidsmoyenG: 180,
    rendementKg: 70,
    conservationJours: 150, // 4-5 mois
    autofertile: false,
    groupePollinisation: "C",
    pollinisateursRecommandes: ["Granny Smith", "Reine des Reinettes", "Cox Orange", "Gala", "Melrose"],
    saveur: "Sucree, legerement acidulee, parfumee",
    resistanceMaladies: "Sensible a la tavelure. Resistant a l'oidium. Peu sensible au feu bacterien.",
    vigueur: "moyenne",
    notes: "Variete de reference pour la floraison. Excellent pollinisateur. Diploide. Tres cultivee en France.",
  },
  {
    espece: "Pommier",
    variete: "Granny Smith",
    floraisonMois: "mars-avril",
    floraisonGroupe: "C",
    recolteDebut: "octobre",
    recolteFin: "novembre",
    couleurFruit: "vert vif",
    poidsmoyenG: 160,
    rendementKg: 60,
    conservationJours: 180, // 6 mois
    autofertile: false,
    groupePollinisation: "C",
    pollinisateursRecommandes: ["Golden Delicious", "Gala", "Fuji", "Reine des Reinettes"],
    saveur: "Tres acidulee, croquante, juteuse",
    resistanceMaladies: "Sensible a la tavelure et a l'oidium. Bonne productivite reguliere.",
    vigueur: "forte",
    notes: "Bon pollinisateur. Pollen abondant et de qualite. Productivite reguliere, peu alternante.",
  },
  {
    espece: "Pommier",
    variete: "Gala",
    floraisonMois: "avril-mai",
    floraisonGroupe: "C",
    recolteDebut: "septembre",
    recolteFin: "septembre",
    couleurFruit: "rouge orange sur fond jaune",
    poidsmoyenG: 140,
    rendementKg: 60,
    conservationJours: 180, // jusqu'a 6 mois
    autofertile: false,
    groupePollinisation: "C",
    pollinisateursRecommandes: ["Fuji", "Reine des Reinettes", "Golden Delicious"],
    saveur: "Tres sucree, juteuse, peu acidulee",
    resistanceMaladies: "Sensible a la tavelure et a l'oidium. Planter en plein soleil pour reduire les risques.",
    vigueur: "moyenne",
    notes: "Floraison tardive, a l'abri des gelees. Mise a fruit rapide. Production reguliere, peu alternante.",
  },
  {
    espece: "Pommier",
    variete: "Fuji",
    floraisonMois: "avril",
    floraisonGroupe: "C",
    recolteDebut: "octobre",
    recolteFin: "novembre",
    couleurFruit: "rouge rosé sur fond jaune-vert",
    poidsmoyenG: 180,
    rendementKg: 70,
    conservationJours: 240, // jusqu'a 8 mois
    autofertile: false,
    groupePollinisation: "C",
    pollinisateursRecommandes: ["Gala", "Elstar", "Golden Delicious", "Reine des Reinettes", "Granny Smith"],
    saveur: "Tres sucree, parfumee, croquante, juteuse",
    resistanceMaladies: "Bonne resistance au mildiou. Sensible a la tavelure.",
    vigueur: "forte",
    notes: "Croisement Ralls Janet x Red Delicious (Japon, 1939). Partiellement autofertile mais production amelioree avec pollinisateur. Faible alternance.",
  },
  {
    espece: "Pommier",
    variete: "Reine des Reinettes",
    floraisonMois: "avril",
    floraisonGroupe: "B",
    recolteDebut: "septembre",
    recolteFin: "septembre",
    couleurFruit: "jaune dore strie de rouge",
    poidsmoyenG: 140,
    rendementKg: 60,
    conservationJours: 60, // environ 2 mois
    autofertile: false,
    groupePollinisation: "B",
    pollinisateursRecommandes: ["Golden Delicious", "Granny Smith", "Cox Orange", "Gala"],
    saveur: "Sucree et acidulee, gout de noix, tres parfumee",
    resistanceMaladies: "Bonne resistance generale. Moderement sensible a la tavelure.",
    vigueur: "moyenne",
    notes: "Excellent pollinisateur universel. Floraison tres etalee sur le mois d'avril. Diploide.",
  },
  {
    espece: "Pommier",
    variete: "Belle de Boskoop",
    floraisonMois: "avril",
    floraisonGroupe: "B",
    recolteDebut: "octobre",
    recolteFin: "novembre",
    couleurFruit: "rouge sur fond vert-jaune",
    poidsmoyenG: 200,
    rendementKg: 70,
    conservationJours: 150, // jusqu'a 5 mois
    autofertile: false,
    groupePollinisation: null,
    pollinisateursRecommandes: ["Reine des Reinettes", "Cox Orange", "Golden Delicious", "Elstar"],
    saveur: "Acidulee, chair ferme, parfumee",
    resistanceMaladies: "Bonne resistance au chancre, a la tavelure et a l'oidium.",
    vigueur: "forte",
    notes: "Variete TRIPLOIDE: auto-sterile et ne peut pas polliniser d'autres varietes. Necessite 2 pollinisateurs diploides.",
  },
  {
    espece: "Pommier",
    variete: "Elstar",
    floraisonMois: "avril",
    floraisonGroupe: "C",
    recolteDebut: "septembre",
    recolteFin: "septembre",
    couleurFruit: "rouge et jaune",
    poidsmoyenG: 150,
    rendementKg: 50,
    conservationJours: 60, // environ 2 mois
    autofertile: false,
    groupePollinisation: "C",
    pollinisateursRecommandes: ["Golden Delicious", "Gala", "Reine des Reinettes", "Cox Orange"],
    saveur: "Equilibree, sucree-acidulee, croquante, juteuse, parfumee",
    resistanceMaladies: "Certaine resistance a la tavelure. Sensible aux autres parasites et maladies du pommier.",
    vigueur: "moyenne",
    notes: "Croisement Golden Delicious x Ingrid Marie (Pays-Bas, 1955). Port ouvert. Conservation assez courte.",
  },
  {
    espece: "Pommier",
    variete: "Jonagold",
    floraisonMois: "avril-mai",
    floraisonGroupe: "C",
    recolteDebut: "septembre",
    recolteFin: "octobre",
    couleurFruit: "jaune strie de rouge",
    poidsmoyenG: 200,
    rendementKg: 70,
    conservationJours: 120, // jusqu'en janvier (environ 4 mois)
    autofertile: false,
    groupePollinisation: null,
    pollinisateursRecommandes: ["Reine des Reinettes", "Cox Orange", "Granny Smith", "Melrose", "Elstar"],
    saveur: "Sucree, juteuse, chair fine",
    resistanceMaladies: "Sensible a l'oidium, tavelure, feu bacterien. Sensible aux pucerons et carpocapses.",
    vigueur: "forte",
    notes: "Variete TRIPLOIDE (Jonathan x Golden Delicious, USA, 1943). Necessite 2 pollinisateurs diploides. Fruit de diametre 7.5-8 cm.",
  },
  {
    espece: "Pommier",
    variete: "Braeburn",
    floraisonMois: "avril",
    floraisonGroupe: "C",
    recolteDebut: "octobre",
    recolteFin: "octobre",
    couleurFruit: "rouge strie sur fond vert-jaune",
    poidsmoyenG: 180,
    rendementKg: 60,
    conservationJours: 120, // decembre a janvier
    autofertile: false,
    groupePollinisation: "C",
    pollinisateursRecommandes: ["Red Delicious", "Granny Smith", "Gala", "Golden Delicious"],
    saveur: "Acidulee, croquante, juteuse",
    resistanceMaladies: "Resistance moyenne. Vigueur diminuant apres mise a fruit.",
    vigueur: "forte",
    notes: "Originaire de Nouvelle-Zelande. S-genotype S9S24. Maturite echelonnee. Gros calibre.",
  },
  {
    espece: "Pommier",
    variete: "Cox Orange",
    floraisonMois: "avril",
    floraisonGroupe: "B",
    recolteDebut: "septembre",
    recolteFin: "octobre",
    couleurFruit: "jaune orange strie de rouge",
    poidsmoyenG: 130,
    rendementKg: 40,
    conservationJours: 150, // 4-5 mois
    autofertile: false,
    groupePollinisation: "B",
    pollinisateursRecommandes: ["Reine des Reinettes", "Golden Delicious", "Elstar"],
    saveur: "Sucree, legerement acidulee, tres aromatique, chair fine",
    resistanceMaladies: "Sensible a l'oidium, tavelure, chancre, moniliose et araignee rouge.",
    vigueur: "moyenne",
    notes: "Variete ancienne anglaise (1825). Qualite gustative exceptionnelle. Bonne pollinisatrice mais tendance a l'alternance. Port demi-erige retombant.",
  },

  // ============================================================
  // POIRIER (Pyrus communis)
  // ============================================================

  {
    espece: "Poirier",
    variete: "Williams",
    floraisonMois: "avril",
    floraisonGroupe: null,
    recolteDebut: "aout",
    recolteFin: "septembre",
    couleurFruit: "jaune dore",
    poidsmoyenG: 170,
    rendementKg: 60,
    conservationJours: 30, // se conserve jusqu'en octobre environ
    autofertile: true,
    groupePollinisation: null,
    pollinisateursRecommandes: ["Conference", "Doyenne du Comice", "Dr Jules Guyot", "Beurre Hardy"],
    saveur: "Sucree, peu acidulee, tres parfumee, fondante, juteuse",
    resistanceMaladies: "Sensible a la tavelure. Sensible au feu bacterien (maladie grave du poirier).",
    vigueur: "forte",
    notes: "Variete la plus cultivee au monde. Autofertile mais production amelioree avec pollinisateur. Pollinisation incompatible avec Louise Bonne et Williams Rouge.",
  },
  {
    espece: "Poirier",
    variete: "Conference",
    floraisonMois: "avril",
    floraisonGroupe: null,
    recolteDebut: "septembre",
    recolteFin: "octobre",
    couleurFruit: "vert bronze",
    poidsmoyenG: 160,
    rendementKg: 50,
    conservationJours: 90, // jusqu'en janvier
    autofertile: true,
    groupePollinisation: null,
    pollinisateursRecommandes: ["Williams", "Beurre Hardy", "Doyenne du Comice", "Dr Jules Guyot"],
    saveur: "Sucree, juteuse, fondante, legerement acidulee",
    resistanceMaladies: "Resistant a la tavelure sur fruits. Sensible au feu bacterien.",
    vigueur: "moyenne",
    notes: "Excellent pollinisateur. Autofertile, production fiable. Variete originaire d'Angleterre (1884).",
  },
  {
    espece: "Poirier",
    variete: "Doyenne du Comice",
    floraisonMois: "avril",
    floraisonGroupe: null,
    recolteDebut: "octobre",
    recolteFin: "octobre",
    couleurFruit: "jaune-vert, joue rosee",
    poidsmoyenG: 250,
    rendementKg: 40,
    conservationJours: 60, // jusqu'en decembre
    autofertile: true,
    groupePollinisation: null,
    pollinisateursRecommandes: ["Conference", "Williams", "Beurre Hardy", "Louise Bonne"],
    saveur: "Tres sucree, fondante, beurrée, juteuse, tres parfumee",
    resistanceMaladies: "Sensible a la tavelure et au feu bacterien. Sensible aux gelees tardives.",
    vigueur: "moyenne",
    notes: "Consideree comme la meilleure poire de dessert. Gros calibre. Autofertile mais production amelioree avec pollinisateur.",
  },
  {
    espece: "Poirier",
    variete: "Louise Bonne d'Avranches",
    floraisonMois: "avril",
    floraisonGroupe: null,
    recolteDebut: "septembre",
    recolteFin: "octobre",
    couleurFruit: "vert-jaune tache de rouge vif",
    poidsmoyenG: 140,
    rendementKg: 50,
    conservationJours: 30, // consommation sept-debut oct
    autofertile: false,
    groupePollinisation: null,
    pollinisateursRecommandes: ["Williams", "Conference", "Beurre Hardy", "Doyenne du Comice"],
    saveur: "Sucree, acidulee, juteuse, parfumee",
    resistanceMaladies: "Bonne resistance generale. Sensible au feu bacterien.",
    vigueur: "forte",
    notes: "Variete ancienne, s'adapte a tous les climats. Petite taille de fruit. Pollinisation incompatible avec Williams.",
  },
  {
    espece: "Poirier",
    variete: "Beurre Hardy",
    floraisonMois: "avril",
    floraisonGroupe: null,
    recolteDebut: "septembre",
    recolteFin: "septembre",
    couleurFruit: "vert bronze dore",
    poidsmoyenG: 180,
    rendementKg: 50,
    conservationJours: 60, // environ 2 mois
    autofertile: false,
    groupePollinisation: null,
    pollinisateursRecommandes: ["Williams", "Conference", "Doyenne du Comice", "Louise Bonne"],
    saveur: "Fine, fondante, granuleuse pres des pepins, juteuse, aromatique",
    resistanceMaladies: "Bonne resistance a la tavelure. Sensible au feu bacterien.",
    vigueur: "forte",
    notes: "Variete robuste et productive. Recolte 5-20 septembre. Bonne affinite sur cognassier.",
  },
  {
    espece: "Poirier",
    variete: "Dr Jules Guyot",
    floraisonMois: "avril",
    floraisonGroupe: null,
    recolteDebut: "juillet",
    recolteFin: "aout",
    couleurFruit: "jaune-vert",
    poidsmoyenG: 160,
    rendementKg: 40,
    conservationJours: 7, // fragile, consommation immediate
    autofertile: true,
    groupePollinisation: null,
    pollinisateursRecommandes: ["Williams", "Conference", "Beurre Hardy"],
    saveur: "Sucree, juteuse, fondante, chair ivoire fine",
    resistanceMaladies: "Resistant a la tavelure. Sensible au feu bacterien.",
    vigueur: "moyenne",
    notes: "Variete precoce (fin juillet). Fruits fragiles, ne se conservent pas. Obtenue en 1870 a Troyes. Floraison tardive en avril, a l'abri des gelees.",
  },

  // ============================================================
  // CERISIER (Prunus avium / Prunus cerasus)
  // ============================================================

  {
    espece: "Cerisier",
    variete: "Burlat",
    floraisonMois: "mars-avril",
    floraisonGroupe: null,
    recolteDebut: "mai",
    recolteFin: "juin",
    couleurFruit: "rouge fonce a noir",
    poidsmoyenG: 8,
    rendementKg: 50,
    conservationJours: 5, // consommation rapide
    autofertile: false,
    groupePollinisation: "II",
    pollinisateursRecommandes: ["Napoleon", "Summit", "Reverchon", "Van", "Hedelfingen"],
    saveur: "Sucree, juteuse, chair ferme",
    resistanceMaladies: "Bonne resistance a l'eclatement. Rustique. Bonne resistance aux gelees printanieres.",
    vigueur: "forte",
    notes: "Bigarreau precoce. Recolte des mi-mai dans le Sud. Fruits en forme de coeur, resistant a l'eclatement. Bon pollinisateur pour d'autres varietes.",
  },
  {
    espece: "Cerisier",
    variete: "Napoleon",
    floraisonMois: "mars-avril",
    floraisonGroupe: null,
    recolteDebut: "juin",
    recolteFin: "juillet",
    couleurFruit: "rose saumon a rouge vif",
    poidsmoyenG: 9,
    rendementKg: 60,
    conservationJours: 7,
    autofertile: false,
    groupePollinisation: "III",
    pollinisateursRecommandes: ["Burlat", "Moreau", "Hedelfingen", "Reverchon"],
    saveur: "Sucree, juteuse, chair ferme et croquante",
    resistanceMaladies: "Bonne resistance generale. Peu sensible aux gelees.",
    vigueur: "forte",
    notes: "Bigarreau demi-tardif. Arbre tres puissant et tres productif. Fruits jaune-rose devenant rouge vif a maturite. Chair blanc-jaunatre.",
  },
  {
    espece: "Cerisier",
    variete: "Summit",
    floraisonMois: "avril",
    floraisonGroupe: null,
    recolteDebut: "juin",
    recolteFin: "juin",
    couleurFruit: "rouge fonce",
    poidsmoyenG: 12,
    rendementKg: 50,
    conservationJours: 7,
    autofertile: true,
    groupePollinisation: "III",
    pollinisateursRecommandes: ["Burlat", "Napoleon", "Van"],
    saveur: "Sucree, juteuse, chair ferme",
    resistanceMaladies: "Bonne resistance generale.",
    vigueur: "forte",
    notes: "Bigarreau a gros fruits. Parmi les varietes autofertiles. Recolte en juin, production moyenne a forte.",
  },
  {
    espece: "Cerisier",
    variete: "Reverchon",
    floraisonMois: "avril",
    floraisonGroupe: null,
    recolteDebut: "juin",
    recolteFin: "juillet",
    couleurFruit: "rouge pourpre fonce",
    poidsmoyenG: 10,
    rendementKg: 50,
    conservationJours: 7,
    autofertile: false,
    groupePollinisation: "IV",
    pollinisateursRecommandes: ["Burlat", "Napoleon", "Hedelfingen"],
    saveur: "Tres sucree, croquante, chair ferme de haute qualite",
    resistanceMaladies: "Bonne resistance generale. Bien adaptee aux regions nord de la Loire grace a sa floraison tardive.",
    vigueur: "forte",
    notes: "Bigarreau tres tardif. Ideal pour prolonger la saison des cerises. Floraison tardive debut avril. Gros fruits coniques.",
  },
  {
    espece: "Cerisier",
    variete: "Moreau",
    floraisonMois: "mars-avril",
    floraisonGroupe: null,
    recolteDebut: "mai",
    recolteFin: "juin",
    couleurFruit: "noir",
    poidsmoyenG: 8,
    rendementKg: 50,
    conservationJours: 5,
    autofertile: false,
    groupePollinisation: "II",
    pollinisateursRecommandes: ["Napoleon", "Burlat", "Summit"],
    saveur: "Sucree, chair ferme et croquante",
    resistanceMaladies: "Sensible aux gelees precoces.",
    vigueur: "forte",
    notes: "Bigarreau precoce. Port erige. Cerises noires a chair ferme. Feuillage orange en automne.",
  },
  {
    espece: "Cerisier",
    variete: "Griotte de Montmorency",
    floraisonMois: "avril",
    floraisonGroupe: null,
    recolteDebut: "juin",
    recolteFin: "juillet",
    couleurFruit: "rouge vif clair",
    poidsmoyenG: 5,
    rendementKg: 40,
    conservationJours: 7,
    autofertile: true,
    groupePollinisation: null,
    pollinisateursRecommandes: [],
    saveur: "Acidulee, sucree, chair fondante, rosee, filamenteuse",
    resistanceMaladies: "Tres sain en general. Sensible au monilia. Tres rustique, toutes regions.",
    vigueur: "moyenne",
    notes: "Griotte (Prunus cerasus). Variete de reference pour la patisserie. Autofertile. Port erige puis etale. Hauteur 3-4 m. Tres productive. Resistant a l'eclatement.",
  },

  // ============================================================
  // PRUNIER (Prunus domestica)
  // ============================================================

  {
    espece: "Prunier",
    variete: "Reine Claude Doree",
    floraisonMois: "avril",
    floraisonGroupe: null,
    recolteDebut: "aout",
    recolteFin: "aout",
    couleurFruit: "vert-jaune dore",
    poidsmoyenG: 35,
    rendementKg: 50,
    conservationJours: 21, // 3 semaines au frais
    autofertile: false,
    groupePollinisation: null,
    pollinisateursRecommandes: ["Reine Claude d'Oullins", "Mirabelle de Nancy", "Stanley", "Quetsche d'Alsace"],
    saveur: "Tres sucree, parfumee, chair fondante, juteuse",
    resistanceMaladies: "Bonne resistance aux maladies. Assez sensible a l'alternance.",
    vigueur: "forte",
    notes: "Auto-incompatible. Floraison legerement tardive (avril). Fruits ronds de 4 cm de diametre. Pruine blanche translucide. Mi-aout.",
  },
  {
    espece: "Prunier",
    variete: "Mirabelle de Nancy",
    floraisonMois: "mars-avril",
    floraisonGroupe: null,
    recolteDebut: "aout",
    recolteFin: "aout",
    couleurFruit: "jaune-orange dore",
    poidsmoyenG: 15,
    rendementKg: 50,
    conservationJours: 10,
    autofertile: true,
    groupePollinisation: null,
    pollinisateursRecommandes: ["Mirabelle de Metz", "Reine Claude d'Oullins", "Quetsche d'Alsace"],
    saveur: "Tres sucree, arome abricot et epice, chair ferme",
    resistanceMaladies: "Tres resistant aux maladies, notamment a la sharka. Bonne resistance a la moniliose.",
    vigueur: "moyenne",
    notes: "Partiellement autofertile. Fruits de 3.5-4 cm de diametre. Mi-aout. Plus grosse que la Mirabelle de Metz. Pruine fragile.",
  },
  {
    espece: "Prunier",
    variete: "Quetsche d'Alsace",
    floraisonMois: "avril",
    floraisonGroupe: null,
    recolteDebut: "septembre",
    recolteFin: "septembre",
    couleurFruit: "violet fonce a noir",
    poidsmoyenG: 35,
    rendementKg: 50,
    conservationJours: 10,
    autofertile: true,
    groupePollinisation: null,
    pollinisateursRecommandes: ["Stanley", "Reine Claude d'Oullins", "Reine Claude Doree"],
    saveur: "Sucree, chair jaune ferme, peu juteuse",
    resistanceMaladies: "Bonne resistance generale.",
    vigueur: "forte",
    notes: "Auto-compatible. Fruit allonge ovale. Bon pollinisateur. Bonne production reguliere.",
  },
  {
    espece: "Prunier",
    variete: "Reine Claude d'Oullins",
    floraisonMois: "mars-avril",
    floraisonGroupe: null,
    recolteDebut: "aout",
    recolteFin: "aout",
    couleurFruit: "vert-jaune, pruine voutée",
    poidsmoyenG: 40,
    rendementKg: 60,
    conservationJours: 10,
    autofertile: true,
    groupePollinisation: null,
    pollinisateursRecommandes: ["Reine Claude Doree", "Mirabelle de Nancy", "Stanley"],
    saveur: "Sucree, juteuse, chair fondante",
    resistanceMaladies: "Vigoureux et resistant aux maladies. Resistant aux coups de froid et a la mouche de la prune.",
    vigueur: "forte",
    notes: "Autofertile. Gros fruits ronds-ovales. Haute production. Bon pollinisateur universel. Floraison precoce (fev-mars, fleurs blanches debut avril).",
  },
  {
    espece: "Prunier",
    variete: "Stanley",
    floraisonMois: "avril",
    floraisonGroupe: null,
    recolteDebut: "septembre",
    recolteFin: "septembre",
    couleurFruit: "violet-rouge fonce a noir",
    poidsmoyenG: 45,
    rendementKg: 50,
    conservationJours: 14,
    autofertile: true,
    groupePollinisation: null,
    pollinisateursRecommandes: ["Reine Claude d'Oullins", "Reine Claude Doree", "Quetsche d'Alsace"],
    saveur: "Sucree, chair jaune, bonne qualite, peu juteuse",
    resistanceMaladies: "Tolerant a la sharka. Bonne resistance aux maladies. Legere sensibilite au monilia sur fleurs.",
    vigueur: "forte",
    notes: "Quetsche. Autofertile et bon pollinisateur. Fruits allonges, gros calibre. Mise a fruit rapide. Production forte et reguliere. Ideal pour pruneaux.",
  },

  // ============================================================
  // PECHER (Prunus persica)
  // ============================================================

  {
    espece: "Pecher",
    variete: "Redhaven",
    floraisonMois: "avril-mai",
    floraisonGroupe: null,
    recolteDebut: "juillet",
    recolteFin: "aout",
    couleurFruit: "jaune orange, joue rouge",
    poidsmoyenG: 150,
    rendementKg: 50,
    conservationJours: 10,
    autofertile: true,
    groupePollinisation: null,
    pollinisateursRecommandes: [],
    saveur: "Sucree, juteuse, tres parfumee, chair jaune",
    resistanceMaladies: "Bonne resistance a la cloque du pecher.",
    vigueur: "moyenne",
    notes: "Variete de reference. Autofertile. Fruits legerement aplatis, 60 mm de diametre. Rendement max a 11 ans: jusqu'a 110 kg. Chair jaune, noyau libre.",
  },
  {
    espece: "Pecher",
    variete: "Suncrest",
    floraisonMois: "mars",
    floraisonGroupe: null,
    recolteDebut: "juillet",
    recolteFin: "aout",
    couleurFruit: "jaune orangee, joue rouge",
    poidsmoyenG: 260,
    rendementKg: 50,
    conservationJours: 10,
    autofertile: true,
    groupePollinisation: null,
    pollinisateursRecommandes: [],
    saveur: "Tres sucree, juteuse, parfumee, saveur exceptionnelle, chair orange-rouge couleur mangue",
    resistanceMaladies: "Sensible a la cloque du pecher.",
    vigueur: "forte",
    notes: "Tres gros calibre (250-280g). Floraison precoce mi-mars. Mise a fruit rapide. Recolte abondante, reguliere, etalee dans la saison.",
  },
  {
    espece: "Pecher",
    variete: "Amsden",
    floraisonMois: "mars",
    floraisonGroupe: null,
    recolteDebut: "juin",
    recolteFin: "juillet",
    couleurFruit: "rouge, peau veloutee",
    poidsmoyenG: 120,
    rendementKg: 40,
    conservationJours: 7,
    autofertile: true,
    groupePollinisation: null,
    pollinisateursRecommandes: [],
    saveur: "Sucree, juteuse, chair blanche",
    resistanceMaladies: "Resistant a la cloque du pecher et au monilia.",
    vigueur: "forte",
    notes: "Variete tres precoce (juin/juillet). Chair blanche. Autofertile. Floraison precoce en mars.",
  },
  {
    espece: "Pecher",
    variete: "Dixired",
    floraisonMois: "mars",
    floraisonGroupe: null,
    recolteDebut: "juillet",
    recolteFin: "aout",
    couleurFruit: "jaune, joue rouge",
    poidsmoyenG: 150,
    rendementKg: 50,
    conservationJours: 10,
    autofertile: true,
    groupePollinisation: null,
    pollinisateursRecommandes: [],
    saveur: "Chair jaune, ferme, juteuse, parfumee",
    resistanceMaladies: "Tres vigoureux, peu sensible aux maladies.",
    vigueur: "forte",
    notes: "Floraison tres precoce (mars). Gros calibre. Variete vigoureuse et productive. Certaines sources indiquent un pollinisateur necessaire malgre l'autofertilite.",
  },

  // ============================================================
  // ABRICOTIER (Prunus armeniaca)
  // ============================================================

  {
    espece: "Abricotier",
    variete: "Bergeron",
    floraisonMois: "mars-avril",
    floraisonGroupe: null,
    recolteDebut: "juillet",
    recolteFin: "aout",
    couleurFruit: "jaune orange, joue rouge",
    poidsmoyenG: 65,
    rendementKg: 50,
    conservationJours: 14,
    autofertile: true,
    groupePollinisation: null,
    pollinisateursRecommandes: ["Polonais", "Rouge du Roussillon"],
    saveur: "Sucree, parfumee, chair ferme et juteuse",
    resistanceMaladies: "Sensible au monilia et a la bacteriose. Resistant au froid. Adapte aux regions froides.",
    vigueur: "moyenne",
    notes: "Floraison semi-tardive. Fruits arrondis de 5-5.5 cm diametre. Variete tardive (fin juillet-debut aout). Bonne productivite. Mellifere.",
  },
  {
    espece: "Abricotier",
    variete: "Polonais",
    floraisonMois: "mars-avril",
    floraisonGroupe: null,
    recolteDebut: "juillet",
    recolteFin: "juillet",
    couleurFruit: "orange",
    poidsmoyenG: 45,
    rendementKg: 40,
    conservationJours: 10,
    autofertile: true,
    groupePollinisation: null,
    pollinisateursRecommandes: ["Bergeron", "Rouge du Roussillon"],
    saveur: "Sucree, parfumee, chair fondante",
    resistanceMaladies: "Excellente resistance aux maladies. Supporte l'altitude et le froid jusqu'a -15°C.",
    vigueur: "moyenne",
    notes: "Aussi appele 'Orange de Provence'. Variete ancienne de la vallee du Rhone. Floraison tardive (mars-avril). Fruits de taille moyenne (35-45g selon les conditions). Fin juillet.",
  },
  {
    espece: "Abricotier",
    variete: "Rouge du Roussillon",
    floraisonMois: "mars",
    floraisonGroupe: null,
    recolteDebut: "juillet",
    recolteFin: "juillet",
    couleurFruit: "jaune-orange lave de vermillon",
    poidsmoyenG: 45,
    rendementKg: 50,
    conservationJours: 21, // 3 semaines a +6°C
    autofertile: true,
    groupePollinisation: null,
    pollinisateursRecommandes: [],
    saveur: "Tres sucree, la plus sucree des varietes d'abricot",
    resistanceMaladies: "Tolerant a la sharka. Resistant au gel. Sensible au monilia sur fleurs en climat humide.",
    vigueur: "moyenne",
    notes: "Floraison semi-tardive. Grande fertilite et production reguliere. Rendement 50 kg/arbre. Fruit environ 5 cm de diametre. Mi-juillet a fin juillet.",
  },
  {
    espece: "Abricotier",
    variete: "Goldrich",
    floraisonMois: "mars",
    floraisonGroupe: null,
    recolteDebut: "juillet",
    recolteFin: "juillet",
    couleurFruit: "orange vif",
    poidsmoyenG: 75,
    rendementKg: 50,
    conservationJours: 14,
    autofertile: true,
    groupePollinisation: null,
    pollinisateursRecommandes: [],
    saveur: "Sucree, parfumee, juteuse",
    resistanceMaladies: "Bonne resistance aux maladies. Productivite elevee.",
    vigueur: "forte",
    notes: "Tres gros fruits (6-7 cm de diametre, jusqu'a 275g en conditions optimales mais 75g en moyenne standard). Climat meridional. Vigoureuse et productive.",
  },

  // ============================================================
  // VIGNE DE TABLE (Vitis vinifera)
  // ============================================================

  {
    espece: "Vigne de table",
    variete: "Chasselas de Fontainebleau",
    floraisonMois: "mai-juin",
    floraisonGroupe: null,
    recolteDebut: "septembre",
    recolteFin: "octobre",
    couleurFruit: "jaune dore",
    poidsmoyenG: 200, // poids moyen de grappe
    rendementKg: 10, // kg par pied, qualite table
    conservationJours: 30,
    autofertile: true,
    groupePollinisation: null,
    pollinisateursRecommandes: [],
    saveur: "Sucree, equilibree, grains dores a peau fine",
    resistanceMaladies: "Sensible a l'oidium, excoriose et eutypiose. Tolerant a la pourriture et au mildiou. Peu attaque par les acariens.",
    vigueur: "forte",
    notes: "Variete tres ancienne de reference. Tres fructifere. Grosses grappes. Grains moyens. Maturation fin septembre. Poids de grappe indicatif.",
  },
  {
    espece: "Vigne de table",
    variete: "Muscat de Hambourg",
    floraisonMois: "mai-juin",
    floraisonGroupe: null,
    recolteDebut: "aout",
    recolteFin: "septembre",
    couleurFruit: "bleu-noir",
    poidsmoyenG: 300, // poids moyen de grappe
    rendementKg: 10,
    conservationJours: 21,
    autofertile: true,
    groupePollinisation: null,
    pollinisateursRecommandes: [],
    saveur: "Musquee, tres aromatique, sucree, peau moderement epaisse",
    resistanceMaladies: "Sensible a l'oidium, mildiou, phomopsis, acariens et tordeuses. Peu sensible a la pourriture grise.",
    vigueur: "forte",
    notes: "L'un des meilleurs raisins de table noirs. Grappes et baies moyennes a grosses. Bonne capacite de stockage. Rendement 10-18 t/ha.",
  },
  {
    espece: "Vigne de table",
    variete: "Italia",
    floraisonMois: "mai-juin",
    floraisonGroupe: null,
    recolteDebut: "septembre",
    recolteFin: "octobre",
    couleurFruit: "jaune-vert",
    poidsmoyenG: 500, // grappes pouvant peser jusqu'a 1 kg
    rendementKg: 12,
    conservationJours: 30,
    autofertile: true,
    groupePollinisation: null,
    pollinisateursRecommandes: [],
    saveur: "Musquee, croquante, juteuse, pulpe ferme",
    resistanceMaladies: "Sensible au mildiou, oidium, erinose et pourriture grise.",
    vigueur: "forte",
    notes: "Croisement Bicane x Muscat de Hambourg (Italie, 1911). Grosses grappes compactes, pouvant depasser 1 kg. Baies ovales, grosses. Maturite tardive (mi-sept a oct). Necessite chaleur durant la floraison. Resiste au transport et a la chambre froide.",
  },
  {
    espece: "Vigne de table",
    variete: "Alphonse Lavallee",
    floraisonMois: "mai-juin",
    floraisonGroupe: null,
    recolteDebut: "septembre",
    recolteFin: "octobre",
    couleurFruit: "noir violace",
    poidsmoyenG: 400, // grappe moyenne
    rendementKg: 12,
    conservationJours: 28, // 4 semaines en stockage commercial
    autofertile: true,
    groupePollinisation: null,
    pollinisateursRecommandes: [],
    saveur: "Legerement aromatique, peau epaisse et croquante, pulpe ferme et juteuse",
    resistanceMaladies: "Peu sensible a la pourriture grise (grappes laches). Sensible a l'oidium et au phomopsis.",
    vigueur: "forte",
    notes: "Croisement Gros Colman x Muscat de Hambourg. Grappes moyennes a grandes. Baies tres grosses. Rendement 15-25 t/ha. Tres bonne aptitude au stockage et au transport. Mi-saison (3 semaines apres Chasselas).",
  },
];

// ============================================================
// UTILITAIRE: generation SQL INSERT
// ============================================================

/**
 * Genere des instructions SQL INSERT pour une table de reference varietale.
 * Cette table peut etre creee separement ou les donnees peuvent servir
 * a pre-remplir les champs lors de l'ajout d'un arbre.
 */
export function generateSQL(): string {
  const lines: string[] = [];

  lines.push(`-- Referentiel varietal arbres fruitiers pour Gleba`);
  lines.push(`-- Genere automatiquement depuis seed-varietes-fruitiers.ts`);
  lines.push(`-- ${varieteFruitiers.length} varietes`);
  lines.push(``);
  lines.push(`CREATE TABLE IF NOT EXISTS referentiel_varietes_fruitiers (`);
  lines.push(`  id SERIAL PRIMARY KEY,`);
  lines.push(`  espece VARCHAR(50) NOT NULL,`);
  lines.push(`  variete VARCHAR(100) NOT NULL,`);
  lines.push(`  floraison_mois VARCHAR(20),`);
  lines.push(`  floraison_groupe VARCHAR(5),`);
  lines.push(`  recolte_debut VARCHAR(20),`);
  lines.push(`  recolte_fin VARCHAR(20),`);
  lines.push(`  couleur_fruit VARCHAR(100),`);
  lines.push(`  poids_moyen_g INTEGER,`);
  lines.push(`  rendement_kg INTEGER,`);
  lines.push(`  conservation_jours INTEGER,`);
  lines.push(`  autofertile BOOLEAN NOT NULL DEFAULT FALSE,`);
  lines.push(`  groupe_pollinisation VARCHAR(10),`);
  lines.push(`  pollinisateurs_recommandes TEXT,`);
  lines.push(`  saveur TEXT,`);
  lines.push(`  resistance_maladies TEXT,`);
  lines.push(`  vigueur VARCHAR(20),`);
  lines.push(`  notes TEXT,`);
  lines.push(`  UNIQUE(espece, variete)`);
  lines.push(`);`);
  lines.push(``);

  for (const v of varieteFruitiers) {
    const esc = (s: string | null) => s === null ? 'NULL' : `'${s.replace(/'/g, "''")}'`;
    const num = (n: number | null) => n === null ? 'NULL' : String(n);

    lines.push(`INSERT INTO referentiel_varietes_fruitiers (espece, variete, floraison_mois, floraison_groupe, recolte_debut, recolte_fin, couleur_fruit, poids_moyen_g, rendement_kg, conservation_jours, autofertile, groupe_pollinisation, pollinisateurs_recommandes, saveur, resistance_maladies, vigueur, notes)`);
    lines.push(`VALUES (${esc(v.espece)}, ${esc(v.variete)}, ${esc(v.floraisonMois)}, ${esc(v.floraisonGroupe)}, ${esc(v.recolteDebut)}, ${esc(v.recolteFin)}, ${esc(v.couleurFruit)}, ${num(v.poidsmoyenG)}, ${num(v.rendementKg)}, ${num(v.conservationJours)}, ${v.autofertile}, ${esc(v.groupePollinisation)}, ${esc(v.pollinisateursRecommandes.join(', '))}, ${esc(v.saveur)}, ${esc(v.resistanceMaladies)}, ${esc(v.vigueur)}, ${esc(v.notes)})`);
    lines.push(`ON CONFLICT (espece, variete) DO NOTHING;`);
    lines.push(``);
  }

  return lines.join('\n');
}
