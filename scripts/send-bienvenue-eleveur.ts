/**
 * Mot de bienvenue personnalisé à un nouvel éleveur qui vient de s'installer
 * sérieusement sur Gleba (exploitation + cheptel saisis). Objectif : créer le
 * lien, inviter aux retours de terrain (friction / bug / demande d'évolution)
 * via le bouton de feedback (en bas à GAUCHE, présent sur tous les écrans) ou
 * en répondant simplement au message. Ton sobre, sans emoji, signé Guillaume.
 *
 * NB position du bouton : le feedback est en bas à GAUCHE (bulle « + »).
 * En bas à DROITE se trouve l'assistant IA — à ne pas confondre.
 *
 * Envoi one-shot depuis le HOST (pas le container — le build standalone ne
 * contient pas src/) :
 *   npx tsx --env-file=.env scripts/send-bienvenue-eleveur.ts <email> --dry   # aperçu, aucun envoi
 *   npx tsx --env-file=.env scripts/send-bienvenue-eleveur.ts <email>         # envoi réel
 */

import { PrismaClient } from "@prisma/client"
import { writeFileSync } from "fs"
import { sendMail } from "../src/lib/mail"

const prisma = new PrismaClient()

function bienvenueEleveurEmail(prenom: string) {
  return {
    subject: "Bienvenue sur Gleba — et un mot en direct",
    replyTo: process.env.FEEDBACK_EMAIL || undefined,
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
            <p style="margin:8px 0 0;font-size:13px;color:#a7f3d0;letter-spacing:0.1em;text-transform:uppercase;">Gestion agricole</p>
          </td>
        </tr>

        <tr>
          <td style="padding:36px 40px 8px;">
            <h2 style="margin:0 0 20px;font-size:20px;font-weight:600;color:#1e293b;line-height:1.4;">
              Bonjour ${prenom},
            </h2>
            <p style="margin:0 0 18px;font-size:15px;color:#475569;line-height:1.7;">
              Bienvenue sur Gleba, et merci de l'avoir choisi pour votre élevage. Je tenais
              à vous écrire personnellement&nbsp;: vous faites partie des premiers éleveurs à
              installer votre exploitation et votre troupeau sur l'outil, et c'est exactement
              le genre d'usage de terrain qui nous fait avancer.
            </p>
            <p style="margin:0 0 18px;font-size:15px;color:#475569;line-height:1.7;">
              Gleba est un outil jeune, que nous faisons évoluer vite — en grande partie grâce
              aux retours de celles et ceux qui s'en servent pour de vrai. C'est là que vous
              pouvez énormément nous aider.
            </p>
            <p style="margin:0 0 16px;font-size:15px;color:#475569;line-height:1.7;">
              <strong>N'hésitez sur rien.</strong> La moindre friction, quelque chose qui coince
              ou qui n'est pas clair, un bug, ou une idée du type «&nbsp;j'aimerais que Gleba
              sache faire ceci&nbsp;»&nbsp;: dites-le nous. Même les petits détails comptent.
            </p>

            <div style="margin:24px 0;padding:18px 20px;background:#f0fdf4;border-radius:12px;border-left:3px solid #10b981;">
              <p style="margin:0 0 8px;font-size:14px;font-weight:600;color:#065f46;">Comment nous faire un retour</p>
              <p style="margin:0;font-size:14px;color:#475569;line-height:1.7;">
                Sur n'importe quel écran de Gleba, cliquez sur le <strong>bouton rond vert en bas
                à gauche</strong> (une bulle de message avec un «&nbsp;+&nbsp;»). Choisissez
                <strong>«&nbsp;Bug&nbsp;»</strong> ou <strong>«&nbsp;Demande d'évolution&nbsp;»</strong>,
                décrivez en quelques mots, et c'est envoyé. L'onglet «&nbsp;Mes demandes&nbsp;»
                vous permet de suivre où en est chaque retour.
              </p>
              <p style="margin:12px 0 0;font-size:14px;color:#475569;line-height:1.7;">
                Et si c'est plus simple pour vous, <strong>répondez directement à cet email</strong>&nbsp;:
                il arrive dans notre boîte.
              </p>
            </div>

            <p style="margin:24px 0 0;font-size:15px;color:#475569;line-height:1.7;">
              Au plaisir de vous lire,
            </p>
            <p style="margin:6px 0 0;font-size:15px;color:#1e293b;font-weight:500;">
              Guillaume — équipe Gleba
            </p>
          </td>
        </tr>

        <tr>
          <td style="padding:20px 40px 28px;border-top:1px solid #f1f5f9;">
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

async function main() {
  const argv = process.argv.slice(2)
  const dry = argv.includes("--dry")
  const email = argv.find((a) => !a.startsWith("--"))?.trim().toLowerCase()
  if (!email) {
    console.error("Usage : npx tsx --env-file=.env scripts/send-bienvenue-eleveur.ts <email> [--dry]")
    process.exit(1)
  }

  const user = await prisma.user.findUnique({
    where: { email },
    select: { name: true, email: true, emailOptOut: true },
  })
  if (!user) {
    console.error(`Utilisateur introuvable : ${email}`)
    process.exit(1)
  }
  if (user.emailOptOut) {
    console.error(`Utilisateur désabonné des emails non transactionnels : ${email} — envoi annulé.`)
    process.exit(1)
  }

  const prenom = (user.name || "").trim().split(/\s+/)[0] || "à vous"
  const mail = bienvenueEleveurEmail(prenom)

  if (dry) {
    const preview = "/tmp/bienvenue-eleveur-preview.html"
    writeFileSync(preview, mail.html)
    console.log(`[DRY] Destinataire : ${user.name || "(sans nom)"} <${user.email}>`)
    console.log(`[DRY] Sujet       : ${mail.subject}`)
    console.log(`[DRY] Prénom      : ${prenom}`)
    console.log(`[DRY] Aperçu HTML : ${preview}`)
    return
  }

  await sendMail({ to: user.email, subject: mail.subject, html: mail.html, replyTo: mail.replyTo })
  console.log(`✓ Email envoyé à <${user.email}>`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
