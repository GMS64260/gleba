/**
 * En-tête `Content-Disposition` des documents servis par l'API.
 *
 * Règle posée le 2026-08-19 : **un PDF s'affiche dans le navigateur, il ne se
 * télécharge que si on le demande**. Les quatorze routes PDF de Gleba
 * répondaient toutes `attachment`, ce qui force le téléchargement natif :
 * l'onglet ouvert par « Voir le PDF » se refermait aussitôt, et l'utilisateur
 * — comme un agent de test qui explore l'application au navigateur — se
 * retrouvait hors de la fenêtre, devant un fichier qu'il ne peut plus
 * inspecter. Un registre réglementaire, une facture ou une étiquette se
 * consultent d'abord ; le téléchargement est une action, pas un préalable.
 *
 * Le téléchargement reste accessible à tout moment en ajoutant
 * `?telecharger=1` (ou `?download=1`) à l'URL du document : c'est ce que fait
 * le bouton « Télécharger » de l'écran d'aperçu.
 *
 * Les formats qui n'ont aucun rendu utile dans le navigateur — CSV, ZIP, FEC,
 * UBL, JSON — restent en `attachment` : les afficher en texte brut ne rendrait
 * service à personne.
 */

/** Paramètres d'URL qui demandent explicitement le téléchargement. */
const PARAMS_TELECHARGEMENT = ['telecharger', 'download'] as const

/** Valeurs reconnues comme « oui » sur ces paramètres. */
const VALEURS_VRAIES = new Set(['1', 'true', 'oui', 'yes', ''])

type SourceUrl = string | URL | { url: string }

function versUrl(source: SourceUrl): URL | null {
  try {
    if (source instanceof URL) return source
    const brut = typeof source === 'string' ? source : source.url
    // Base arbitraire : seuls les paramètres nous intéressent, et une requête
    // Next porte toujours une URL absolue.
    return new URL(brut, 'http://gleba.invalid')
  } catch {
    return null
  }
}

/** L'appelant demande-t-il un téléchargement plutôt qu'un affichage ? */
export function veutTelechargement(source: SourceUrl): boolean {
  const url = versUrl(source)
  if (!url) return false
  return PARAMS_TELECHARGEMENT.some((param) => {
    const valeur = url.searchParams.get(param)
    return valeur !== null && VALEURS_VRAIES.has(valeur.trim().toLowerCase())
  })
}

/**
 * Nom de fichier sûr dans un en-tête HTTP.
 *
 * Plusieurs de ces noms sont composés à partir de données saisies par
 * l'utilisateur (nom d'un animal, d'un acquéreur, d'un lot). Un guillemet ou un
 * retour à la ligne y couperait l'en-tête : on ne garde donc que des caractères
 * inoffensifs, et on conserve l'extension.
 */
export function nomFichierSur(nomFichier: string): string {
  const nettoye = nomFichier
    .normalize('NFC')
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u001F\u007F"\\/;:*?<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
  return nettoye || 'document'
}

/**
 * Valeur de `Content-Disposition` pour un document consultable : `inline` par
 * défaut, `attachment` si l'appelant a demandé le téléchargement.
 */
export function dispositionDocument(source: SourceUrl, nomFichier: string): string {
  const nom = nomFichierSur(nomFichier)
  const type = veutTelechargement(source) ? 'attachment' : 'inline'
  return `${type}; filename="${nom}"`
}

/**
 * Valeur de `Content-Disposition` pour un fichier qui n'a pas de rendu dans le
 * navigateur (CSV, ZIP, XML…) : toujours `attachment`, nom assaini.
 */
export function dispositionTelechargement(nomFichier: string): string {
  return `attachment; filename="${nomFichierSur(nomFichier)}"`
}
