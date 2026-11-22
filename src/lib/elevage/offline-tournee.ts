/**
 * Mode tournée hors connexion : cache des tâches terrain et file des
 * acquittements, dans IndexedDB.
 *
 * Revue Codex du 2026-11-12 :
 * - ELEV-03 : la synchronisation lisait la file, envoyait chaque opération, puis
 *   réécrivait la file avec les seules restantes. Une tâche acquittée pendant
 *   l'envoi (l'écran synchronise à chaque clic) était écrasée et jamais envoyée.
 *   Chaque modification de la file est désormais une lecture-écriture dans UNE
 *   transaction IndexedDB (atomique, y compris entre onglets), sérialisée dans la
 *   page, et la synchronisation retire seulement les opérations acquittées.
 * - SEC-02 : base et clés étaient communes à tous les comptes du navigateur. Le
 *   compte B lisait hors connexion ou en erreur les tâches du compte A, et
 *   rejouait sa file sous sa propre session. L'état est maintenant rattaché à
 *   une portée (personne connectée et exploitation), confirmée par le serveur ;
 *   une autre portée le remplace, la déconnexion le purge, et l'ancien cache
 *   sans portée est effacé à la mise à niveau de la base.
 */

export type TacheTournee = {
  id: string; titre: string; description: string | null; categorie: string; priorite: string
  animalId: number | null; lotId: number | null; prochaineEcheance: string; recurrenceJours: number | null
}
export type OperationTournee = {
  tacheId: string; dateEcheance: string; dateRealisation: string; notes: string | null; clientOperationId: string
}
/** Personne connectée (acteur) et exploitation lue (propriétaire), selon le serveur. */
export type PorteeTournee = { acteurId: string; proprietaireId: string }

type EtatTournee = { portee: PorteeTournee; tasks: TacheTournee[]; queue: OperationTournee[] }

const DB = 'gleba-tournee-v1'
// Version 2 : un seul état rattaché à sa portée. La mise à niveau vide le magasin,
// donc l'ancien cache commun (clés `tasks` et `queue`) disparaît.
const VERSION = 2
const STORE = 'state'
const CLE_ETAT = 'etat'

let connexion: Promise<IDBDatabase> | null = null

function ouvrir(): Promise<IDBDatabase> {
  if (connexion) return connexion
  const ouverture = new Promise<IDBDatabase>((resolve, reject) => {
    const req = indexedDB.open(DB, VERSION)
    req.onupgradeneeded = () => {
      const db = req.result
      if (db.objectStoreNames.contains(STORE)) req.transaction!.objectStore(STORE).clear()
      else db.createObjectStore(STORE)
    }
    req.onsuccess = () => {
      const db = req.result
      // Un autre onglet met la base à niveau : libérer la connexion au lieu de le bloquer.
      db.onversionchange = () => { db.close(); connexion = null }
      resolve(db)
    }
    req.onerror = () => reject(req.error)
  })
  connexion = ouverture
  ouverture.catch(() => { if (connexion === ouverture) connexion = null })
  return ouverture
}

async function lireEtat(): Promise<EtatTournee | null> {
  const db = await ouvrir()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(CLE_ETAT)
    req.onsuccess = () => resolve((req.result as EtatTournee | undefined) ?? null)
    req.onerror = () => reject(req.error)
  })
}

/** Lecture-écriture de l'état dans une seule transaction : aucune autre écriture ne s'intercale. */
async function modifierEtat<R>(fn: (etat: EtatTournee | null) => { etat: EtatTournee | null; resultat: R }): Promise<R> {
  const db = await ouvrir()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite')
    const store = tx.objectStore(STORE)
    let resultat!: R
    const lecture = store.get(CLE_ETAT)
    lecture.onsuccess = () => {
      const suite = fn((lecture.result as EtatTournee | undefined) ?? null)
      resultat = suite.resultat
      if (suite.etat) store.put(suite.etat, CLE_ETAT)
      else store.delete(CLE_ETAT)
    }
    tx.oncomplete = () => resolve(resultat)
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error)
  })
}

