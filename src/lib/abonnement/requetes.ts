import { aCapacite, type AccesService, type Capacite } from "./politique"
export const ENTETE_CHEMIN = "x-gleba-chemin"
export const ENTETE_METHODE = "x-gleba-methode"
const MARAICHAGE = /^(maraichage|cultures|planches|planification|recoltes|irrigations|itps|rotations|associations|consommations|phyto|registre-phyto|interventions|calendrier|calendrier-climat|user\/stocks)(\/|$)/
const VERGER = /^(arbres|verger)(\/|$)/
const COMPTE = /^(abonnement|account|auth|user\/(preferences|delete-data|api-token)|exploitation|cookie-consent|avis|signalements|evolutions|feedback|referentiel|communaute|admin|accueil\/version|notifications\/push)(\/|$)/
const COMMUN = /^(especes|varietes|familles|destinations|accueil|dashboard|capteurs|carte|jardin|objets-jardin|objets|parcelles|search|stocks|taches|sol|lunaire|tracabilite|upload|onboarding|import|import-test-data|export|notifications|public|desabonnement)(\/|$)/
/** Classification serveur, sans utiliser les préférences de menus. */
export function capaciteDuChemin(chemin: string): Capacite | "inconnu" {
  const p = chemin.replace(/^\/api\//, "").replace(/^\//, "")
  if (/^(chat|mcp)(\/|$)/.test(p)) return "ia"
  if (/^(meteo|calendrier-climat)(\/|$)/.test(p)) return "meteo"
  if (/^boutique(\/|$)/.test(p)) return "boutique"
  if (/^comptabilite(\/|$)/.test(p)) return "comptabilite"
  if (/^(elevage|soins)(\/|$)/.test(p)) return "elevage"
  if (VERGER.test(p)) return "verger"
  if (MARAICHAGE.test(p)) return "maraichage"
  if (COMMUN.test(p) || COMPTE.test(p)) return "commun"
  return "inconnu"
}
export function operationPermise(acces: AccesService, chemin: string, methode: string): boolean {
  const p = chemin.replace(/^\/api\//, "").replace(/^\//, "")
  if (p === "account/import" && (!acces.ecriture || acces.formule === "essentiel")) return false
  if (COMPTE.test(p)) return true
  const lecture = methode === "GET" || methode === "HEAD"
  // La récupération reste disponible après un essai ou un retour à Essentiel.
  if (lecture && (/\/(pdf|ubl|facturx|export)(\/|$)/.test(p) || /^(export|comptabilite\/export)(\/|$)/.test(p))) return true
  const capacite = capaciteDuChemin(chemin)
  if (capacite === "inconnu") return false
  if (lecture && (acces.etat === "lecture" || acces.etat === "a-demarrer")) return !["ia", "meteo", "boutique"].includes(capacite)
  if (!aCapacite(acces, capacite)) return false
  // Un import global ou un onboarding composite pourrait créer plusieurs ateliers.
  if (acces.formule === "essentiel" && !lecture && /^(account\/import|import|import-test-data|onboarding\/configurer)(\/|$)/.test(p)) return false
  return true
}
