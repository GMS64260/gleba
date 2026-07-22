export type TacheTournee = {
  id: string; titre: string; description: string | null; categorie: string; priorite: string
  animalId: number | null; lotId: number | null; prochaineEcheance: string; recurrenceJours: number | null
}
export type OperationTournee = {
  tacheId: string; dateEcheance: string; dateRealisation: string; notes: string | null; clientOperationId: string
}

const DB = 'gleba-tournee-v1'
const STORE = 'state'

function ouvrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}
async function lire<T>(key: string, fallback: T): Promise<T> {
  const db = await ouvrir()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE).objectStore(STORE).get(key)
    req.onsuccess = () => resolve((req.result as T) ?? fallback)
    req.onerror = () => reject(req.error)
  })
}
async function ecrire<T>(key: string, value: T): Promise<void> {
  const db = await ouvrir()
  return new Promise((resolve, reject) => {
    const req = db.transaction(STORE, 'readwrite').objectStore(STORE).put(value, key)
    req.onsuccess = () => resolve()
    req.onerror = () => reject(req.error)
  })
}

export const lireTachesCachees = () => lire<TacheTournee[]>('tasks', [])
export const sauverTaches = (tasks: TacheTournee[]) => ecrire('tasks', tasks)
export const lireFile = () => lire<OperationTournee[]>('queue', [])
export async function ajouterOperation(op: OperationTournee) {
  const queue = await lireFile()
  if (!queue.some((q) => q.clientOperationId === op.clientOperationId)) await ecrire('queue', [...queue, op])
}
export async function synchroniserOperations(): Promise<{ envoyees: number; restantes: number }> {
  const queue = await lireFile()
  const restantes: OperationTournee[] = []
  let envoyees = 0
  for (const op of queue) {
    try {
      const res = await fetch('/api/elevage/tournee', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(op) })
      if (res.ok || res.status === 409) envoyees++
      else restantes.push(op)
    } catch { restantes.push(op) }
  }
  await ecrire('queue', restantes)
  return { envoyees, restantes: restantes.length }
}
