/** Verdict du SMTP pour la notification de statut, sans détail du transport. */
export type EtatEmailClient = "accepte" | "refus_definitif" | "erreur_temporaire" | "non_requis"

export const MESSAGE_EMAIL_CLIENT: Record<EtatEmailClient, string> = {
  accepte: "L’envoi de l’email client a été accepté par le serveur de messagerie. Sa réception n’est pas garantie.",
  refus_definitif: "L’email client a été refusé définitivement par le serveur de messagerie. Le statut est enregistré. Vérifiez l’adresse du client et contactez-le par un autre moyen. Aucun renvoi automatique n’est prévu.",
  erreur_temporaire: "L’envoi de l’email client a rencontré une erreur temporaire. Le statut est enregistré. Contactez le client par un autre moyen ; aucun renvoi automatique n’est prévu.",
  non_requis: "Aucun email client n’était requis pour cette mise à jour.",
}
