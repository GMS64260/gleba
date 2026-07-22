/**
 * Service d'envoi d'emails via SMTP (nodemailer)
 */

import nodemailer from "nodemailer"

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
})

interface SendMailOptions {
  to: string
  subject: string
  html: string
  replyTo?: string
  /** En-têtes additionnels (ex. List-Unsubscribe pour les campagnes). */
  headers?: Record<string, string>
}

export async function sendMail({ to, subject, html, replyTo, headers }: SendMailOptions) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER) {
    console.warn("SMTP non configure, email non envoye:", subject)
    return
  }

  return transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to,
    subject,
    html,
    ...(replyTo && { replyTo }),
    ...(headers && { headers }),
  })
}

export function feedbackResolvedEmail(name?: string | null) {
  const displayName = name
    ? ` ${name.replace(/[&<>"']/g, (character) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        "\"": "&quot;",
        "'": "&#039;",
      })[character]!)}`
    : ""
  return {
    subject: "Gleba — Votre demande a été résolue",
    html: `<!DOCTYPE html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#1e293b"><p>Bonjour${displayName},</p><p>Votre demande envoyée depuis Gleba est maintenant résolue.</p><p><a href="https://gleba.fr">Consulter mes demandes dans Gleba</a></p><p style="color:#64748b;font-size:13px">Cet email transactionnel ne contient pas le détail de votre demande.</p></body></html>`,
  }
}

export function newUserNotificationEmail(user: { email: string; name?: string | null }) {
  const date = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })
  return {
    subject: `[Gleba] Nouvel inscrit : ${user.email}`,
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#065f46,#0d9488);padding:24px 40px;text-align:center;">
            <h1 style="margin:0;font-size:22px;font-weight:300;color:#ffffff;">Nouvelle inscription</h1>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 20px;font-size:15px;color:#1e293b;line-height:1.6;">
              Un nouvel utilisateur vient de s'inscrire sur <strong>Gleba</strong>.
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:16px 0;background:#f8fafc;border-radius:10px;overflow:hidden;">
              <tr>
                <td style="padding:8px 16px;font-size:13px;color:#64748b;border-bottom:1px solid #e2e8f0;">Nom</td>
                <td style="padding:8px 16px;font-size:14px;color:#1e293b;font-weight:500;border-bottom:1px solid #e2e8f0;">${user.name || "—"}</td>
              </tr>
              <tr>
                <td style="padding:8px 16px;font-size:13px;color:#64748b;border-bottom:1px solid #e2e8f0;">Email</td>
                <td style="padding:8px 16px;font-size:14px;color:#1e293b;font-weight:500;border-bottom:1px solid #e2e8f0;">${user.email}</td>
              </tr>
              <tr>
                <td style="padding:8px 16px;font-size:13px;color:#64748b;">Date</td>
                <td style="padding:8px 16px;font-size:14px;color:#1e293b;font-weight:500;">${date}</td>
              </tr>
            </table>
            <table cellpadding="0" cellspacing="0" style="margin:24px 0;">
              <tr>
                <td style="background:linear-gradient(135deg,#059669,#0d9488);border-radius:10px;">
                  <a href="https://gleba.fr/admin/users" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
                    Voir les utilisateurs →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 40px 24px;border-top:1px solid #f1f5f9;">
            <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
              Notification automatique — <a href="https://gleba.fr" style="color:#10b981;text-decoration:none;">gleba.fr</a> · <a href="mailto:contact@gleba.fr" style="color:#10b981;text-decoration:none;">contact@gleba.fr</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  }
}

