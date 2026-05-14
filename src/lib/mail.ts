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
}

export async function sendMail({ to, subject, html, replyTo }: SendMailOptions) {
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
  })
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

export function welcomeEmail(name?: string | null) {
  const displayName = name || "nouveau membre"
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

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

const feedbackTypeLabels: Record<string, string> = {
  bug: "Bug",
  evolution: "Évolution",
  autre: "Autre",
}

export function feedbackEmail({ userName, userEmail, type, message }: {
  userName: string | null | undefined
  userEmail: string
  type: string
  message: string
}) {
  const date = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })
  const displayName = userName || userEmail
  const label = feedbackTypeLabels[type] || type
  const safeMessage = escapeHtml(message)
  const safeName = escapeHtml(displayName)

  return {
    subject: `[Gleba Feedback] [${label}] ${displayName}`,
    replyTo: userEmail,
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
    <tr><td align="center">
      <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#065f46,#0d9488);padding:24px 40px;text-align:center;">
            <h1 style="margin:0;font-size:22px;font-weight:300;color:#ffffff;">Feedback utilisateur</h1>
            <p style="margin:8px 0 0;font-size:14px;color:#a7f3d0;">${label}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#f8fafc;border-radius:10px;overflow:hidden;">
              <tr>
                <td style="padding:8px 16px;font-size:13px;color:#64748b;border-bottom:1px solid #e2e8f0;">Utilisateur</td>
                <td style="padding:8px 16px;font-size:14px;color:#1e293b;font-weight:500;border-bottom:1px solid #e2e8f0;">${safeName}</td>
              </tr>
              <tr>
                <td style="padding:8px 16px;font-size:13px;color:#64748b;border-bottom:1px solid #e2e8f0;">Email</td>
                <td style="padding:8px 16px;font-size:14px;color:#1e293b;font-weight:500;border-bottom:1px solid #e2e8f0;">${escapeHtml(userEmail)}</td>
              </tr>
              <tr>
                <td style="padding:8px 16px;font-size:13px;color:#64748b;border-bottom:1px solid #e2e8f0;">Type</td>
                <td style="padding:8px 16px;font-size:14px;color:#1e293b;font-weight:500;border-bottom:1px solid #e2e8f0;">${label}</td>
              </tr>
              <tr>
                <td style="padding:8px 16px;font-size:13px;color:#64748b;">Date</td>
                <td style="padding:8px 16px;font-size:14px;color:#1e293b;font-weight:500;">${date}</td>
              </tr>
            </table>
            <div style="background:#f8fafc;border-radius:10px;padding:16px;border-left:3px solid #10b981;">
              <p style="margin:0 0 8px;font-size:13px;color:#64748b;font-weight:600;">Message :</p>
              <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.6;white-space:pre-wrap;">${safeMessage}</p>
            </div>
            <p style="margin:20px 0 0;font-size:13px;color:#94a3b8;">
              Vous pouvez répondre directement à cet email pour contacter l'utilisateur.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 40px 24px;border-top:1px solid #f1f5f9;">
            <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
              Notification automatique — <a href="https://gleba.fr" style="color:#10b981;text-decoration:none;">gleba.fr</a>
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

const BLOCKER_LABELS_FR: Record<string, string> = {
  ux_confusing: "Interface confuse, difficile à prendre en main",
  missing_features: "Manque de fonctionnalités importantes",
  bugs_perf: "Bugs, lenteur ou fiabilité",
  not_suited: "Pas adapté à mon type d'exploitation",
  onboarding_unclear: "Onboarding peu clair",
  mobile_lacking: "Pas pratique sur mobile / terrain",
  docs_lacking: "Documentation insuffisante",
  no_time: "Pas eu le temps d'explorer",
}

const MODULE_LABELS_FR: Record<string, string> = {
  jardin: "Jardin / maraîchage",
  verger: "Verger / arbres",
  elevage: "Élevage",
  compta: "Comptabilité / ventes",
  ia: "Assistant IA",
  meteo: "Météo / stations",
}

const WILL_RETURN_LABELS_FR: Record<string, string> = {
  yes: "Oui, régulièrement",
  maybe: "Peut-être",
  no: "Non",
}

export function feedbackInviteEmail({
  name,
  url,
}: {
  name: string | null
  url: string
}) {
  const displayName = name || "vous"
  const safeName = escapeHtml(displayName)

  return {
    subject: "🌱 3 minutes pour m'aider à améliorer Gleba ?",
    replyTo: "guillaume.gomes@ogfa.net",
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
    <tr><td align="center">
      <table width="520" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

        <tr>
          <td style="background:linear-gradient(135deg,#065f46,#0d9488);padding:36px 40px;text-align:center;">
            <h1 style="margin:0;font-size:28px;font-weight:300;color:#ffffff;letter-spacing:-0.5px;">Gleba</h1>
            <p style="margin:8px 0 0;font-size:13px;color:#a7f3d0;letter-spacing:0.1em;text-transform:uppercase;">Votre avis compte</p>
          </td>
        </tr>

        <tr>
          <td style="padding:36px 40px 8px;">
            <h2 style="margin:0 0 20px;font-size:20px;font-weight:600;color:#1e293b;line-height:1.4;">
              Bonjour ${safeName},
            </h2>
            <p style="margin:0 0 18px;font-size:15px;color:#475569;line-height:1.7;">
              Je suis <strong style="color:#0d9488;">Guillaume</strong>, créateur de Gleba.
              Vous faites partie des tout premiers à avoir testé l'application — et ça compte
              énormément pour moi.
            </p>
            <p style="margin:0 0 18px;font-size:15px;color:#475569;line-height:1.7;">
              Aujourd'hui, j'ai besoin de votre regard honnête.
              Qu'est-ce qui vous a freiné&nbsp;? Qu'est-ce qui manque&nbsp;?
              Qu'est-ce qui vous ferait revenir&nbsp;?
            </p>
            <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.7;">
              Quelques minutes de votre temps vont orienter <em>directement</em> les prochaines
              améliorations. Même un retour critique ou négatif est <strong>extrêmement précieux</strong> —
              c'est exactement ce qui me permettra de faire évoluer Gleba dans la bonne direction.
            </p>

            <table cellpadding="0" cellspacing="0" style="margin:0 auto 8px;">
              <tr>
                <td style="background:linear-gradient(135deg,#059669,#0d9488);border-radius:12px;box-shadow:0 2px 8px rgba(13,148,136,0.25);">
                  <a href="${url}" style="display:inline-block;padding:16px 36px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.01em;">
                    Donner mon retour →
                  </a>
                </td>
              </tr>
            </table>
            <p style="margin:12px 0 0;font-size:13px;color:#94a3b8;text-align:center;">
              ⏱️ 3 minutes · 🔒 lien personnel
            </p>

            <div style="margin:32px 0 8px;padding:16px 18px;background:#f0fdf4;border-radius:10px;border-left:3px solid #10b981;">
              <p style="margin:0;font-size:14px;color:#065f46;line-height:1.6;">
                Si vous préférez répondre directement par email, je lirai chaque mot avec attention.
                Vous pouvez simplement répondre à ce message.
              </p>
            </div>

            <p style="margin:28px 0 0;font-size:15px;color:#475569;line-height:1.7;">
              Merci sincèrement pour le temps que vous m'accorderez.
            </p>
            <p style="margin:6px 0 0;font-size:15px;color:#1e293b;font-weight:500;">
              — Guillaume
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 40px 28px;border-top:1px solid #f1f5f9;">
            <p style="margin:0 0 4px;font-size:11px;color:#cbd5e1;text-align:center;word-break:break-all;">
              ${url}
            </p>
            <p style="margin:8px 0 0;font-size:12px;color:#94a3b8;text-align:center;">
              <a href="https://gleba.fr" style="color:#10b981;text-decoration:none;">gleba.fr</a>
              · <a href="mailto:contact@gleba.fr" style="color:#10b981;text-decoration:none;">contact@gleba.fr</a>
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

export function feedbackSurveyEmail({
  userName,
  userEmail,
  lang,
  rating,
  blockers,
  whatBlocked,
  missing,
  modules,
  willReturn,
  comment,
}: {
  userName: string | null
  userEmail: string
  lang: string
  rating: number
  blockers: string[]
  whatBlocked: string | null
  missing: string | null
  modules: string[]
  willReturn: string | null
  comment: string | null
}) {
  const date = new Date().toLocaleString("fr-FR", { timeZone: "Europe/Paris" })
  const displayName = userName || userEmail

  const blockersHtml = blockers.length
    ? blockers
        .map((b) => `<li>${escapeHtml(BLOCKER_LABELS_FR[b] || b)}</li>`)
        .join("")
    : "<li><em>—</em></li>"

  const modulesHtml = modules.length
    ? modules.map((m) => escapeHtml(MODULE_LABELS_FR[m] || m)).join(", ")
    : "<em>—</em>"

  const willReturnLabel = willReturn
    ? WILL_RETURN_LABELS_FR[willReturn] || willReturn
    : "—"

  const row = (label: string, value: string) => `
    <tr>
      <td style="padding:8px 16px;font-size:13px;color:#64748b;border-bottom:1px solid #e2e8f0;vertical-align:top;width:140px;">${label}</td>
      <td style="padding:8px 16px;font-size:14px;color:#1e293b;font-weight:500;border-bottom:1px solid #e2e8f0;">${value}</td>
    </tr>`

  const ratingColor = rating >= 8 ? "#059669" : rating >= 5 ? "#d97706" : "#dc2626"

  return {
    subject: `[Gleba Feedback] ${rating}/10 — ${displayName}`,
    replyTo: userEmail,
    html: `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:linear-gradient(135deg,#065f46,#0d9488);padding:24px 40px;text-align:center;">
            <h1 style="margin:0;font-size:22px;font-weight:300;color:#ffffff;">Retour utilisateur reçu</h1>
            <p style="margin:8px 0 0;font-size:14px;color:#a7f3d0;">Note : <strong style="color:#ffffff;">${rating}/10</strong> · ${lang.toUpperCase()}</p>
          </td>
        </tr>
        <tr>
          <td style="padding:28px 40px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;background:#f8fafc;border-radius:10px;overflow:hidden;">
              ${row("Utilisateur", escapeHtml(displayName))}
              ${row("Email", escapeHtml(userEmail))}
              ${row("Note", `<span style="color:${ratingColor};font-weight:700;">${rating}/10</span>`)}
              ${row("Reviendra ?", escapeHtml(willReturnLabel))}
              ${row("Modules essayés", modulesHtml)}
              ${row("Date", date)}
            </table>

            <h3 style="margin:24px 0 8px;font-size:14px;font-weight:600;color:#1e293b;">Points bloquants</h3>
            <ul style="margin:0;padding:0 0 0 20px;font-size:14px;color:#1e293b;line-height:1.6;">
              ${blockersHtml}
            </ul>

            ${
              whatBlocked
                ? `
            <h3 style="margin:24px 0 8px;font-size:14px;font-weight:600;color:#1e293b;">Ce qui l'a freiné</h3>
            <div style="background:#f8fafc;border-radius:10px;padding:14px;border-left:3px solid #f59e0b;">
              <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.6;white-space:pre-wrap;">${escapeHtml(whatBlocked)}</p>
            </div>`
                : ""
            }

            ${
              missing
                ? `
            <h3 style="margin:24px 0 8px;font-size:14px;font-weight:600;color:#1e293b;">Fonctionnalités manquantes</h3>
            <div style="background:#f8fafc;border-radius:10px;padding:14px;border-left:3px solid #6366f1;">
              <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.6;white-space:pre-wrap;">${escapeHtml(missing)}</p>
            </div>`
                : ""
            }

            ${
              comment
                ? `
            <h3 style="margin:24px 0 8px;font-size:14px;font-weight:600;color:#1e293b;">Commentaire libre</h3>
            <div style="background:#f8fafc;border-radius:10px;padding:14px;border-left:3px solid #10b981;">
              <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.6;white-space:pre-wrap;">${escapeHtml(comment)}</p>
            </div>`
                : ""
            }

            <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;">
              Répondez directement à cet email pour contacter l'utilisateur.
            </p>
          </td>
        </tr>
        <tr>
          <td style="padding:16px 40px 24px;border-top:1px solid #f1f5f9;">
            <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
              Formulaire de feedback — <a href="https://gleba.fr" style="color:#10b981;text-decoration:none;">gleba.fr</a>
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