// Dans la page, les modifications de l'état passent l'une après l'autre.
let fileModifications: Promise<unknown> = Promise.resolve()
function enSerie<R>(fn: () => Promise<R>): Promise<R> {
  const suite = fileModifications.then(fn, fn)
  fileModifications = suite.catch(() => undefined)
  return suite
}

const memePortee = (a: PorteeTournee, b: PorteeTournee) => a.acteurId === b.acteurId && a.proprietaireId === b.proprietaireId

/**
 * Portée confirmée par le serveur pendant la vie de la page. Sans elle, la file
 * n'est pas rejouée : on ne sait pas sous quelle session elle partirait.
 */
let porteeConfirmee: PorteeTournee | null = null

/**
 * Enregistre les tâches lues en ligne pour la portée que le serveur a donnée.
 * Une autre portée (autre compte, autre exploitation) remplace tout l'état,
 * file comprise : ses opérations ne doivent jamais partir sous cette session.
 */
export function sauverTaches(portee: PorteeTournee, tasks: TacheTournee[]): Promise<void> {
  return enSerie(async () => {
    await modifierEtat((etat) => ({
      etat: etat && memePortee(etat.portee, portee) ? { ...etat, tasks } : { portee, tasks, queue: [] },
      resultat: undefined,
    }))
    porteeConfirmee = portee
  })
}

/**
 * Oublie l'état d'une autre personne : appelé dès que la session connue de la
 * page nomme son acteur. Couvre une session changée sans déconnexion.
 */
export function oublierAutreActeur(acteurId: string): Promise<void> {
  return enSerie(async () => {
    await modifierEtat((etat) => ({ etat: etat && etat.portee.acteurId !== acteurId ? null : etat, resultat: undefined }))
    if (porteeConfirmee && porteeConfirmee.acteurId !== acteurId) porteeConfirmee = null
  })
}

const visible = (etat: EtatTournee | null, acteurId?: string | null) =>
  etat && (!acteurId || etat.portee.acteurId === acteurId) ? etat : null

/**
 * Tâches en cache. `acteurId` : la personne connectée quand la page la connaît ;
 * hors connexion, la session est illisible et le cache reste celui de la
 * dernière portée confirmée sur ce navigateur (purgé à la déconnexion).
 */
export async function lireTachesCachees(acteurId?: string | null): Promise<TacheTournee[]> {
  return visible(await lireEtat(), acteurId)?.tasks ?? []
}

export async function lireFile(acteurId?: string | null): Promise<OperationTournee[]> {
  return visible(await lireEtat(), acteurId)?.queue ?? []
}

/** Met un acquittement en file. Faux si aucune tournée n'a été chargée sur ce navigateur. */
export function ajouterOperation(op: OperationTournee): Promise<boolean> {
  return enSerie(() => modifierEtat((etat) => {
    if (!etat) return { etat, resultat: false }
    if (etat.queue.some((q) => q.clientOperationId === op.clientOperationId)) return { etat, resultat: true }
    return { etat: { ...etat, queue: [...etat.queue, op] }, resultat: true }
  }))
}

let synchronisation: Promise<unknown> = Promise.resolve()

/**
 * Envoie la file, une synchronisation à la fois. Seules les opérations
 * acquittées (succès, ou 409 : déjà enregistrée) sont retirées, et seulement si
 * la portée n'a pas changé entre-temps ; celles ajoutées pendant l'envoi restent.
 */
export function synchroniserOperations(): Promise<{ envoyees: number; restantes: number }> {
  return synchroniserSous(() => porteeConfirmee)
}

/** Délai d'un appel réseau, quand le navigateur sait le poser. */
const delai = (ms: number) => (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(ms) : undefined)

