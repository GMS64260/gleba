"use client"

/**
 * STUB PUBLIC — version open-source.
 *
 * Le vrai ChatPanel (assistant IA conversationnel branché sur Ollama et le
 * MCP serveur) est privé et reste sur l'environnement de prod. Sur GitHub
 * et pour tout clone "communauté", on expose ce composant vide afin que
 * le build Next.js passe sans devoir tirer le code propriétaire.
 *
 * Si tu reprends Gleba en self-hosting et veux brancher ton propre LLM,
 * remplace ce fichier par ton implémentation. L'interface attendue est :
 *   { onClose: () => void; section?: string; sectionLabel?: string }
 */

interface ChatPanelProps {
  onClose: () => void
  section?: string
  sectionLabel?: string
}

export function ChatPanel(_props: ChatPanelProps): null {
  return null
}