export function verifyEmailEmail(name: string | null, token: string) {
  const displayName = name || "nouveau membre"
  const verifyUrl = `https://gleba.fr/api/auth/verify?token=${token}`
  return {
    subject: "Gleba — Confirmez votre adresse email",
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#065f46,#0d9488);padding:32px 40px;text-align:center;">
            <h1 style="margin:0;font-size:28px;font-weight:300;color:#ffffff;letter-spacing:-0.5px;">Gleba</h1>
            <p style="margin:8px 0 0;font-size:13px;color:#a7f3d0;letter-spacing:0.1em;text-transform:uppercase;">Gestion agricole</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#1e293b;">
              Bonjour ${displayName} !
            </h2>
            <p style="margin:0 0 20px;font-size:15px;color:#64748b;line-height:1.6;">
              Merci de votre inscription sur Gleba. Pour activer votre compte, veuillez confirmer votre adresse email en cliquant sur le bouton ci-dessous.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:28px 0;">
              <tr>
                <td style="background:linear-gradient(135deg,#059669,#0d9488);border-radius:10px;">
                  <a href="${verifyUrl}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">
                    Confirmer mon email
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;">
              Ce lien est valable 24 heures. Si vous n'avez pas cree de compte, ignorez cet email.
            </p>
            <p style="margin:0;font-size:12px;color:#cbd5e1;word-break:break-all;">
              ${verifyUrl}
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px 28px;border-top:1px solid #f1f5f9;">
            <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
              Gleba — Logiciel libre de gestion agricole<br>
              <a href="https://gleba.fr" style="color:#10b981;text-decoration:none;">gleba.fr</a> · <a href="mailto:contact@gleba.fr" style="color:#10b981;text-decoration:none;">contact@gleba.fr</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  }
}

interface CommandeBoutiqueEmailArgs {
  boutiqueNom: string
  producteurNom: string | null
  numero: string
  clientNom: string
  clientEmail: string
  clientTelephone: string | null
  total: number
  lignes: Array<{ nom: string; quantite: number; unite: string; prixUnitaire: number; total: number }>
  modeLivraison: string | null
  dateRetraitSouhaitee: Date | null
  notesClient: string | null
}