function synchroniserSous(lirePortee: () => PorteeTournee | null): Promise<{ envoyees: number; restantes: number }> {
  const executer = async () => {
    const portee = lirePortee()
    const etat = await lireEtat()
    if (!portee || !etat || !memePortee(etat.portee, portee)) return { envoyees: 0, restantes: etat?.queue.length ?? 0 }
    const acquittees = new Set<string>()
    for (const op of etat.queue) {
      try {
        // Un envoi coupé par le délai reste en file ; rejoué, le serveur ne l'enregistre qu'une fois.
        const res = await fetch('/api/elevage/tournee', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(op), signal: delai(10_000) })
        if (res.ok || res.status === 409) acquittees.add(op.clientOperationId)
      } catch { /* hors connexion : l'opération reste en file */ }
    }
    const restantes = await enSerie(() => modifierEtat((courant) => {
      if (!courant || !memePortee(courant.portee, portee)) return { etat: courant, resultat: courant?.queue.length ?? 0 }
      const queue = courant.queue.filter((op) => !acquittees.has(op.clientOperationId))
      return { etat: { ...courant, queue }, resultat: queue.length }
    }))
    return { envoyees: acquittees.size, restantes }
  }
  const suite = synchronisation.then(executer, executer)
  synchronisation = suite.catch(() => undefined)
  return suite
}

/**
 * Ce que la purge de la déconnexion ferait perdre : nombre d'acquittements restés
 * en file et raison. `reseau` : le serveur est injoignable (la déconnexion ne
 * peut pas aboutir non plus) ; `refus` : le serveur a répondu sans les accepter.
 */
export type FileAvantDeconnexion = { restantes: number; cause: 'reseau' | 'refus' | null }

/**
 * Avant une déconnexion voulue : envoie ce qui peut l'être et rend ce qui reste.
 *
 * La purge de la déconnexion effaçait la file sans prévenir : des tâches validées
 * hors réseau, puis une déconnexion depuis le menu sans repasser par la tournée,
 * et les validations disparaissaient. La file ne part que si le serveur confirme
 * la portée à laquelle elle est rattachée (SEC-02). Celle d'une autre portée ne
 * peut plus partir sous cette session : elle n'est pas comptée, la purge
 * l'efface. Ne lève jamais et rend la main en 20 s au plus.
 */
export async function envoyerFileAvantDeconnexion(): Promise<FileAvantDeconnexion> {
  const rien: FileAvantDeconnexion = { restantes: 0, cause: null }
  if (typeof indexedDB === 'undefined') return rien
  let nombre = 0
  try {
    const etat = await Promise.race([lireEtat(), new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000))])
    if (!etat || !Array.isArray(etat.queue) || etat.queue.length === 0) return rien
    nombre = etat.queue.length
    if (typeof navigator !== 'undefined' && navigator.onLine === false) return { restantes: nombre, cause: 'reseau' }
    let res: Response
    try {
      res = await fetch('/api/elevage/tournee?jours=0', { signal: delai(6000) })
    } catch { return { restantes: nombre, cause: 'reseau' } }
    if (!res.ok) return { restantes: nombre, cause: 'refus' }
    const { portee } = await res.json() as { portee?: PorteeTournee }
    if (!portee || !memePortee(etat.portee, portee)) return rien
    const restantes = await Promise.race([
      synchroniserSous(() => portee).then((r) => r.restantes),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 12_000)),
    ])
    if (restantes === null) return { restantes: nombre, cause: 'reseau' }
    return { restantes, cause: restantes > 0 ? 'refus' : null }
  } catch { return { restantes: nombre, cause: nombre > 0 ? 'reseau' : null } }
}

/**
 * Purge à la déconnexion : tâches et file de ce navigateur. Ne lève jamais et
 * rend la main en 2 s au plus (base bloquée par un ancien onglet, navigation
 * privée), pour ne jamais retenir la déconnexion.
 */
export async function purgerCacheTournee(): Promise<void> {
  porteeConfirmee = null
  if (typeof indexedDB === 'undefined') return
  const purge = enSerie(() => modifierEtat(() => ({ etat: null, resultat: undefined }))).catch(() => undefined)
  await Promise.race([purge, new Promise<void>((resolve) => setTimeout(resolve, 2000))])
}
