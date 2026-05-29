/**
 * Base de données des calendriers d'entretien des arbres
 * Données phénologiques intégrées pour ~15 especes courantes
 */

export interface TreeCareOperation {
  type: "taille" | "traitement" | "fertilisation" | "recolte" | "greffe" | "autre"
  label: string
  description: string
  moisDebut: number // 1-12
  moisFin: number   // 1-12 (peut wrapper: 11→2 = nov-fév)
  priorite: "haute" | "moyenne" | "basse"
  recurrence: "annuelle"
  saisonRecommandee: "hiver" | "printemps" | "ete" | "automne"
}

export interface TreeCareProfile {
  espece: string
  aliases: string[]
  type: string
  operations: TreeCareOperation[]
}

export const TREE_CARE_PROFILES: TreeCareProfile[] = [
  {
    espece: "Pommier",
    aliases: ["Malus", "pommier domestique", "apple"],
    type: "fruitier",
    operations: [
      { type: "taille", label: "Taille de formation/fructification", description: "Supprimer gourmands, bois mort, aérer le centre", moisDebut: 1, moisFin: 3, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "hiver" },
      { type: "taille", label: "Taille en vert", description: "Éclaircissage des fruits, pincement des rameaux", moisDebut: 6, moisFin: 7, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "ete" },
      { type: "traitement", label: "Traitement hivernal (huile blanche)", description: "Pulvérisation huile de paraffine contre cochenilles et œufs d'insectes", moisDebut: 2, moisFin: 3, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "hiver" },
      // Bug feedback testeur 2026-05-25 (cmplk5arp) — La tavelure (Venturia
      // inaequalis) se traite au PRINTEMPS lors des projections d'ascospores
      // (BBCH 51-71), pas en novembre. La bouillie bordelaise d'automne (chute
      // des feuilles) cible le chancre (Nectria) et la bactériose, mais PAS
      // la tavelure. On sépare en deux opérations distinctes.
      { type: "traitement", label: "Bouillie bordelaise (chancre)", description: "Traitement préventif à la chute des feuilles contre le chancre (Nectria) et les bactérioses", moisDebut: 11, moisFin: 12, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "automne" },
      { type: "traitement", label: "Traitement anti-tavelure", description: "Bouillie bordelaise au stade pré-floral (BBCH 51-71) contre la tavelure (Venturia inaequalis)", moisDebut: 3, moisFin: 5, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "printemps" },
      { type: "fertilisation", label: "Apport de compost", description: "Enfouir compost mûr au pied, 3-5 kg/arbre", moisDebut: 3, moisFin: 4, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "printemps" },
      // Bug feedback testeur 2026-05-25 (cmplk375i) — Le profil générique
      // "Pommier" annonçait la récolte août-octobre, ce qui est trop précoce
      // pour les variétés tardives (Belle de Boskoop, Reinette du Canada,
      // Granny, etc.). Le code consommateur doit affiner par variété.
      { type: "recolte", label: "Récolte des pommes", description: "Récolte à maturité selon variété : précoces fin août (Reinette, Reine des Reinettes), mi-saison sept-oct (Golden), tardives mi-sept à fin oct (Belle de Boskoop, Reinette du Canada, Granny)", moisDebut: 9, moisFin: 10, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "automne" },
      // Bug feedback testeur 2026-05-25 (cmplk6ira) — La greffe en fente se
      // pratique en repos végétatif (fév-mars, sujet dormant) alors que la
      // greffe en couronne nécessite le démarrage de sève (avril-mai, écorce
      // décollée). On sépare en deux opérations.
      { type: "greffe", label: "Greffe en fente", description: "Greffe en fente sur porte-greffe en repos végétatif (avant montée de sève)", moisDebut: 2, moisFin: 3, priorite: "basse", recurrence: "annuelle", saisonRecommandee: "printemps" },
      { type: "greffe", label: "Greffe en couronne", description: "Greffe en couronne au démarrage de sève (écorce décollée)", moisDebut: 4, moisFin: 5, priorite: "basse", recurrence: "annuelle", saisonRecommandee: "printemps" },
    ],
  },
  {
    espece: "Poirier",
    aliases: ["Pyrus", "poirier commun"],
    type: "fruitier",
    operations: [
      { type: "taille", label: "Taille de fructification", description: "Raccourcir les rameaux, supprimer bois mort", moisDebut: 1, moisFin: 3, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "hiver" },
      { type: "taille", label: "Taille en vert", description: "Pincement et éclaircissage des fruits", moisDebut: 6, moisFin: 7, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "ete" },
      { type: "traitement", label: "Traitement hivernal", description: "Huile blanche + bouillie bordelaise", moisDebut: 2, moisFin: 3, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "hiver" },
      { type: "fertilisation", label: "Fumure de fond", description: "Compost ou fumier décomposé au pied", moisDebut: 11, moisFin: 12, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "automne" },
      { type: "recolte", label: "Récolte des poires", description: "Récolte avant pleine maturité pour conservation", moisDebut: 8, moisFin: 10, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "automne" },
    ],
  },
  {
    espece: "Cerisier",
    aliases: ["Prunus cerasus", "Prunus avium", "cerisier doux", "cerisier acide", "griottier"],
    type: "fruitier",
    operations: [
      // Bug #3 audit Marc 2026-05-14 — Prunus : taille principale APRÈS la
      // récolte (post-récolte) PLUS taille en vert juin-août. Aucune taille
      // hivernale (gommose + chancre bactérien).
      { type: "taille", label: "Taille douce après récolte", description: "Taille légère uniquement, le cerisier supporte mal la taille sévère", moisDebut: 7, moisFin: 8, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "ete" },
      { type: "taille", label: "Taille en vert", description: "Pincement des pousses vigoureuses, éclaircissage léger des fruits", moisDebut: 6, moisFin: 8, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "ete" },
      { type: "traitement", label: "Traitement anti-moniliose", description: "Bouillie bordelaise à la chute des feuilles", moisDebut: 11, moisFin: 11, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "automne" },
      { type: "traitement", label: "Traitement floraison", description: "Bouillie bordelaise avant débourrement contre la moniliose", moisDebut: 2, moisFin: 3, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "hiver" },
      { type: "fertilisation", label: "Apport de compost", description: "Compost mûr ou fumier au pied", moisDebut: 3, moisFin: 4, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "printemps" },
      { type: "recolte", label: "Récolte des cerises", description: "Récolte à maturité, fruits fragiles", moisDebut: 6, moisFin: 7, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "ete" },
    ],
  },
  {
    espece: "Prunier",
    aliases: ["Prunus domestica", "prunier domestique", "quetschier", "mirabellier", "reine-claude"],
    type: "fruitier",
    operations: [
      // PROMPT 05 — Audit Verger : les Prunus se taillent APRÈS la récolte
      // (juillet-août). Une taille hivernale favorise la gommose et le
      // chancre. Réf. INRAE / CTIFL.
      { type: "taille", label: "Taille après récolte", description: "Taille douce post-récolte (juillet-août) pour éviter gommose et chancre. Pas de taille hivernale.", moisDebut: 7, moisFin: 8, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "ete" },
      { type: "taille", label: "Taille en vert", description: "Pincement des pousses vigoureuses, éclaircissage des fruits", moisDebut: 6, moisFin: 8, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "ete" },
      { type: "traitement", label: "Traitement hivernal", description: "Bouillie bordelaise contre les maladies cryptogamiques", moisDebut: 2, moisFin: 3, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "hiver" },
      { type: "fertilisation", label: "Fumure printanière", description: "Compost au pied de l'arbre", moisDebut: 3, moisFin: 4, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "printemps" },
      { type: "recolte", label: "Récolte des prunes", description: "Récolte selon variété (mirabelle, quetsche, reine-claude)", moisDebut: 7, moisFin: 9, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "ete" },
    ],
  },
  {
    espece: "Pêcher",
    aliases: ["Prunus persica", "pêcher commun", "nectarinier"],
    type: "fruitier",
    operations: [
      // PROMPT 05 — Prunus : taille principale APRÈS récolte (juillet-août).
      // L'éclaircissage en vert reste possible au printemps (cf. opération
      // suivante), mais la taille de fructification hivernale est supprimée.
      { type: "taille", label: "Taille après récolte", description: "Taille trigemme post-récolte (juil.-août) : conserver 3 yeux par rameau, éviter gommose.", moisDebut: 7, moisFin: 8, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "ete" },
      { type: "taille", label: "Taille en vert", description: "Pincement des rameaux trop vigoureux, juin-août", moisDebut: 6, moisFin: 8, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "ete" },
      { type: "taille", label: "Éclaircissage des fruits", description: "Retirer les fruits en surnombre (1 fruit tous les 10 cm)", moisDebut: 5, moisFin: 6, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "printemps" },
      { type: "traitement", label: "Traitement cloque", description: "Bouillie bordelaise au gonflement des bourgeons", moisDebut: 2, moisFin: 2, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "hiver" },
      { type: "traitement", label: "Traitement automnal", description: "Bouillie bordelaise à la chute des feuilles", moisDebut: 11, moisFin: 11, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "automne" },
      { type: "fertilisation", label: "Fertilisation printanière", description: "Compost riche en potasse", moisDebut: 3, moisFin: 4, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "printemps" },
      { type: "recolte", label: "Récolte des pêches", description: "Récolte à maturité, fruits fragiles", moisDebut: 7, moisFin: 9, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "ete" },
    ],
  },
  {
    espece: "Abricotier",
    aliases: ["Prunus armeniaca"],
    type: "fruitier",
    operations: [
      { type: "taille", label: "Taille légère après récolte", description: "Taille douce, l'abricotier cicatrise mal", moisDebut: 8, moisFin: 9, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "ete" },
      { type: "taille", label: "Taille en vert", description: "Pincement des gourmands, éclaircissage des fruits", moisDebut: 6, moisFin: 8, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "ete" },
      { type: "traitement", label: "Traitement hivernal", description: "Bouillie bordelaise contre moniliose et bactériose", moisDebut: 1, moisFin: 2, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "hiver" },
      { type: "fertilisation", label: "Fumure d'automne", description: "Compost ou fumier bien décomposé", moisDebut: 10, moisFin: 11, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "automne" },
      { type: "recolte", label: "Récolte des abricots", description: "Récolte à maturité, fruits fragiles", moisDebut: 6, moisFin: 8, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "ete" },
    ],
  },
  {
    espece: "Olivier",
    aliases: ["Olea europaea", "olivier commun"],
    type: "fruitier",
    operations: [
      { type: "taille", label: "Taille de fructification", description: "Aérer le centre, raccourcir les branches trop longues", moisDebut: 3, moisFin: 4, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "printemps" },
      { type: "traitement", label: "Traitement mouche de l'olive", description: "Pièges à phéromones ou argile (kaolin)", moisDebut: 6, moisFin: 9, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "ete" },
      { type: "traitement", label: "Bouillie bordelaise", description: "Prévention œil de paon (cycloconium)", moisDebut: 3, moisFin: 4, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "printemps" },
      { type: "fertilisation", label: "Fertilisation organique", description: "Compost ou fumier au pied, 5-10 kg/arbre", moisDebut: 3, moisFin: 4, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "printemps" },
      { type: "recolte", label: "Récolte des olives", description: "Olives vertes (sept) ou noires (nov-déc)", moisDebut: 10, moisFin: 12, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "automne" },
    ],
  },
  {
    espece: "Figuier",
    aliases: ["Ficus carica", "figuier commun"],
    type: "fruitier",
    operations: [
      { type: "taille", label: "Taille de formation (hiver)", description: "Supprimer bois mort et branches qui se croisent. Pour les variétés UNIFÈRES uniquement.", moisDebut: 2, moisFin: 3, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "hiver" },
      // PROMPT 05 — Audit Verger : pour les variétés BIFÈRES, la taille
      // hivernale supprime les rameaux qui porteront les figues-fleurs.
      // On taille donc après la récolte d'été (juil.-août), légèrement.
      { type: "taille", label: "Taille bifère post-récolte d'été", description: "Pour les variétés BIFÈRES uniquement : taille légère après la récolte des figues-fleurs (juillet-août).", moisDebut: 7, moisFin: 8, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "ete" },
      { type: "fertilisation", label: "Apport de compost", description: "Compost riche au pied", moisDebut: 3, moisFin: 4, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "printemps" },
      { type: "recolte", label: "Récolte figues-fleurs", description: "Première récolte (variétés bifères)", moisDebut: 6, moisFin: 7, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "ete" },
      { type: "recolte", label: "Récolte des figues d'automne", description: "Récolte principale", moisDebut: 8, moisFin: 10, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "automne" },
    ],
  },
  {
    espece: "Noyer",
    aliases: ["Juglans regia", "noyer commun"],
    type: "fruitier",
    operations: [
      { type: "taille", label: "Taille de nettoyage", description: "Supprimer bois mort uniquement, taille minimale", moisDebut: 9, moisFin: 10, priorite: "basse", recurrence: "annuelle", saisonRecommandee: "automne" },
      { type: "fertilisation", label: "Fumure de fond", description: "Compost ou fumier au pied", moisDebut: 11, moisFin: 12, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "automne" },
      { type: "recolte", label: "Récolte des noix", description: "Ramasser les noix tombées au sol", moisDebut: 9, moisFin: 10, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "automne" },
    ],
  },
  {
    espece: "Châtaignier",
    aliases: ["Castanea sativa", "chataignier"],
    type: "fruitier",
    operations: [
      { type: "taille", label: "Taille d'entretien", description: "Supprimer branches mortes et rejets de souche", moisDebut: 1, moisFin: 2, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "hiver" },
      { type: "traitement", label: "Traitement chancre", description: "Surveillance et traitement si nécessaire", moisDebut: 4, moisFin: 5, priorite: "basse", recurrence: "annuelle", saisonRecommandee: "printemps" },
      { type: "fertilisation", label: "Amendement acide", description: "Compost de feuilles ou terre de bruyère", moisDebut: 3, moisFin: 4, priorite: "basse", recurrence: "annuelle", saisonRecommandee: "printemps" },
      { type: "recolte", label: "Récolte des châtaignes", description: "Ramasser les bogues au sol", moisDebut: 10, moisFin: 11, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "automne" },
    ],
  },
  {
    espece: "Vigne",
    aliases: ["Vitis vinifera", "vigne", "raisin", "raisin de table"],
    type: "fruitier",
    operations: [
      { type: "taille", label: "Taille d'hiver (taille sèche)", description: "Taille Guyot ou cordon : conserver 2-3 sarments, 6-8 yeux", moisDebut: 1, moisFin: 2, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "hiver" },
      { type: "taille", label: "Ébourgeonnage et palissage", description: "Supprimer pousses inutiles, palisser les sarments", moisDebut: 5, moisFin: 6, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "printemps" },
      { type: "taille", label: "Effeuillage et écimage", description: "Aérer la zone des grappes, couper les apex", moisDebut: 7, moisFin: 8, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "ete" },
      { type: "traitement", label: "Traitement mildiou/oïdium", description: "Bouillie bordelaise + soufre, toutes les 2-3 semaines", moisDebut: 5, moisFin: 8, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "printemps" },
      { type: "fertilisation", label: "Fumure hivernale", description: "Compost ou fumier en surface", moisDebut: 12, moisFin: 1, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "hiver" },
      { type: "recolte", label: "Vendange / récolte du raisin", description: "Récolte à maturité selon usage (table ou vin)", moisDebut: 9, moisFin: 10, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "automne" },
    ],
  },
  {
    espece: "Agrumes",
    aliases: ["Citrus", "citronnier", "oranger", "mandarinier", "clémentinier", "kumquat", "pamplemoussier", "bergamotier"],
    type: "fruitier",
    operations: [
      { type: "taille", label: "Taille de mise en forme", description: "Aérer le centre, supprimer bois mort et gourmands", moisDebut: 3, moisFin: 4, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "printemps" },
      { type: "traitement", label: "Traitement cochenilles", description: "Huile blanche ou savon noir si infestation", moisDebut: 5, moisFin: 6, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "printemps" },
      { type: "fertilisation", label: "Fertilisation spéciale agrumes", description: "Engrais riche en azote et oligo-éléments, 3 apports/an", moisDebut: 3, moisFin: 4, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "printemps" },
      { type: "fertilisation", label: "2e apport engrais", description: "Engrais agrumes en été", moisDebut: 6, moisFin: 7, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "ete" },
      { type: "recolte", label: "Récolte des agrumes", description: "Récolte selon espèce (citron toute l'année, orange hiver)", moisDebut: 11, moisFin: 3, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "hiver" },
      { type: "autre", label: "Protection hivernale", description: "Voile d'hivernage ou rentrée si en pot (T < -5°C)", moisDebut: 11, moisFin: 3, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "hiver" },
    ],
  },
  {
    espece: "Érable du Japon",
    aliases: ["Acer palmatum", "erable du japon", "érable japonais", "erable japonais", "acer"],
    type: "ornement",
    operations: [
      { type: "taille", label: "Taille douce de mise en forme", description: "Taille légère pour garder le port naturel, supprimer bois mort", moisDebut: 11, moisFin: 12, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "automne" },
      { type: "fertilisation", label: "Paillage et compost", description: "Compost de feuilles, terre de bruyère, paillage épais", moisDebut: 3, moisFin: 4, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "printemps" },
      { type: "autre", label: "Protection soleil/gel", description: "Ombrage en été si canicule, paillage épais en hiver", moisDebut: 6, moisFin: 8, priorite: "basse", recurrence: "annuelle", saisonRecommandee: "ete" },
    ],
  },
  {
    espece: "Framboisier",
    aliases: ["Rubus idaeus", "framboise"],
    type: "petit_fruit",
    operations: [
      { type: "taille", label: "Taille des cannes ayant fructifié", description: "Couper au ras du sol les cannes de l'année précédente (non-remontants)", moisDebut: 2, moisFin: 3, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "hiver" },
      { type: "taille", label: "Taille des remontants", description: "Rabattre toutes les cannes si remontant, ou seulement les anciennes", moisDebut: 11, moisFin: 12, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "automne" },
      { type: "fertilisation", label: "Apport de compost", description: "Compost bien mûr et paillage au pied", moisDebut: 3, moisFin: 4, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "printemps" },
      { type: "recolte", label: "Récolte des framboises", description: "Récolte tous les 2-3 jours à maturité", moisDebut: 6, moisFin: 10, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "ete" },
    ],
  },
  {
    espece: "Groseillier",
    aliases: ["Ribes", "groseillier à grappes", "groseillier à maquereau"],
    type: "petit_fruit",
    operations: [
      { type: "taille", label: "Taille de rajeunissement", description: "Supprimer 1/3 des vieux bois chaque année", moisDebut: 1, moisFin: 2, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "hiver" },
      { type: "traitement", label: "Décoction de prêle", description: "Préventif oïdium et autres cryptogames", moisDebut: 4, moisFin: 5, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "printemps" },
      { type: "fertilisation", label: "Apport de compost + paillage", description: "Compost et paillage au pied des plants", moisDebut: 3, moisFin: 4, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "printemps" },
      { type: "recolte", label: "Récolte des groseilles", description: "Récolte en grappes entières", moisDebut: 6, moisFin: 8, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "ete" },
    ],
  },
  // Bug #3 — Profils manquants (audit Marc 14/05/2026 : étendre aux 28 espèces).
  // Patterns ITAB/CTIFL — relire avec PM avant prod.
  {
    espece: "Cassissier",
    aliases: ["Ribes nigrum", "cassis"],
    type: "petit_fruit",
    operations: [
      { type: "taille", label: "Taille de rajeunissement (hiver)", description: "Supprimer 1/3 des vieilles tiges, conserver 8-10 tiges max", moisDebut: 1, moisFin: 2, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "hiver" },
      { type: "fertilisation", label: "Paillage + compost", description: "Compost mûr et paillage 5-10 cm au pied", moisDebut: 3, moisFin: 4, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "printemps" },
      { type: "traitement", label: "Décoction de prêle", description: "Préventif anti-oïdium, plusieurs passages avant fructification", moisDebut: 4, moisFin: 6, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "printemps" },
      { type: "recolte", label: "Récolte des cassis", description: "Récolte en grappes à maturité", moisDebut: 6, moisFin: 7, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "ete" },
    ],
  },
  {
    espece: "Cognassier",
    aliases: ["Cydonia oblonga", "cognassier commun"],
    type: "fruitier",
    operations: [
      { type: "taille", label: "Taille de fructification (hiver)", description: "Pomacée : aérer le centre, supprimer bois mort", moisDebut: 1, moisFin: 2, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "hiver" },
      { type: "taille", label: "Taille en vert", description: "Pincement et éclaircissage des fruits", moisDebut: 6, moisFin: 7, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "ete" },
      { type: "traitement", label: "Traitement hivernal", description: "Huile blanche + bouillie bordelaise (tavelure)", moisDebut: 2, moisFin: 3, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "hiver" },
      { type: "fertilisation", label: "Apport de compost", description: "Compost mûr au pied", moisDebut: 3, moisFin: 4, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "printemps" },
      { type: "recolte", label: "Récolte des coings", description: "Récolte à maturité, fruits à transformer", moisDebut: 10, moisFin: 11, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "automne" },
    ],
  },
  {
    espece: "Néflier",
    aliases: ["Mespilus germanica", "neflier du japon", "Eriobotrya japonica", "bibassier"],
    type: "fruitier",
    operations: [
      { type: "taille", label: "Taille de formation (hiver)", description: "Pomacée : taille légère, supprimer bois mort", moisDebut: 1, moisFin: 2, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "hiver" },
      { type: "taille", label: "Taille en vert", description: "Pincement des pousses vigoureuses", moisDebut: 6, moisFin: 7, priorite: "basse", recurrence: "annuelle", saisonRecommandee: "ete" },
      { type: "fertilisation", label: "Apport de compost", description: "Compost mûr au pied", moisDebut: 3, moisFin: 4, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "printemps" },
      { type: "recolte", label: "Récolte des nèfles", description: "Récolte après les premières gelées (blettissement)", moisDebut: 11, moisFin: 12, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "automne" },
    ],
  },
  {
    espece: "Amandier",
    aliases: ["Prunus dulcis", "Prunus amygdalus"],
    type: "fruitier",
    operations: [
      // Prunus → pas de taille hivernale.
      { type: "taille", label: "Taille après récolte", description: "Taille douce post-récolte pour éviter gommose. Pas de taille hivernale.", moisDebut: 9, moisFin: 10, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "automne" },
      { type: "taille", label: "Taille en vert", description: "Pincement des pousses vigoureuses", moisDebut: 6, moisFin: 8, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "ete" },
      { type: "traitement", label: "Traitement cloque", description: "Bouillie bordelaise au gonflement des bourgeons", moisDebut: 2, moisFin: 2, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "hiver" },
      { type: "fertilisation", label: "Fertilisation printanière", description: "Compost au pied", moisDebut: 3, moisFin: 4, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "printemps" },
      { type: "recolte", label: "Récolte des amandes", description: "Récolte en gaule, séchage", moisDebut: 8, moisFin: 9, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "ete" },
    ],
  },
  {
    espece: "Kiwi",
    aliases: ["Actinidia", "Actinidia deliciosa", "Actinidia arguta", "kiwaï"],
    type: "fruitier",
    operations: [
      { type: "taille", label: "Taille d'hiver (taille sèche)", description: "Liane : conserver 8-10 sarments, palisser en cordon double", moisDebut: 1, moisFin: 2, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "hiver" },
      { type: "taille", label: "Taille en vert", description: "Pincement des pousses à 4-5 feuilles au-dessus du dernier fruit", moisDebut: 6, moisFin: 7, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "ete" },
      { type: "fertilisation", label: "Apport de compost et paillage", description: "Compost + paillage épais (sol acide à neutre)", moisDebut: 3, moisFin: 4, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "printemps" },
      { type: "recolte", label: "Récolte des kiwis", description: "Récolte avant les gelées, mûrir en cagette", moisDebut: 10, moisFin: 11, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "automne" },
    ],
  },
  {
    espece: "Grenadier",
    aliases: ["Punica granatum"],
    type: "fruitier",
    operations: [
      { type: "taille", label: "Taille douce printanière", description: "Supprimer rejets et bois mort, aérer le centre", moisDebut: 3, moisFin: 4, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "printemps" },
      { type: "fertilisation", label: "Apport de compost", description: "Compost mûr au pied", moisDebut: 3, moisFin: 4, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "printemps" },
      { type: "autre", label: "Protection hivernale", description: "Paillage au pied si T < -10°C, voile pour jeunes arbres", moisDebut: 11, moisFin: 3, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "hiver" },
      { type: "recolte", label: "Récolte des grenades", description: "Récolte à maturité, fruits qui craquent légèrement", moisDebut: 10, moisFin: 11, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "automne" },
    ],
  },
  {
    espece: "Plaqueminier",
    aliases: ["Diospyros kaki", "Kaki-pomme", "kaki", "plaqueminier du japon"],
    type: "fruitier",
    operations: [
      { type: "taille", label: "Taille douce printanière", description: "Taille légère après risque gelée, supprimer bois mort", moisDebut: 3, moisFin: 4, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "printemps" },
      { type: "fertilisation", label: "Compost de fond", description: "Compost ou fumier décomposé au pied", moisDebut: 11, moisFin: 12, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "automne" },
      { type: "recolte", label: "Récolte des kakis", description: "Récolte après chute des feuilles, fruits mûrs ou à mûrir", moisDebut: 10, moisFin: 12, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "automne" },
    ],
  },
  {
    espece: "Argousier",
    aliases: ["Hippophae rhamnoides"],
    type: "petit_fruit",
    operations: [
      { type: "taille", label: "Taille douce après récolte", description: "Supprimer drageons et rééquilibrer pied mâle/femelle", moisDebut: 10, moisFin: 11, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "automne" },
      { type: "fertilisation", label: "Apport modéré", description: "Le pommeau d'argousier fixe l'azote — apport de compost léger", moisDebut: 3, moisFin: 4, priorite: "basse", recurrence: "annuelle", saisonRecommandee: "printemps" },
      { type: "recolte", label: "Récolte des baies", description: "Récolte sur rameau coupé puis congélation pour égrenage", moisDebut: 8, moisFin: 10, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "automne" },
    ],
  },
  {
    espece: "Sureau",
    aliases: ["Sambucus nigra", "sureau noir"],
    type: "petit_fruit",
    operations: [
      { type: "taille", label: "Taille de rajeunissement", description: "Recéper les vieilles tiges après floraison", moisDebut: 11, moisFin: 2, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "hiver" },
      { type: "fertilisation", label: "Compost de surface", description: "Compost mûr, paillage", moisDebut: 3, moisFin: 4, priorite: "basse", recurrence: "annuelle", saisonRecommandee: "printemps" },
      { type: "recolte", label: "Récolte des fleurs", description: "Cueillette des fleurs pour sirops et confitures", moisDebut: 5, moisFin: 6, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "printemps" },
      { type: "recolte", label: "Récolte des baies", description: "Récolte en grappes à pleine maturité", moisDebut: 8, moisFin: 9, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "ete" },
    ],
  },
  {
    espece: "Mûrier",
    aliases: ["Morus", "Morus nigra", "mûrier platane", "Morus alba", "mûrier sans épine", "ronce"],
    type: "petit_fruit",
    operations: [
      { type: "taille", label: "Taille de formation (hiver)", description: "Supprimer bois mort, équilibrer la charpente", moisDebut: 1, moisFin: 2, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "hiver" },
      { type: "fertilisation", label: "Apport de compost", description: "Compost mûr au pied", moisDebut: 3, moisFin: 4, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "printemps" },
      { type: "recolte", label: "Récolte des mûres", description: "Récolte échelonnée à maturité", moisDebut: 7, moisFin: 9, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "ete" },
    ],
  },
  {
    espece: "Fraisier",
    aliases: ["Fragaria", "Fragaria × ananassa", "fraise", "fraisier remontant", "fraisier non-remontant"],
    type: "petit_fruit",
    operations: [
      { type: "taille", label: "Nettoyage du feuillage", description: "Supprimer les feuilles abîmées et les stolons en excès après fructification", moisDebut: 8, moisFin: 9, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "ete" },
      { type: "fertilisation", label: "Paillage + compost", description: "Compost mûr + paille au pied pour garder fruits propres", moisDebut: 3, moisFin: 4, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "printemps" },
      { type: "traitement", label: "Décoction de prêle", description: "Préventif anti-oïdium et taches sur feuilles", moisDebut: 4, moisFin: 6, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "printemps" },
      { type: "recolte", label: "Récolte des fraises (non-remontants)", description: "Récolte tous les 1-2 jours en pleine production", moisDebut: 5, moisFin: 7, priorite: "haute", recurrence: "annuelle", saisonRecommandee: "ete" },
      { type: "recolte", label: "Récolte des fraises (remontants)", description: "Pour variétés remontantes : récolte également jusqu'aux premières gelées", moisDebut: 8, moisFin: 10, priorite: "moyenne", recurrence: "annuelle", saisonRecommandee: "automne" },
    ],
  },
]