export function commandeBoutiqueEmail(args: CommandeBoutiqueEmailArgs) {
  const dateRetrait = args.dateRetraitSouhaitee
    ? args.dateRetraitSouhaitee.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" })
    : null
  const lignesHtml = args.lignes
    .map(
      (l) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(l.nom)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${l.quantite} ${escapeHtml(l.unite)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${l.prixUnitaire.toFixed(2)} €</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${l.total.toFixed(2)} €</td>
      </tr>`
    )
    .join("")

  return {
    subject: `🛒 Nouvelle commande ${args.numero} sur votre boutique`,
    html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#0d9488,#f59e0b);padding:28px 40px;text-align:center;">
            <h1 style="margin:0;font-size:22px;font-weight:300;color:#ffffff;">Nouvelle commande</h1>
            <p style="margin:8px 0 0;font-size:14px;color:#fef3c7;">${escapeHtml(args.boutiqueNom)} — ${args.numero}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 20px;font-size:15px;color:#1e293b;line-height:1.6;">
              ${args.producteurNom ? `Bonjour ${escapeHtml(args.producteurNom)},<br><br>` : ""}
              Vous avez reçu une <strong>nouvelle commande</strong> sur votre boutique en ligne.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#f8fafc;border-radius:10px;overflow:hidden;">
              <tr>
                <td style="padding:8px 16px;font-size:13px;color:#64748b;border-bottom:1px solid #e2e8f0;width:140px;">Client</td>
                <td style="padding:8px 16px;font-size:14px;color:#1e293b;font-weight:500;border-bottom:1px solid #e2e8f0;">${escapeHtml(args.clientNom)}</td>
              </tr>
              <tr>
                <td style="padding:8px 16px;font-size:13px;color:#64748b;border-bottom:1px solid #e2e8f0;">Email</td>
                <td style="padding:8px 16px;font-size:14px;color:#1e293b;border-bottom:1px solid #e2e8f0;"><a href="mailto:${escapeHtml(args.clientEmail)}" style="color:#0d9488;text-decoration:none;">${escapeHtml(args.clientEmail)}</a></td>
              </tr>
              ${args.clientTelephone ? `<tr><td style="padding:8px 16px;font-size:13px;color:#64748b;border-bottom:1px solid #e2e8f0;">Téléphone</td><td style="padding:8px 16px;font-size:14px;color:#1e293b;border-bottom:1px solid #e2e8f0;">${escapeHtml(args.clientTelephone)}</td></tr>` : ""}
              ${args.modeLivraison ? `<tr><td style="padding:8px 16px;font-size:13px;color:#64748b;border-bottom:1px solid #e2e8f0;">Livraison</td><td style="padding:8px 16px;font-size:14px;color:#1e293b;border-bottom:1px solid #e2e8f0;">${escapeHtml(args.modeLivraison)}</td></tr>` : ""}
              ${dateRetrait ? `<tr><td style="padding:8px 16px;font-size:13px;color:#64748b;">Retrait souhaité</td><td style="padding:8px 16px;font-size:14px;color:#1e293b;font-weight:500;">${escapeHtml(dateRetrait)}</td></tr>` : ""}
            </table>

            <h3 style="margin:24px 0 8px;font-size:14px;font-weight:600;color:#1e293b;">Détails de la commande</h3>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;">
              <thead>
                <tr style="background:#f1f5f9;">
                  <th style="padding:10px 12px;text-align:left;font-size:12px;color:#475569;font-weight:600;">Produit</th>
                  <th style="padding:10px 12px;text-align:right;font-size:12px;color:#475569;font-weight:600;">Quantité</th>
                  <th style="padding:10px 12px;text-align:right;font-size:12px;color:#475569;font-weight:600;">PU</th>
                  <th style="padding:10px 12px;text-align:right;font-size:12px;color:#475569;font-weight:600;">Total</th>
                </tr>
              </thead>
              <tbody>${lignesHtml}</tbody>
              <tfoot>
                <tr style="background:#0d9488;color:white;">
                  <td colspan="3" style="padding:12px;text-align:right;font-size:14px;font-weight:600;">Total commande</td>
                  <td style="padding:12px;text-align:right;font-size:16px;font-weight:700;">${args.total.toFixed(2)} €</td>
                </tr>
              </tfoot>
            </table>

            ${args.notesClient ? `<h3 style="margin:24px 0 8px;font-size:14px;font-weight:600;color:#1e293b;">Note du client</h3><div style="background:#f0fdf4;border-radius:10px;padding:14px;border-left:3px solid #10b981;"><p style="margin:0;font-size:14px;color:#1e293b;line-height:1.6;white-space:pre-wrap;">${escapeHtml(args.notesClient)}</p></div>` : ""}

            <table cellpadding="0" cellspacing="0" style="margin:28px 0 0;">
              <tr>
                <td style="background:linear-gradient(135deg,#0d9488,#0f766e);border-radius:10px;">
                  <a href="https://gleba.fr/boutique" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
                    Gérer la commande →
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">
              Vous pouvez répondre directement à cet email pour contacter le client.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 40px 24px;border-top:1px solid #f1f5f9;">
            <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
              Gleba — Boutique en ligne · <a href="https://gleba.fr" style="color:#10b981;text-decoration:none;">gleba.fr</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
  }
}

export function passwordResetEmail(name: string | null, token: string) {
  const displayName = name || "utilisateur"
  const resetUrl = `https://gleba.fr/reset-password?token=${token}`
  return {
    subject: "Gleba — Réinitialisation de votre mot de passe",
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#065f46,#0d9488);padding:32px 40px;text-align:center;">
            <h1 style="margin:0;font-size:28px;font-weight:300;color:#ffffff;letter-spacing:-0.5px;">Gleba</h1>
            <p style="margin:8px 0 0;font-size:13px;color:#a7f3d0;letter-spacing:0.1em;text-transform:uppercase;">Réinitialisation</p>
          </td>
        </tr>
        <tr>
          <td style="padding:36px 40px;">
            <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#1e293b;">
              Bonjour ${displayName},
            </h2>
            <p style="margin:0 0 20px;font-size:15px;color:#64748b;line-height:1.6;">
              Vous avez demandé la réinitialisation de votre mot de passe sur Gleba. Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe.
            </p>
            <table cellpadding="0" cellspacing="0" style="margin:28px 0;">
              <tr>
                <td style="background:linear-gradient(135deg,#059669,#0d9488);border-radius:10px;">
                  <a href="${resetUrl}" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">
                    Réinitialiser mon mot de passe
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:0 0 8px;font-size:13px;color:#94a3b8;">
              Ce lien est valable 1 heure. Si vous n'avez pas demandé cette réinitialisation, ignorez simplement cet email — votre mot de passe restera inchangé.
            </p>
            <p style="margin:0;font-size:12px;color:#cbd5e1;word-break:break-all;">
              ${resetUrl}
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px 28px;border-top:1px solid #f1f5f9;">
            <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
              Gleba — Logiciel libre de gestion agricole<br>
              <a href="https://gleba.fr" style="color:#10b981;text-decoration:none;">gleba.fr</a> · <a href="mailto:contact@gleba.fr" style="color:#10b981;text-decoration:none;">contact@gleba.fr</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  }
}

export function welcomeEmail(name?: string | null, unsubscribeUrl?: string) {
  const displayName = name || "nouveau membre"
  const unsubLine = unsubscribeUrl
    ? `<br><a href="${unsubscribeUrl}" style="color:#cbd5e1;text-decoration:underline;">Se désabonner de ces emails</a>`
    : ""
  return {
    subject: "Bienvenue sur Gleba !",
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

        <!-- Header -->
        <tr>
          <td style="background:linear-gradient(135deg,#065f46,#0d9488);padding:32px 40px;text-align:center;">
            <h1 style="margin:0;font-size:28px;font-weight:300;color:#ffffff;letter-spacing:-0.5px;">Gleba</h1>
            <p style="margin:8px 0 0;font-size:13px;color:#a7f3d0;letter-spacing:0.1em;text-transform:uppercase;">Gestion agricole</p>
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:36px 40px;">
            <h2 style="margin:0 0 16px;font-size:20px;font-weight:600;color:#1e293b;">
              Bienvenue ${displayName} !
            </h2>
            <p style="margin:0 0 20px;font-size:15px;color:#64748b;line-height:1.6;">
              Votre compte Gleba est pret. Vous pouvez desormais gerer vos cultures, votre verger, votre élevage et votre comptabilite depuis un seul outil.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="margin:24px 0;">
              <tr>
                <td style="padding:12px 16px;background:#f0fdf4;border-radius:10px;border-left:3px solid #10b981;">
                  <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#065f46;">Pour démarrer :</p>
                  <ul style="margin:0;padding:0 0 0 18px;font-size:14px;color:#475569;line-height:1.8;">
                    <li>Creez vos planches de culture</li>
                    <li>Ajoutez vos premieres cultures</li>
                    <li>Explorez les 154 itinéraires techniques</li>
                  </ul>
                </td>
              </tr>
            </table>

            <table cellpadding="0" cellspacing="0" style="margin:28px 0;">
              <tr>
                <td style="background:linear-gradient(135deg,#059669,#0d9488);border-radius:10px;">
                  <a href="https://gleba.fr" style="display:inline-block;padding:14px 32px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">
                    Acceder a Gleba →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px 28px;border-top:1px solid #f1f5f9;">
            <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
              Gleba — Logiciel libre de gestion agricole<br>
              <a href="https://gleba.fr" style="color:#10b981;text-decoration:none;">gleba.fr</a> · <a href="mailto:contact@gleba.fr" style="color:#10b981;text-decoration:none;">contact@gleba.fr</a>${unsubLine}
            </p>
          </td>
        </tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  }
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

// ─────────────────────────────────────────────────────────────────────────────
// Emails côté CLIENT de la boutique (accusé de réception + suivi de commande).
// Le producteur, lui, reçoit `commandeBoutiqueEmail`.
// ─────────────────────────────────────────────────────────────────────────────

interface CommandeClientEmailArgs {
  boutiqueNom: string
  slug: string
  numero: string
  suiviToken: string
  clientNom: string
  total: number
  lignes: Array<{ nom: string; quantite: number; unite: string; prixUnitaire: number; total: number }>
  modesPaiement: string | null
  modeLivraison: string | null
  dateRetraitSouhaitee: Date | null
}

/** URL publique de suivi d'une commande (sans compte). */
export function commandeSuiviUrl(slug: string, numero: string, token: string): string {
  return `https://gleba.fr/boutique/${encodeURIComponent(slug)}/suivi/${encodeURIComponent(numero)}?token=${encodeURIComponent(token)}`
}

/**
 * Accusé de réception envoyé AU CLIENT juste après sa commande.
 * Rappelle le récapitulatif, le montant à régler AU RETRAIT et le lien de suivi.
 */
export function commandeClientConfirmationEmail(args: CommandeClientEmailArgs) {
  const suiviUrl = commandeSuiviUrl(args.slug, args.numero, args.suiviToken)
  const dateRetrait = args.dateRetraitSouhaitee
    ? args.dateRetraitSouhaitee.toLocaleDateString("fr-FR", { weekday: "long", day: "2-digit", month: "long" })
    : null
  const lignesHtml = args.lignes
    .map(
      (l) => `
      <tr>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;">${escapeHtml(l.nom)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">${l.quantite} ${escapeHtml(l.unite)}</td>
        <td style="padding:8px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${l.total.toFixed(2)} €</td>
      </tr>`
    )
    .join("")

  return {
    subject: `Votre commande ${args.numero} chez ${args.boutiqueNom}`,
    html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#0d9488,#f59e0b);padding:28px 40px;text-align:center;">
            <h1 style="margin:0;font-size:22px;font-weight:300;color:#ffffff;">Merci pour votre commande&nbsp;!</h1>
            <p style="margin:8px 0 0;font-size:14px;color:#fef3c7;">${escapeHtml(args.boutiqueNom)} — ${args.numero}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 20px;font-size:15px;color:#1e293b;line-height:1.6;">
              Bonjour ${escapeHtml(args.clientNom)},<br><br>
              Nous avons bien reçu votre commande. Le producteur va la préparer et vous
              tiendra informé(e) de son avancement. Vous pouvez suivre son statut à tout moment
              grâce au lien ci-dessous.
            </p>

            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden;margin:0 0 8px;">
              <thead>
                <tr style="background:#f1f5f9;">
                  <th style="padding:10px 12px;text-align:left;font-size:12px;color:#475569;font-weight:600;">Produit</th>
                  <th style="padding:10px 12px;text-align:right;font-size:12px;color:#475569;font-weight:600;">Qté</th>
                  <th style="padding:10px 12px;text-align:right;font-size:12px;color:#475569;font-weight:600;">Total</th>
                </tr>
              </thead>
              <tbody>${lignesHtml}</tbody>
              <tfoot>
                <tr style="background:#0d9488;color:white;">
                  <td colspan="2" style="padding:12px;text-align:right;font-size:14px;font-weight:600;">À régler</td>
                  <td style="padding:12px;text-align:right;font-size:16px;font-weight:700;">${args.total.toFixed(2)} €</td>
                </tr>
              </tfoot>
            </table>

            <div style="background:#fffbeb;border-radius:10px;padding:14px 16px;border-left:3px solid #f59e0b;margin:16px 0;">
              <p style="margin:0;font-size:13px;color:#78350f;line-height:1.6;">
                <strong>Paiement au retrait.</strong> Le règlement se fait au moment de la remise de votre commande${args.modesPaiement ? `, par&nbsp;: ${escapeHtml(args.modesPaiement)}` : ""}.
              </p>
              ${args.modeLivraison ? `<p style="margin:8px 0 0;font-size:13px;color:#78350f;">Retrait / livraison&nbsp;: ${escapeHtml(args.modeLivraison)}</p>` : ""}
              ${dateRetrait ? `<p style="margin:8px 0 0;font-size:13px;color:#78350f;">Date souhaitée&nbsp;: ${escapeHtml(dateRetrait)}</p>` : ""}
            </div>

            <table cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
              <tr>
                <td style="background:linear-gradient(135deg,#0d9488,#0f766e);border-radius:10px;">
                  <a href="${suiviUrl}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
                    Suivre ma commande →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 40px 24px;border-top:1px solid #f1f5f9;">
            <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
              ${escapeHtml(args.boutiqueNom)} · Boutique propulsée par <a href="https://gleba.fr" style="color:#10b981;text-decoration:none;">Gleba</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
  }
}

const STATUT_CLIENT: Record<string, { titre: string; message: string; couleur: string }> = {
  confirmee: {
    titre: "Votre commande est confirmée",
    message: "Le producteur a confirmé votre commande et va la préparer.",
    couleur: "#0d9488",
  },
  prete: {
    titre: "Votre commande est prête !",
    message: "Votre commande est prête. Vous pouvez venir la retirer selon les modalités convenues.",
    couleur: "#16a34a",
  },
  livree: {
    titre: "Commande remise — merci !",
    message: "Votre commande vous a été remise. Merci de votre confiance, à bientôt !",
    couleur: "#15803d",
  },
  annulee: {
    titre: "Votre commande a été annulée",
    message: "Votre commande a été annulée. Pour toute question, répondez directement à cet email.",
    couleur: "#dc2626",
  },
}

/** Faut-il notifier le client pour ce nouveau statut ? */
export function statutNotifiableClient(statut: string): boolean {
  return statut in STATUT_CLIENT
}

interface CommandeStatutEmailArgs {
  boutiqueNom: string
  slug: string
  numero: string
  suiviToken: string
  clientNom: string
  statut: string
  total: number
  modesPaiement: string | null
}

/** Email envoyé AU CLIENT à chaque changement de statut significatif. */
export function commandeStatutClientEmail(args: CommandeStatutEmailArgs) {
  const conf = STATUT_CLIENT[args.statut] ?? STATUT_CLIENT.confirmee
  const suiviUrl = commandeSuiviUrl(args.slug, args.numero, args.suiviToken)
  const rappelPaiement =
    args.statut === "prete"
      ? `<div style="background:#fffbeb;border-radius:10px;padding:14px 16px;border-left:3px solid #f59e0b;margin:16px 0;"><p style="margin:0;font-size:13px;color:#78350f;line-height:1.6;"><strong>${args.total.toFixed(2)} €</strong> à régler au retrait${args.modesPaiement ? `, par&nbsp;: ${escapeHtml(args.modesPaiement)}` : ""}.</p></div>`
      : ""

  return {
    subject: `${conf.titre} — ${args.numero}`,
    html: `<!DOCTYPE html>
<html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:${conf.couleur};padding:28px 40px;text-align:center;">
            <h1 style="margin:0;font-size:22px;font-weight:300;color:#ffffff;">${escapeHtml(conf.titre)}</h1>
            <p style="margin:8px 0 0;font-size:14px;color:#ffffff;opacity:0.85;">${escapeHtml(args.boutiqueNom)} — ${args.numero}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <p style="margin:0 0 16px;font-size:15px;color:#1e293b;line-height:1.6;">
              Bonjour ${escapeHtml(args.clientNom)},<br><br>
              ${escapeHtml(conf.message)}
            </p>
            ${rappelPaiement}
            <table cellpadding="0" cellspacing="0" style="margin:20px 0 0;">
              <tr>
                <td style="background:${conf.couleur};border-radius:10px;">
                  <a href="${suiviUrl}" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
                    Voir ma commande →
                  </a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 40px 24px;border-top:1px solid #f1f5f9;">
            <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
              ${escapeHtml(args.boutiqueNom)} · Boutique propulsée par <a href="https://gleba.fr" style="color:#10b981;text-decoration:none;">Gleba</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body></html>`,
  }
}
