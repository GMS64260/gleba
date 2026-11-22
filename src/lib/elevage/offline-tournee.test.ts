/**
 * File hors connexion de la tournée (revue Codex ELEV-03 et SEC-02, 2026-11-12).
 *
 * ELEV-03 : une tâche acquittée pendant l'envoi de la file était écrasée par la
 * réécriture de la file et jamais envoyée. SEC-02 : cache et file étaient
 * communs à tous les comptes du navigateur.
 *
 * Le faux IndexedDB ci-dessous suit ce qui compte ici : requêtes asynchrones,
 * transactions `readwrite` exécutées l'une après l'autre, `oncomplete` une fois
 * les requêtes terminées, mise à niveau de version.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

type Base = { version: number; magasins: Map<string, Map<string, unknown>> }
type Requete = { result?: unknown; onsuccess?: () => void; onerror?: () => void; transaction?: unknown; onupgradeneeded?: () => void }

function fauxIndexedDB(base: Base) {
  let verrouEcriture: Promise<void> = Promise.resolve()
  const creerTransaction = (nom: string, mode: string) => {
    const tx: Record<string, unknown> & { oncomplete?: () => void } = { error: null }
    let enCours = 0
    let liberer: (() => void) | undefined
    let depart: Promise<void> = Promise.resolve()
    if (mode === 'readwrite') {
      depart = verrouEcriture
      verrouEcriture = new Promise<void>((r) => { liberer = r })
    }
    const finir = () => setTimeout(() => { if (enCours === 0) { tx.oncomplete?.(); liberer?.() } }, 0)
    const magasin = () => base.magasins.get(nom)!
    const requete = (op: () => unknown) => {
      const req: Requete = {}
      if (mode === 'versionchange') { req.result = op(); return req }
      enCours++
      void depart.then(() => setTimeout(() => { req.result = op(); enCours--; req.onsuccess?.(); finir() }, 0))
      return req
    }
    tx.objectStore = () => ({
      get: (cle: string) => requete(() => structuredClone(magasin().get(cle))),
      put: (valeur: unknown, cle: string) => requete(() => { magasin().set(cle, structuredClone(valeur)) }),
      delete: (cle: string) => requete(() => { magasin().delete(cle) }),
      clear: () => requete(() => { magasin().clear() }),
    })
    return tx
  }
  const db = {
    objectStoreNames: { contains: (nom: string) => base.magasins.has(nom) },
    createObjectStore: (nom: string) => { base.magasins.set(nom, new Map()) },
    transaction: (nom: string, mode = 'readonly') => creerTransaction(nom, mode),
    close: () => undefined,
    onversionchange: null,
  }
  return {
    open: (_nom: string, version: number) => {
      const req: Requete = {}
      setTimeout(() => {
        req.result = db
        if (version > base.version) {
          base.version = version
          req.transaction = creerTransaction('state', 'versionchange')
          req.onupgradeneeded?.()
        }
        req.onsuccess?.()
      }, 0)
      return req
    },
  }
}

const op = (id: string) => ({ tacheId: id, dateEcheance: '2026-11-01', dateRealisation: '2026-11-01', notes: null, clientOperationId: id })
const tache = (id: string) => ({ id, titre: `Tâche ${id}`, description: null, categorie: 'controle', priorite: 'normale', animalId: null, lotId: null, prochaineEcheance: '2026-11-01', recurrenceJours: null })
const A = { acteurId: 'acteur-A', proprietaireId: 'ferme-A' }
const B = { acteurId: 'acteur-B', proprietaireId: 'ferme-B' }

let base: Base
const charger = async () => { vi.resetModules(); return import('./offline-tournee') }
const envoyes: string[] = []
const repondre = (statut = 200) => vi.fn(async (_url: string, init: { body: string }) => {
  envoyes.push(JSON.parse(init.body).tacheId)
  return { ok: statut < 400, status: statut }
})

/** Serveur de la tournée : la lecture rend la portée de la session, l'envoi répond `statut`. */
const serveur = (portee: { acteurId: string; proprietaireId: string }, statut = 200) => vi.fn(async (_url: string, init?: { method?: string; body?: string }) => {
  if (init?.method !== 'POST') return { ok: true, status: 200, json: async () => ({ data: [], portee }) }
  if (statut < 400) envoyes.push(JSON.parse(init.body!).tacheId)
  return { ok: statut < 400, status: statut }
})

