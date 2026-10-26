/** Une référence libre reste du texte ; seuls les liens HTTP(S) sont activés. */
export function urlReferenceSure(source: string | null | undefined): string | null {
  if (!source) return null
  try {
    const url = new URL(source.trim())
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null
  } catch {
    return null
  }
}

export function ReferenceSource({ source, className = "" }: { source: string; className?: string }) {
  const href = urlReferenceSure(source)
  return href ? (
    <a href={href} target="_blank" rel="noopener noreferrer" className={`break-words underline underline-offset-2 ${className}`}>{source}</a>
  ) : <span className={`whitespace-pre-wrap break-words ${className}`}>{source}</span>
}
