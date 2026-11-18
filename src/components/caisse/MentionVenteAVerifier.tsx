export function MentionVenteAVerifier({ motif }: { motif?: string }) {
  if (motif === undefined) return null
  return <p className="c-notice" style={{ overflowWrap: 'anywhere' }}>{`À vérifier : ${motif}`}</p>
}