beforeEach(() => {
  base = { version: 0, magasins: new Map() }
  envoyes.length = 0
  vi.stubGlobal('indexedDB', fauxIndexedDB(base))
})
afterEach(() => vi.unstubAllGlobals())

describe('ELEV-03 — file des acquittements', () => {
  it('garde une opération ajoutée pendant l’envoi, et retire seulement celle acquittée', async () => {
    const t = await charger()
    await t.sauverTaches(A, [tache('A'), tache('B')])
    await t.ajouterOperation(op('A'))
    let liberer!: () => void
    let demarre!: () => void
    const envoiCommence = new Promise<void>((r) => { demarre = r })
    vi.stubGlobal('fetch', vi.fn(async (_url: string, init: { body: string }) => {
      envoyes.push(JSON.parse(init.body).tacheId)
      demarre()
      await new Promise<void>((r) => { liberer = r })
      return { ok: true, status: 200 }
    }))
    const synchro = t.synchroniserOperations()
    await envoiCommence
    expect(await t.ajouterOperation(op('B'))).toBe(true)
    liberer()
    expect(await synchro).toEqual({ envoyees: 1, restantes: 1 })
    expect((await t.lireFile()).map((o) => o.tacheId)).toEqual(['B'])

    vi.stubGlobal('fetch', repondre())
    await t.synchroniserOperations()
    expect(envoyes).toEqual(['A', 'B'])
    expect(await t.lireFile()).toEqual([])
  })

  it('deux synchronisations lancées ensemble n’envoient pas deux fois', async () => {
    const t = await charger()
    await t.sauverTaches(A, [tache('A')])
    await t.ajouterOperation(op('A'))
    vi.stubGlobal('fetch', repondre())
    await Promise.all([t.synchroniserOperations(), t.synchroniserOperations()])
    expect(envoyes).toEqual(['A'])
    expect(await t.lireFile()).toEqual([])
  })

  it('garde une opération refusée, retire une opération déjà enregistrée (409)', async () => {
    const t = await charger()
    await t.sauverTaches(A, [tache('A'), tache('B')])
    await t.ajouterOperation(op('A'))
    await t.ajouterOperation(op('A'))
    vi.stubGlobal('fetch', repondre(500))
    expect(await t.synchroniserOperations()).toEqual({ envoyees: 0, restantes: 1 })
    vi.stubGlobal('fetch', repondre(409))
    expect(await t.synchroniserOperations()).toEqual({ envoyees: 1, restantes: 0 })
  })
})