/**
 * Recherche fuzzy d'un profil d'entretien par nom d'espece
 */
export function findTreeCareProfile(espece: string): TreeCareProfile | null {
  if (!espece) return null
  const search = espece.toLowerCase().trim()

  // Match exact sur le nom d'espece
  const exactMatch = TREE_CARE_PROFILES.find(
    (p) => p.espece.toLowerCase() === search
  )
  if (exactMatch) return exactMatch

  // Match sur les aliases
  const aliasMatch = TREE_CARE_PROFILES.find((p) =>
    p.aliases.some((a) => a.toLowerCase() === search)
  )
  if (aliasMatch) return aliasMatch

  // Match partiel (contient)
  const partialMatch = TREE_CARE_PROFILES.find(
    (p) =>
      p.espece.toLowerCase().includes(search) ||
      search.includes(p.espece.toLowerCase()) ||
      p.aliases.some(
        (a) => a.toLowerCase().includes(search) || search.includes(a.toLowerCase())
      )
  )
  if (partialMatch) return partialMatch

  return null
}

/**
 * QA Hélène 2026-05-15 — Bug #10 : "Reinette grise du Canada" (variété
 * tardive) sortait récolte 15/08, en réalité octobre-novembre. On
 * accepte désormais la variété en argument et on override le mois de
 * récolte pour les variétés tardives connues. Pour les opérations
 * non-récolte, on garde le 15 du mois de début (pas d'enjeu).
 */
