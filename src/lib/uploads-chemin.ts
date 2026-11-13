/**
 * Lecture sûre d'un chemin `/uploads/…` pour le middleware (compatible Edge :
 * aucune dépendance Node).
 *
 * Le service des fichiers statiques de Next DÉCODE le chemin avant de le
 * résoudre sur le disque : `%2F` y devient un séparateur, `..` remonte d'un
 * dossier et `%75ploads` vaut `uploads`. Un contrôle posé sur le chemin brut
 * se laissait donc tromper deux fois (preuves HTTP du 2026-11-13, 200 au lieu
 * de 404 avec la session d'une autre exploitation) :
 * - `/uploads/<mon dossier>/..%2F<autre exploitation>%2F<photo>` passait pour
 *   mon propre dossier ;
 * - `/u%70loads/<autre exploitation>/<photo>` n'était même pas reconnu comme
 *   un chemin `/uploads/` et échappait à toute la garde.
 * Toute décision, y compris « est-ce un chemin /uploads », porte maintenant
 * sur le chemin décodé une fois, et un chemin ambigu est refusé.
 *
 * Limite connue, hors de ce helper : un chemin que le matcher du middleware
 * exclut par son extension d'image sous sa forme brute ET décodée, comme
 * `/models/..%2Fuploads%2F<exploitation>%2F<photo>.jpg`, n'arrive jamais ici ;
 * il n'est servi qu'en `next dev` (sans effet en production), le refus
 * ci-dessous ne le couvre que si le middleware le voit.
 */

/**
 * Lit `pathname` comme le service statique le résout (un seul décodage) :
 * - `undefined` : le chemin décodé n'est pas sous `/uploads`, rien à garder ;
 * - `null` : chemin à refuser (404). Quel que soit son préfixe : encodage
 *   cassé, segment `..` ou barre oblique inverse une fois décodé (aucune page
 *   ni aucun envoi n'en produit, et c'est par là qu'on rejoint `/uploads`
 *   depuis un autre dossier), ou la même remontée encore encodée après ce
 *   décodage (`..%252F` : un relais qui décoderait une fois de plus la
 *   rendrait active). Sous `/uploads` : segment vide, `.`, caractère nul, ou
 *   la racine `/uploads` seule ;
 * - sinon les segments décodés qui suivent `/uploads/`.
 */
export function segmentsUpload(pathname: string): string[] | null | undefined {
  let decode: string
  try {
    decode = decodeURIComponent(pathname)
  } catch {
    return null
  }
  const remonte = (chemin: string) => chemin.includes("\\") || chemin.split("/").includes("..")
  if (remonte(decode)) return null
  // Double encodage : `..%252F` vaut `..%2F` ici, donc un nom de fichier inoffensif
  // pour le service statique, mais une remontée pour quiconque décode encore.
  // Un `%` littéral dans un nom (second décodage impossible) reste accepté.
  try {
    if (remonte(decodeURIComponent(decode))) return null
  } catch {}
  if (decode === "/uploads") return null
  if (!decode.startsWith("/uploads/")) return undefined
  const segments = decode.slice("/uploads/".length).split("/")
  const invalide = (s: string) => s === "" || s === "." || s.includes("\0")
  return segments.some(invalide) ? null : segments
}
