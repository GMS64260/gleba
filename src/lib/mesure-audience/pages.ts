const PAGES_MESUREES = [
  "/login", "/register", "/mot-de-passe-oublie",
  "/communaute", "/referentiel", "/glossaire", "/licence",
  "/cgv", "/mentions-legales", "/confidentialite", "/tarifs", "/conditions-service",
  "/suppression-compte",
  "/logiciel-maraichage", "/logiciel-micro-ferme", "/logiciel-permaculture",
  "/logiciel-verger", "/logiciel-elevage", "/calendrier-semis",
  "/assistant-ia-agricole", "/logiciel-arboriculture",
  "/logiciel-elevage-volailles", "/planification-maraichage",
  "/logiciel-elevage-ovin", "/logiciel-elevage-caprin",
  "/logiciel-elevage-canin-felin", "/logiciel-elevage-equin",
  "/logiciel-elevage-nac",
  "/rotation-cultures-maraichage", "/itineraire-technique-maraichage",
  "/registre-phytosanitaire",
  "/logiciel-potager",
  "/carnet-de-culture", "/plan-de-ferme",
  "/registre-phytosanitaire-numerique", "/comparatif-logiciels-maraichage",
]

export function estPageMesuree(chemin: string): boolean {
  if (chemin === "/") return true
  // Le suivi d'une commande porte un numéro privé : seules les vitrines et
  // les fiches produit sont publiques et mesurées.
  if (/^\/boutique\/[^/]+(?:\/produit\/\d+)?\/?$/.test(chemin)) return true
  return PAGES_MESUREES.some((page) => chemin === page || chemin.startsWith(page + "/"))
}

