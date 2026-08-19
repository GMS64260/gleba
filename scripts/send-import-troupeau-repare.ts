/**
 * Mot d'explication suite à l'import de troupeau du 2026-08-06 : l'import
 * CSV ignorait silencieusement les colonnes camelCase du modèle officiel
 * (dates de naissance et d'arrivée, type d'identifiant perdus). On informe
 * l'éleveur de ce qui a été réparé sur son compte, de ce qui reste à
 * compléter, et du nouveau mode de mise à jour par identifiant.
 *
 * Ton sobre, vouvoiement, pas de tiret cadratin, pas de gras.
 *
 * Envoi one-shot depuis le HOST (pas le container) :
 *   npx tsx --env-file=.env scripts/send-import-troupeau-repare.ts <email> --dry   # aperçu
 *   npx tsx --env-file=.env scripts/send-import-troupeau-repare.ts <email>         # envoi réel
 */

import { PrismaClient } from "@prisma/client"
import { writeFileSync } from "fs"
import { sendMail } from "../src/lib/mail"

const prisma = new PrismaClient()

function importTroupeauEmail() {
  const item = (texte: string) => `
              <tr>
                <td style="padding:12px 18px;border-bottom:1px solid #f1f5f9;">
                  <p style="margin:0;font-size:14px;color:#475569;line-height:1.65;">${texte}</p>
                </td>
              </tr>`

  return {
    subject: "Votre import de troupeau : ce que nous avons corrigé",
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
            <p style="margin:8px 0 0;font-size:13px;color:#a7f3d0;letter-spacing:0.1em;text-transform:uppercase;">Suivi de votre import</p>
          </td>
        </tr>

        <tr>
          <td style="padding:36px 40px 8px;">
            <h2 style="margin:0 0 20px;font-size:20px;font-weight:600;color:#1e293b;line-height:1.4;">
              Bonjour,
            </h2>
            <p style="margin:0 0 18px;font-size:15px;color:#475569;line-height:1.7;">
              Bienvenue sur Gleba, et merci de votre persévérance hier lors de l'import de
              votre troupeau. L'erreur d'espèce qui vous a bloqué venait d'un défaut de
              notre côté, et en analysant l'incident nous avons découvert un second
              problème, invisible celui-là : l'import a ignoré sans prévenir trois
              colonnes de votre fichier. Vos brebis ont donc été créées sans date de
              naissance, sans date d'arrivée et sans type d'identifiant. Le modèle que
              nous fournissions et l'import n'utilisaient pas les mêmes noms de colonnes.
              C'est corrigé, et nous vous devions une explication.
            </p>

            <p style="margin:0 0 10px;font-size:15px;color:#1e293b;line-height:1.7;">
              Ce que nous avons déjà réparé sur votre compte :
            </p>
            <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border:1px solid #f1f5f9;border-radius:12px;overflow:hidden;">
              ${item("Les 33 numéros IPG complets ont été normalisés au format réglementaire (FR suivi de 11 chiffres) avec le type « IPG ovin ».")}
              ${item("La race Mérinos de vos 99 animaux est maintenant reliée au référentiel des races, et le sexe de chaque animal est de nouveau reconnu par les filtres et les écrans.")}
              ${item("La brebis ...61059, dont vous aviez cité la ligne à l'assistant, a retrouvé son année de naissance (2016) et sa date d'arrivée (16/01/2026).")}
            </table>

            <p style="margin:0 0 18px;font-size:15px;color:#475569;line-height:1.7;">
              Il manque encore les dates de naissance et d'arrivée des autres animaux,
              ainsi que les identifiants dont le début était masqué (XXXXXX) dans votre
              fichier. Nous ne pouvions pas les deviner, nous ne les avons donc pas touchés.
            </p>
            <p style="margin:0 0 18px;font-size:15px;color:#475569;line-height:1.7;">
              Pour les compléter sans tout ressaisir : rouvrez votre fichier, complétez ce
              qui manque si vous le pouvez (idéalement les numéros IPG complets), puis
              relancez le même import en cochant la nouvelle option « Mettre à jour les
              animaux existants par identifiant ». Chaque fiche existante sera complétée,
              sans créer de doublon. L'import accepte désormais vos en-têtes de colonnes
              tels quels, les dates au format JJ/MM/AAAA ou en année seule, il vous
              signale les colonnes qu'il ne comprend pas et vous montre la valeur exacte
              qui pose problème, avec une suggestion.
            </p>
            <p style="margin:0 0 24px;font-size:15px;color:#475569;line-height:1.7;">
              Deux ajouts qui peuvent vous servir : une colonne « orientation » (laine,
              viande, lait ou mixte) est acceptée à l'import, et le catalogue propose
              maintenant une espèce « Brebis (toutes races) » avec les races courantes en
              référentiel, si une partie de vos mérinos n'est pas de souche Arles.
            </p>

            <table cellpadding="0" cellspacing="0" style="margin:0 auto 8px;">
              <tr>
                <td bgcolor="#0d9488" style="background-color:#0d9488;background-image:linear-gradient(135deg,#059669,#0d9488);border-radius:12px;box-shadow:0 2px 8px rgba(13,148,136,0.25);">
                  <a href="https://gleba.fr/elevage" style="display:inline-block;padding:15px 34px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;letter-spacing:0.01em;">
                    Ouvrir mon cheptel
                  </a>
                </td>
              </tr>
            </table>

            <div style="margin:28px 0 8px;padding:16px 18px;background:#f0fdf4;border-radius:10px;border-left:3px solid #10b981;">
              <p style="margin:0;font-size:14px;color:#065f46;line-height:1.6;">
                Si quelque chose ne se passe pas comme décrit, ou si vous préférez nous
                envoyer votre fichier pour qu'on s'en occupe, répondez simplement à ce
                message.
              </p>
            </div>

            <p style="margin:24px 0 0;font-size:15px;color:#475569;line-height:1.7;">
              Désolé pour le temps perdu hier, et merci de faire vivre Gleba dès votre
              premier jour.
            </p>
            <p style="margin:6px 0 0;font-size:15px;color:#1e293b;font-weight:500;">
              Guillaume
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
  const args = process.argv.slice(2)
  const dry = args.includes("--dry")
  const email = args.find((a) => !a.startsWith("--"))?.trim().toLowerCase()
  if (!email) {
    console.error("Usage : npx tsx --env-file=.env scripts/send-import-troupeau-repare.ts <email> [--dry]")
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

  const mail = importTroupeauEmail()

  if (dry) {
    const preview = "/tmp/import-troupeau-preview.html"
    writeFileSync(preview, mail.html)
    console.log(`[DRY] Destinataire : ${user.name || "(sans nom)"} <${user.email}>`)
    console.log(`[DRY] Sujet       : ${mail.subject}`)
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
