/**
 * Effets de bord d'un premier compte créé via Google : données d'exemple,
 * email de bienvenue et notification admin — le miroir de ce que font
 * POST /api/auth/register et GET /api/auth/verify pour une inscription email.
 *
 * Importé DYNAMIQUEMENT depuis auth.ts : nodemailer (via mail.ts) et le
 * générateur de données d'exemple ne doivent pas entrer dans le bundle du
 * middleware, qui importe auth.ts.
 */

import { sendMail, welcomeEmail, newUserNotificationEmail } from "@/lib/mail"
import {
  getOrCreateUnsubscribeToken,
  unsubscribeUrl,
  listUnsubscribeHeaders,
} from "@/lib/unsubscribe"

export async function initialiserCompteGoogle(user: {
  id: string
  email: string
  name?: string | null
}): Promise<void> {
  // Refonte onboarding 2026-08-17 : plus de données d'exemple d'office ici —
  // le parcours /onboarding les propose comme choix, ancrées sur la commune
  // réelle de l'exploitation (fini le décor Paris 4ᵉ pour tous les inscrits).

  // L'adresse est déjà vérifiée par Google : l'email de bienvenue part
  // immédiatement, là où l'inscription email ne l'envoie qu'après vérification.
  try {
    const unsubToken = await getOrCreateUnsubscribeToken(user.id)
    const welcome = welcomeEmail(user.name ?? null, unsubscribeUrl(unsubToken))
    await sendMail({
      to: user.email,
      subject: welcome.subject,
      html: welcome.html,
      headers: listUnsubscribeHeaders(unsubToken),
    })
  } catch (err) {
    console.error("Google onboarding — email de bienvenue:", err)
  }

  try {
    const notif = newUserNotificationEmail({ email: user.email, name: user.name ?? null })
    await sendMail({ to: "contact@gleba.fr", subject: notif.subject, html: notif.html })
  } catch (err) {
    console.error("Google onboarding — notification admin:", err)
  }
}
