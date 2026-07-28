/**
 * Réponse point par point aux suggestions d'Audrey (La ferme des belles chèvres,
 * élevage caprin) : recherche au n° de boucle, mère externe, lots parasites,
 * lot des petits, détail par cabri, traitement à plusieurs injections, délais
 * d'attente lait/viande. Tout ce qui est annoncé ici a été vérifié dans le code
 * et est en production.
 *
 * Règle mails utilisateurs : pas de tiret cadratin, pas de gras parsemé, ton sobre.
 *
 * Envoi one-shot depuis le HOST (pas le container — le build standalone ne
 * contient pas src/) :
 *   npx tsx --env-file=.env scripts/send-reponse-audrey-suggestions.ts <email> --dry
 *   npx tsx --env-file=.env scripts/send-reponse-audrey-suggestions.ts <email>
 */

import { PrismaClient } from "@prisma/client"
import { writeFileSync } from "fs"
import { sendMail } from "../src/lib/mail"

const prisma = new PrismaClient()

const P = "margin:0 0 16px;font-size:15px;color:#475569;line-height:1.7;"

function reponseSuggestionsEmail(prenom: string) {
  return {
    subject: "Vos suggestions, point par point",
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

            <p style="${P}">
              Merci pour ce message, et surtout ne vous excusez pas&nbsp;: ce sont exactement ces
              remarques de terrain qui font avancer l'outil. Je reprends vos points un par un.
            </p>

            <p style="${P}">
              La recherche par numéro de boucle est en place. Dans les soins comme dans les
              naissances, le sélecteur d'animal se cherche au numéro de boucle (ou au nom, au
              choix), et la boucle s'affiche en premier. L'historique des naissances affiche
              lui aussi la boucle de la mère, avec son nom en dessous.
            </p>

            <p style="${P}">
              Les mères hors troupeau&nbsp;: sur la fiche d'un animal, un champ «&nbsp;Mère
              externe&nbsp;» permet de saisir librement le numéro d'une mère décédée ou venue
              d'un autre élevage, comme pour le père. Il apparaît ensuite sur la fiche et dans
              l'arbre généalogique. En revanche, au moment d'enregistrer une mise bas, la mère
              doit encore être une chèvre présente dans le troupeau. Si vous avez besoin de
              saisir en rétroactif des mises bas de mères déjà sorties, dites-le moi, je lève
              cette limite.
            </p>

            <p style="${P}">
              Les lots créés en trop&nbsp;: plus aucun lot n'est créé automatiquement lors d'une
              naissance. Vous pouvez maintenant remettre en actif un lot que vous aviez réformé
              pour le cacher, et surtout supprimer définitivement un lot. La suppression n'est
              refusée que si le lot contient encore des animaux ou des enregistrements liés, et
              le message vous dit précisément lesquels.
            </p>

            <p style="${P}">
              Le champ «&nbsp;Lot des petits&nbsp;» est réparé. Il vous manquait un lot actif à
              sélectionner&nbsp;: il y a désormais un bouton «&nbsp;Nouveau&nbsp;» à côté du
              champ, qui crée le lot directement depuis le formulaire de naissance.
            </p>

            <p style="${P}">
              Les cabris un par un&nbsp;: le formulaire de naissance contient un bloc de détail
              avec une ligne par cabri, exactement comme vous le décriviez, avec le sexe, le
              numéro de boucle provisoire, élevé sous mère ou au biberon, le poids, et la robe.
              Les totaux se calculent automatiquement, et un bouton crée d'un coup les fiches
              individuelles de tous les petits vivants.
            </p>

            <p style="${P}">
              Les traitements à plusieurs injections&nbsp;: c'est fait, sur une seule ligne. Vous
              saisissez le traitement une fois avec le nombre d'injections et l'intervalle
              (24&nbsp;h, 48&nbsp;h), chaque injection apparaît ensuite dans le planning et se
              valide en un appui quand elle est réalisée. Votre exemple du pénijectyl sur trois
              jours correspond donc bien à un seul traitement.
            </p>

            <p style="${P}">
              Les délais d'attente lait et viande sont affichés avec la date de remise en vente,
              dans le suivi des soins, sur le tableau de bord et dans l'agenda. Le décalage d'un
              jour qui existait entre ces écrans est corrigé, ils donnent tous la même date, et
              le délai part bien de la dernière injection du traitement.
            </p>

            <p style="${P}">
              Sur votre logique de préparation des contrôles, cela m'intéresse beaucoup. Gleba
              produit déjà le registre d'élevage au format de l'arrêté du 5 juin 2000, un
              registre sanitaire, les mouvements de cheptel, le suivi des produits vétérinaires
              avec numéro d'AMM et ordonnances, et les prophylaxies. Si vous m'envoyez la liste
              de ce que vos contrôleurs PAC et bio vous demandent réellement, je cale les
              exports là-dessus.
            </p>

            <p style="${P}">
              Enfin, pour la fromagerie, sachez simplement que la partie transformation existe
              déjà dans Gleba (traite, fabrications, affinage, stocks, prix de revient). Si
              l'application de votre ami répond à votre besoin, tant mieux, mais l'option reste
              là si un jour vous voulez tout au même endroit.
            </p>

            <p style="${P}">
              Continuez à m'envoyer vos idées, elles sont très utiles.
            </p>

            <p style="margin:24px 0 0;font-size:15px;color:#475569;line-height:1.7;">
              Bonne journée,
            </p>
            <p style="margin:6px 0 0;font-size:15px;color:#1e293b;font-weight:500;">
              Guillaume, équipe Gleba
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
    console.error("Usage : npx tsx --env-file=.env scripts/send-reponse-audrey-suggestions.ts <email> [--dry]")
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

  // Le compte est au nom de l'exploitation ; la signataire du message est Audrey.
  const prenom = "Audrey"
  const mail = reponseSuggestionsEmail(prenom)

  if (dry) {
    const preview = "/tmp/reponse-audrey-preview.html"
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