const VARIETES_RECOLTE_TARDIVE: Record<string, number> = {
  // Pommiers tardifs (récolte oct-nov)
  "reinette grise du canada": 10,
  "reinette du canada": 10,
  "granny smith": 10,
  "belle de boskoop": 10,
  "idared": 10,
  "jonagold": 10,
  "goldrush": 11,
  "pink lady": 11,
  "calville blanc d'hiver": 10,
  "court-pendu": 11,
  // Poiriers tardifs
  "conference": 10,
  "passe-crassane": 10,
  "comice": 10,
  // Variétés mi-tardives
  "reine des reinettes": 9,
}

function normaliseVarieteForMatch(v: string | null | undefined): string {
  return (v ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim()
}

/**
 * Génère les opérations d'entretien pour une annee donnée
 * Retourne les données prêtes pour prisma.operationArbre.createMany()
 */
export function generateCareOperations(
  profile: TreeCareProfile,
  year: number,
  arbreId: number,
  userId: string,
  variete?: string | null
) {
  const varieteKey = normaliseVarieteForMatch(variete)
  const tardiveMois = VARIETES_RECOLTE_TARDIVE[varieteKey]

  return profile.operations.map((op) => {
    let moisCible = op.moisDebut
    if (op.type === "recolte") {
      if (tardiveMois && tardiveMois >= op.moisDebut && tardiveMois <= op.moisFin + 1) {
        moisCible = tardiveMois
      } else {
        // Milieu de la fenêtre de récolte plutôt que le tout début
        moisCible = Math.floor((op.moisDebut + op.moisFin) / 2)
      }
    }
    const dateCible = new Date(year, moisCible - 1, 15)
    return {
      userId,
      arbreId,
      type: op.type,
      description: `${op.label} — ${op.description}`,
      // Bug #8 — Aligner `date` sur `datePrevue` pour les ops non faites :
      // sinon `date` prenait le default Prisma now() et toutes les opérations
      // d'un arbre apparaissaient au jour du seed dans la liste.
      date: dateCible,
      datePrevue: dateCible,
      fait: false,
      recurrence: op.recurrence,
      saisonRecommandee: op.saisonRecommandee,
      notes: "auto:calendrier",
    }
  })
}

const MOIS_LABELS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"]

/** Familles Prunus : la taille hivernale favorise gommose et chancre. */
const PRUNUS = ["cerisier", "prunier", "pêcher", "pecher", "abricotier", "amandier"]

/**
 * Délai indicatif d'entrée en production (années après plantation), par
 * espèce. Sources : INRAE/CTIFL (formes basse-tige/porte-greffes courants).
 * Feedback testeur cmpmqv4og/cmpm704oo : un arbre récemment planté ne peut
 * pas être "productif".
 */
const ANNEES_AVANT_PRODUCTION: Record<string, number> = {
  pommier: 3, poirier: 4, cerisier: 4, prunier: 3, pêcher: 3, pecher: 3,
  abricotier: 3, amandier: 4, noyer: 6, châtaignier: 6, chataignier: 6,
  noisetier: 4, figuier: 2, olivier: 5, vigne: 3, kiwi: 3, cognassier: 3,
  néflier: 3, neflier: 3, grenadier: 4, plaqueminier: 4, agrumes: 3,
  framboisier: 1, groseillier: 2, cassissier: 2, mûrier: 2, murier: 2,
  fraisier: 1, sureau: 2, argousier: 3,
}

export interface ProductifWarning {
  tooYoung: boolean
  anneeEstimee: number | null
  message: string
}

/**
 * Vérifie la cohérence du statut "productif" avec l'âge de l'arbre.
 * Retourne un avertissement si l'arbre est marqué productif alors qu'il
 * n'a pas atteint l'âge d'entrée en production de son espèce.
 */
export function checkProductifCoherence(
  espece: string | null | undefined,
  datePlantation: string | Date | null | undefined,
  productif: boolean
): ProductifWarning | null {
  if (!productif || !espece || !datePlantation) return null
  const d = typeof datePlantation === "string" ? new Date(datePlantation) : datePlantation
  if (Number.isNaN(d.getTime())) return null
  const especeNorm = espece.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim()
  let delai: number | undefined
  for (const [k, v] of Object.entries(ANNEES_AVANT_PRODUCTION)) {
    const kn = k.normalize("NFD").replace(/[̀-ͯ]/g, "")
    if (especeNorm.includes(kn)) { delai = v; break }
  }
  if (delai == null) return null
  const now = new Date()
  const ageAns = (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
  if (ageAns >= delai) return null
  const anneeEstimee = d.getFullYear() + delai
  return {
    tooYoung: true,
    anneeEstimee,
    message: `Cet arbre a ~${Math.max(0, Math.floor(ageAns))} an(s) ; un ${espece.toLowerCase()} entre généralement en production vers ${delai} ans (≈ ${anneeEstimee}). Le statut « Productif » semble prématuré.`,
  }
}

function moisDansFenetre(mois: number, debut: number, fin: number): boolean {
  if (debut <= fin) return mois >= debut && mois <= fin
  return mois >= debut || mois <= fin // wrap-around (ex. nov→fév)
}

export interface SaisonWarning {
  niveau: "alerte" | "info"
  message: string
}

/**
 * Vérifie si une opération (taille, traitement, récolte…) tombe dans une
 * période agronomiquement recommandée pour l'espèce. Retourne un
 * avertissement NON bloquant si la date est hors fenêtre.
 *
 * Feedback testeurs 2026-05-26 (cmpmqshr3 : taille cerisier en mars ;
 * cmpm719ks : taille de formation pommier en mai). Sources : INRAE,
 * CTIFL, ITAB.
 */
export function checkOperationSaison(
  espece: string | null | undefined,
  type: string,
  date: Date | string | null | undefined,
  variete?: string | null
): SaisonWarning | null {
  if (!espece || !type || !date) return null
  const d = typeof date === "string" ? new Date(date) : date
  if (Number.isNaN(d.getTime())) return null
  const mois = d.getMonth() + 1
  const especeNorm = espece.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim()

  // Garde-fou spécifique Prunus : pas de taille en repos végétatif
  // (déc.-mars) — risque chancre bactérien / gommose.
  if (type === "taille" && PRUNUS.some((p) => especeNorm.includes(p.normalize("NFD").replace(/[̀-ͯ]/g, "")))) {
    if (mois === 12 || mois <= 3) {
      return {
        niveau: "alerte",
        message:
          "Les Prunus (cerisier, prunier, pêcher…) ne se taillent pas en hiver/début de printemps : risque de chancre bactérien et de gommose. Taillez de préférence après la récolte (juillet-août).",
      }
    }
  }

  const profile = findTreeCareProfile(espece)
  if (!profile) return null

  const opsType = profile.operations.filter((o) => o.type === type)
  if (opsType.length === 0) return null

  const dansUneFenetre = opsType.some((o) => moisDansFenetre(mois, o.moisDebut, o.moisFin))
  if (dansUneFenetre) return null

  const fenetres = opsType
    .map((o) =>
      o.moisDebut === o.moisFin
        ? MOIS_LABELS[o.moisDebut - 1]
        : `${MOIS_LABELS[o.moisDebut - 1]}–${MOIS_LABELS[o.moisFin - 1]}`
    )
    .join(", ")
  const typeLabel: Record<string, string> = {
    taille: "La taille", traitement: "Le traitement", recolte: "La récolte",
    fertilisation: "La fertilisation", greffe: "La greffe",
  }
  return {
    niveau: "info",
    message: `${typeLabel[type] ?? "Cette opération"} du ${profile.espece.toLowerCase()} est habituellement recommandée en ${fenetres}. La date saisie (${MOIS_LABELS[mois - 1]}) est hors de cette période.`,
  }
}

export interface MonthlyCalendarEntry {
  mois: number
  label: string
  operations: TreeCareOperation[]
}

/**
 * Retourne les opérations organisées par mois (pour affichage Gantt)
 */
export function getMonthlyCalendar(profile: TreeCareProfile): MonthlyCalendarEntry[] {
  return Array.from({ length: 12 }, (_, i) => {
    const mois = i + 1
    const ops = profile.operations.filter((op) => {
      if (op.moisDebut <= op.moisFin) {
        return mois >= op.moisDebut && mois <= op.moisFin
      }
      // Wrap-around (ex: 11→2 = nov, déc, jan, fév)
      return mois >= op.moisDebut || mois <= op.moisFin
    })
    return { mois, label: MOIS_LABELS[i], operations: ops }
  })
}