describe('SEC-02 — cache propre à une personne et une exploitation', () => {
  it('le cache du compte A n’est pas lu par le compte B', async () => {
    const t = await charger()
    await t.sauverTaches(A, [tache('privee-A')])
    expect((await t.lireTachesCachees('acteur-A')).map((x) => x.id)).toEqual(['privee-A'])
    expect(await t.lireTachesCachees('acteur-B')).toEqual([])
    expect(await t.lireFile('acteur-B')).toEqual([])
  })

  it('la file du compte A n’est jamais rejouée sous le compte B', async () => {
    const t = await charger()
    await t.sauverTaches(A, [tache('privee-A')])
    await t.ajouterOperation(op('privee-A'))
    await t.sauverTaches(B, [tache('B')])
    vi.stubGlobal('fetch', repondre())
    await t.synchroniserOperations()
    expect(envoyes).toEqual([])
    expect(await t.lireTachesCachees()).toEqual([tache('B')])
  })

  it('une autre exploitation de la même personne repart d’un état vide', async () => {
    const t = await charger()
    await t.sauverTaches(A, [tache('A')])
    await t.ajouterOperation(op('A'))
    await t.sauverTaches({ acteurId: 'acteur-A', proprietaireId: 'ferme-C' }, [])
    expect(await t.lireFile('acteur-A')).toEqual([])
  })

  it('une session d’une autre personne efface l’état laissé sans déconnexion', async () => {
    const t = await charger()
    await t.sauverTaches(A, [tache('privee-A')])
    await t.oublierAutreActeur('acteur-B')
    expect(await t.lireTachesCachees()).toEqual([])
    await t.sauverTaches(A, [tache('A')])
    await t.oublierAutreActeur('acteur-A')
    expect(await t.lireTachesCachees()).toEqual([tache('A')])
  })

  it('sans portée confirmée par le serveur dans cette page, la file n’est pas envoyée', async () => {
    const premiere = await charger()
    await premiere.sauverTaches(A, [tache('A')])
    await premiere.ajouterOperation(op('A'))
    const rechargee = await charger()
    vi.stubGlobal('fetch', repondre())
    expect(await rechargee.synchroniserOperations()).toEqual({ envoyees: 0, restantes: 1 })
    expect(envoyes).toEqual([])
  })

  it('la déconnexion purge tâches et file', async () => {
    const t = await charger()
    await t.sauverTaches(A, [tache('A')])
    await t.ajouterOperation(op('A'))
    await t.purgerCacheTournee()
    expect(await t.lireTachesCachees()).toEqual([])
    expect(await t.lireFile()).toEqual([])
    expect(await t.ajouterOperation(op('A'))).toBe(false)
  })

  it('avant la déconnexion, la file part si le serveur confirme sa portée', async () => {
    const premiere = await charger()
    await premiere.sauverTaches(A, [tache('A')])
    await premiere.ajouterOperation(op('A'))
    // Autre page que la tournée : aucune portée confirmée dans ce module.
    const menu = await charger()
    vi.stubGlobal('fetch', serveur(A))
    expect(await menu.envoyerFileAvantDeconnexion()).toEqual({ restantes: 0, cause: null })
    expect(envoyes).toEqual(['A'])
    expect(await menu.lireFile()).toEqual([])
  })

  it('avant la déconnexion, la file d’une autre portée n’est ni envoyée ni annoncée', async () => {
    const premiere = await charger()
    await premiere.sauverTaches(A, [tache('A')])
    await premiere.ajouterOperation(op('A'))
    const menu = await charger()
    vi.stubGlobal('fetch', serveur(B))
    expect(await menu.envoyerFileAvantDeconnexion()).toEqual({ restantes: 0, cause: null })
    expect(envoyes).toEqual([])
    expect((await menu.lireFile()).length).toBe(1)
  })

  it('avant la déconnexion, sans réseau ou sur refus du serveur, ce qui reste est compté', async () => {
    const t = await charger()
    await t.sauverTaches(A, [tache('A'), tache('B')])
    await t.ajouterOperation(op('A'))
    await t.ajouterOperation(op('B'))
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('Failed to fetch') }))
    expect(await t.envoyerFileAvantDeconnexion()).toEqual({ restantes: 2, cause: 'reseau' })
    vi.stubGlobal('fetch', serveur(A, 500))
    expect(await t.envoyerFileAvantDeconnexion()).toEqual({ restantes: 2, cause: 'refus' })
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 401 })))
    expect(await t.envoyerFileAvantDeconnexion()).toEqual({ restantes: 2, cause: 'refus' })
    expect((await t.lireFile()).length).toBe(2)
  })

  it('avant la déconnexion, la portée confirmée pour l’envoi ne reste pas acquise à la page', async () => {
    const premiere = await charger()
    await premiere.sauverTaches(A, [tache('A')])
    await premiere.ajouterOperation(op('A'))
    const menu = await charger()
    vi.stubGlobal('fetch', serveur(A, 500))
    expect(await menu.envoyerFileAvantDeconnexion()).toEqual({ restantes: 1, cause: 'refus' })
    vi.stubGlobal('fetch', repondre())
    expect(await menu.synchroniserOperations()).toEqual({ envoyees: 0, restantes: 1 })
    expect(envoyes).toEqual([])
  })

  it('avant la déconnexion, une file vide ne demande rien au serveur', async () => {
    const t = await charger()
    await t.sauverTaches(A, [tache('A')])
    const fetchVide = vi.fn()
    vi.stubGlobal('fetch', fetchVide)
    expect(await t.envoyerFileAvantDeconnexion()).toEqual({ restantes: 0, cause: null })
    expect(fetchVide).not.toHaveBeenCalled()
  })

  it('efface l’ancien cache commun (clés tasks et queue) à la mise à niveau', async () => {
    base.version = 1
    base.magasins.set('state', new Map<string, unknown>([['tasks', [tache('ancienne')]], ['queue', [op('ancienne')]]]))
    const t = await charger()
    expect(await t.lireTachesCachees()).toEqual([])
    expect([...base.magasins.get('state')!.keys()]).toEqual([])
  })
})
