/**
 * Plafond des essais de connexion par mot de passe (MC4, revue du 2026-11-11).
 *
 * `authorize` cherchait le compte puis lançait bcrypt sans aucune limite : un
 * script pouvait essayer des mots de passe en continu, et chaque essai coûtait
 * un bcrypt au serveur. Deux compteurs, consultés AVANT la recherche du compte
 * et avant bcrypt :
 *   - IP + compte normalisé : 10 essais par quart d'heure (devinette ciblée) ;
 *   - IP seule : 100 essais par quart d'heure (une liste d'identifiants volés
 *     essayée compte par compte ne dépasse jamais le premier plafond).
 *
 * Choix tenus ici :
 *   - l'essai est compté À L'ENTRÉE, pas après l'échec : vingt requêtes
 *     simultanées ne passent pas toutes avant le premier refus ;
 *   - une connexion réussie efface le compteur IP + compte et rend son essai
 *     au compteur de l'IP (une ferme derrière une même box ne s'épuise pas) ;
 *   - le compteur ne dépend ni de l'existence du compte ni de la justesse du
 *     mot de passe : au-delà du plafond, la réponse est la même pour tous, et
 *     c'est celle d'un mot de passe erroné (même code `identifiants`) : elle
 *     ne renseigne ni sur le compte ni sur le plafond lui-même ;
 *   - pas de compteur par compte seul : n'importe qui pourrait alors fermer la
 *     porte au titulaire depuis une autre adresse.
 *
 * Module PUR : atteignable depuis `auth.ts`, donc depuis le middleware
 * (compatible Edge : ni `crypto`, ni `fs`, ni minuterie au chargement). La
 * mémoire est celle du processus, comme `rate-limit.ts` : Gleba tourne sur un
 * seul processus Node ; un redémarrage remet les compteurs à zéro.
 */

export const PLAFOND_CONNEXION = {
  FENETRE_MS: 15 * 60 * 1000,
  MAX_PAR_IP_ET_COMPTE: 10,
  MAX_PAR_IP: 100,
} as const

interface Compteur {
  essais: number
  finMs: number
}

/** Au-delà, les entrées expirées sont balayées à la prochaine écriture. */
const SEUIL_BALAYAGE = 5000

// Ancré sur `globalThis` : en développement, le rechargement à chaud recrée le
// module et aurait sinon remis les compteurs à zéro à chaque recompilation.
const ancre = globalThis as unknown as {
  __glebaPlafondConnexion?: Map<string, Compteur>
}
const compteurs = (ancre.__glebaPlafondConnexion ??= new Map<string, Compteur>())

const cleCompte = (ip: string, email: string) => `c:${ip}|${email}`
const cleIp = (ip: string) => `i:${ip}`

function lire(cle: string, maintenant: number): Compteur | undefined {
  const compteur = compteurs.get(cle)
  if (compteur && maintenant >= compteur.finMs) {
    compteurs.delete(cle)
    return undefined
  }
  return compteur
}

function compter(cle: string, maintenant: number) {
  const compteur = lire(cle, maintenant)
  if (compteur) {
    compteur.essais++
    return
  }
  if (compteurs.size >= SEUIL_BALAYAGE) {
    for (const [autre, valeur] of compteurs) {
      if (maintenant >= valeur.finMs) compteurs.delete(autre)
    }
  }
  compteurs.set(cle, { essais: 1, finMs: maintenant + PLAFOND_CONNEXION.FENETRE_MS })
}

/**
 * Compte un essai de connexion et dit s'il peut se poursuivre. `false` : le
 * plafond est atteint, l'appelant refuse sans chercher le compte ni lancer
 * bcrypt. Un essai refusé n'est pas compté et ne prolonge pas la fenêtre.
 *
 * `email` doit déjà être normalisé (minuscules, sans espaces).
 */
export function autoriserEssaiConnexion(
  ip: string,
  email: string,
  maintenant: number = Date.now()
): boolean {
  const parIp = lire(cleIp(ip), maintenant)
  if (parIp && parIp.essais >= PLAFOND_CONNEXION.MAX_PAR_IP) return false
  const parCompte = lire(cleCompte(ip, email), maintenant)
  if (parCompte && parCompte.essais >= PLAFOND_CONNEXION.MAX_PAR_IP_ET_COMPTE) return false

  compter(cleIp(ip), maintenant)
  compter(cleCompte(ip, email), maintenant)
  return true
}

/** Connexion réussie : le compte repart de zéro, l'IP récupère son essai. */
export function solderEssaisConnexion(
  ip: string,
  email: string,
  maintenant: number = Date.now()
) {
  compteurs.delete(cleCompte(ip, email))
  const parIp = lire(cleIp(ip), maintenant)
  if (parIp && parIp.essais > 0) parIp.essais--
}

/** Tests uniquement. */
export function reinitialiserPlafondConnexion() {
  compteurs.clear()
}
