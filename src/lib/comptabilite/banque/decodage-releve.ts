// Décodage d'un relevé CSV choisi dans le navigateur. Plusieurs banques
// françaises (Crédit Agricole, La Banque Postale…) et Excel exportent en
// Windows-1252 : lu comme UTF-8, « Libellé » devient « Libell� » et l'en-tête
// n'est plus reconnu. On essaie l'UTF-8 strict, puis Windows-1252.
export function decoderReleve(contenu: ArrayBuffer | Uint8Array): string {
  const octets = contenu instanceof Uint8Array ? contenu : new Uint8Array(contenu)
  if (octets[0] === 0xff && octets[1] === 0xfe) return new TextDecoder('utf-16le').decode(octets)
  if (octets[0] === 0xfe && octets[1] === 0xff) return new TextDecoder('utf-16be').decode(octets)
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(octets)
  } catch {
    return new TextDecoder('windows-1252').decode(octets)
  }
}
