/**
 * Gardes communes aux envois de fichiers (`/api/upload/image`,
 * `/api/upload/justificatif`). Ces routes écrivaient sur le disque du serveur
 * sans autre limite que la taille d'un fichier : un compte, ou n'importe quel
 * visiteur par le compte de démonstration, pouvait le remplir, et la démo
 * hébergeait publiquement les images de qui voulait.
 *
 *  - compte de démonstration : refusé ;
 *  - débit : nombre d'envois par compte sur dix minutes ;
 *  - quota : volume total du dossier du compte.
 *
 * Le fond du plan (`/api/jardin/fond`) passe par les mêmes gardes depuis la
 * revue de sécurité du 2026-11-11.
 */
import { NextResponse } from "next/server"
import { readdir, stat } from "node:fs/promises"
import path from "node:path"
import { checkRateLimit } from "@/lib/rate-limit"
import { MESSAGES_REFUS_DEMO, refusSiCompteDemo } from "@/lib/demo-garde"

const MO = 1024 * 1024

export const QUOTAS_ENVOI = {
  /** Photos (deux déclinaisons JPEG par envoi, quelques centaines de Ko). */
  image: { dossier: ["public", "uploads"], octets: 1024 * MO, envoisParDixMinutes: 60 },
  /** Pièces justificatives, conservées dix ans : quota large. */
  justificatif: { dossier: ["storage", "justificatifs"], octets: 3072 * MO, envoisParDixMinutes: 60 },
  /** Fonds du plan 2D : un par parcelle, 10 Mo au plus chacun (même dossier que `fondStorageDir`). */
  fondPlan: { dossier: ["storage", "plan-fonds"], octets: 500 * MO, envoisParDixMinutes: 30 },
} as const

export type TypeEnvoi = keyof typeof QUOTAS_ENVOI

/** Dossier du compte ; `userId` ne doit porter aucun séparateur de chemin. */
export function dossierEnvoi(type: TypeEnvoi, userId: string): string {
  if (!/^[A-Za-z0-9_-]+$/.test(userId)) throw new Error("Identifiant de compte inattendu")
  return path.join(process.cwd(), ...QUOTAS_ENVOI[type].dossier, userId)
}

/** Volume des fichiers du dossier (non récursif : les envois y sont à plat). */
export async function volumeDossier(dossier: string): Promise<number> {
  let noms: string[]
  try {
    noms = await readdir(dossier)
  } catch {
    return 0
  }
  const tailles = await Promise.all(noms.map(async (nom) => {
    try {
      const s = await stat(path.join(dossier, nom))
      return s.isFile() ? s.size : 0
    } catch {
      return 0
    }
  }))
  return tailles.reduce((total, t) => total + t, 0)
}

/**
 * Refus à renvoyer tel quel, ou `null` si l'envoi de `octetsAjoutes` est permis.
 * À appeler après l'authentification et avant toute écriture.
 */
export async function refusEnvoiFichier(type: TypeEnvoi, userId: string, octetsAjoutes: number): Promise<NextResponse | null> {
  const refusDemo = await refusSiCompteDemo(userId, MESSAGES_REFUS_DEMO.envoiFichier)
  if (refusDemo) return refusDemo
  const quota = QUOTAS_ENVOI[type]
  const debit = checkRateLimit(`upload:${type}:${userId}`, { windowMs: 10 * 60 * 1000, max: quota.envoisParDixMinutes })
  if (debit) return debit
  const occupe = await volumeDossier(dossierEnvoi(type, userId))
  if (occupe + octetsAjoutes > quota.octets) {
    return NextResponse.json(
      {
        error: `Espace de stockage plein : ${Math.round(occupe / MO)} Mo utilisés sur ${Math.round(quota.octets / MO)} Mo. Supprimez des fichiers ou écrivez-nous pour l'agrandir.`,
        code: "QUOTA_STOCKAGE",
      },
      { status: 413 },
    )
  }
  return null
}

/** Signature réelle du contenu : le type annoncé par le navigateur ne prouve rien. */
export function extensionReelle(contenu: Uint8Array): "pdf" | "jpg" | "png" | "webp" | null {
  const debut = (...octets: number[]) => octets.every((o, i) => contenu[i] === o)
  if (debut(0x25, 0x50, 0x44, 0x46, 0x2d)) return "pdf"
  if (debut(0xff, 0xd8, 0xff)) return "jpg"
  if (debut(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)) return "png"
  // RIFF....WEBP
  if (debut(0x52, 0x49, 0x46, 0x46) && [0x57, 0x45, 0x42, 0x50].every((o, i) => contenu[8 + i] === o)) return "webp"
  return null
}
