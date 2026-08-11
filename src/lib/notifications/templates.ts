/**
 * Templates HTML des emails de notifications métier.
 * Même style que les autres emails Gleba (layout table, dégradé vert).
 */

import { APP_URL, escapeHtml } from "@/lib/mail"
import { formatDateFr } from "./detect"
import { labelAlerteMeteoCourt, labelTypeTache, nombreTachesAFaire } from "./resume"
import type { AlerteMeteoNotification, AlerteUrgente, DestinataireNotification, ResumeQuotidien } from "./types"

function layoutNotification(options: {
  headerTitle: string
  headerSubtitle?: string
  accent?: "red" | "amber" | "green"
  content: string
}): string {
  const accent = options.accent ?? "green"
  const gradient =
    accent === "red"
      ? "linear-gradient(135deg,#b91c1c,#ef4444)"
      : accent === "amber"
        ? "linear-gradient(135deg,#b45309,#f59e0b)"
        : "linear-gradient(135deg,#065f46,#0d9488)"
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc;padding:40px 20px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
        <tr>
          <td style="background:${gradient};padding:28px 40px;text-align:center;">
            <h1 style="margin:0;font-size:22px;font-weight:300;color:#ffffff;">${escapeHtml(options.headerTitle)}</h1>
            ${options.headerSubtitle ? `<p style="margin:8px 0 0;font-size:13px;color:#ffffff;opacity:0.9;">${escapeHtml(options.headerSubtitle)}</p>` : ""}
          </td>
        </tr>
        <tr>
          <td style="padding:32px 40px;">
            ${options.content}
          </td>
        </tr>
        <tr>
          <td style="padding:20px 40px 28px;border-top:1px solid #f1f5f9;">
            <p style="margin:0;font-size:12px;color:#94a3b8;text-align:center;">
              Gleba — Gestion agricole · <a href="${APP_URL}" style="color:#10b981;text-decoration:none;">${APP_URL}</a>
            </p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`
}

function tacheLigne(tache: ResumeQuotidien["taches"][number]): string {
  const localisation = tache.plancheName
    ? ` — ${escapeHtml(tache.plancheName)}${tache.ilot ? ` (ilot ${escapeHtml(tache.ilot)})` : ""}`
    : ""
  const variete = tache.varieteNom ? ` <span style="color:#64748b">(${escapeHtml(tache.varieteNom)})</span>` : ""
  const irrigationInfo =
    tache.type === "irrigation" && tache.probablementInutile
      ? `<span style="color:#b45309;font-size:12px;"> — probablement inutile${tache.pluiePrevue != null ? ` (${tache.pluiePrevue} mm prévus)` : ""}</span>`
      : ""
  const badge = tache.fait
    ? `<span style="color:#059669;font-weight:600;">✓ fait</span>`
    : `<span style="color:#b45309;font-weight:600;">à faire</span>`
  return `<tr>
    <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:14px;color:#1e293b;">
      <span style="display:inline-block;width:10px;height:10px;border-radius:50%;background:${escapeHtml(tache.couleur ?? "#94a3b8")};margin-right:8px;"></span>
      <strong>${escapeHtml(tache.especeNom)}</strong>${variete}${localisation}
    </td>
    <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:12px;color:#475569;text-align:right;">${escapeHtml(labelTypeTache(tache.type))}${irrigationInfo}</td>
    <td style="padding:10px 12px;border-bottom:1px solid #f1f5f9;font-size:13px;text-align:right;">${badge}</td>
  </tr>`
}

export function resumeQuotidienEmail(
  user: DestinataireNotification,
  resume: ResumeQuotidien
): { subject: string; html: string } {
  const dateLabel = formatDateFr(resume.date)
  const prenom = user.name ? user.name.split(" ")[0] : ""

  const sections: string[] = []
  if (resume.taches.length > 0) {
    const lignes = resume.taches.map(tacheLigne).join("")
    sections.push(`
      <h2 style="margin:0 0 12px;font-size:16px;font-weight:600;color:#1e293b;">Tâches du jour</h2>
      <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0;border-radius:10px;overflow:hidden;border-collapse:collapse;">
        ${lignes}
      </table>`)
  } else {
    sections.push(`
      <div style="background:#f8fafc;border-radius:10px;padding:16px 20px;border-left:3px solid #0d9488;">
        <p style="margin:0;font-size:14px;color:#475569;">Rien de prévu aujourd'hui sur le calendrier.</p>
      </div>`)
  }

  if (resume.alertesMeteo.length > 0) {
    const alertesHtml = resume.alertesMeteo
      .map(
        (a) => `
        <div style="background:${a.niveau === "danger" ? "#fef2f2" : "#fffbeb"};border-radius:10px;padding:12px 16px;border-left:3px solid ${a.niveau === "danger" ? "#dc2626" : "#f59e0b"};margin-bottom:10px;">
          <p style="margin:0;font-size:14px;font-weight:600;color:#1e293b;">${escapeHtml(a.message)}</p>
          <p style="margin:6px 0 0;font-size:13px;color:#475569;line-height:1.5;">${escapeHtml(a.details)}</p>
        </div>`
      )
      .join("")
    sections.push(`
      <h2 style="margin:24px 0 12px;font-size:16px;font-weight:600;color:#1e293b;">Météo du jour</h2>
      ${alertesHtml}`)
  }

  const aFaire = nombreTachesAFaire(resume.taches)
  const conclusion =
    aFaire > 0
      ? `<p style="margin:20px 0 0;font-size:14px;color:#475569;">Bon courage : ${aFaire} action${aFaire > 1 ? "s" : ""} à mener aujourd'hui.</p>`
      : resume.alertesMeteo.length > 0
        ? `<p style="margin:20px 0 0;font-size:14px;color:#475569;">Pensez à consulter les alertes météo ci-dessus avant de commencer.</p>`
        : ""

  return {
    subject: `[Gleba] Résumé du jour - ${dateLabel}`,
    html: layoutNotification({
      headerTitle: `Quoi faire ce matin ?`,
      headerSubtitle: `Résumé du jour — ${dateLabel}`,
      content: `
        ${prenom ? `<p style="margin:0 0 20px;font-size:15px;color:#1e293b;">Bonjour ${escapeHtml(prenom)},</p>` : ""}
        ${sections.join("")}
        ${conclusion}
        <table cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
          <tr>
            <td style="background:linear-gradient(135deg,#059669,#0d9488);border-radius:10px;">
              <a href="${APP_URL}/calendrier" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
                Voir le calendrier →
              </a>
            </td>
          </tr>
        </table>`,
    }),
  }
}

export function alerteMeteoEmail(
  user: DestinataireNotification,
  alerte: AlerteMeteoNotification
): { subject: string; html: string } {
  const libelle = labelAlerteMeteoCourt(alerte.type)
  return {
    subject: `[Gleba] Alerte météo : ${libelle}${alerte.type === "gel" || alerte.type === "canicule" || alerte.type === "vent" || alerte.type === "pluie" ? ` (${formatDateFr(alerte.date)})` : ""}`,
    html: layoutNotification({
      headerTitle: `Alerte météo : ${libelle}`,
      headerSubtitle: alerte.niveau === "danger" ? "Niveau danger" : "Niveau attention",
      accent: alerte.niveau === "danger" ? "red" : "amber",
      content: `
        <p style="margin:0 0 16px;font-size:15px;color:#1e293b;line-height:1.6;">
          ${escapeHtml(alerte.message)}.
        </p>
        <div style="background:${alerte.niveau === "danger" ? "#fef2f2" : "#fffbeb"};border-radius:10px;padding:16px 20px;border-left:3px solid ${alerte.niveau === "danger" ? "#dc2626" : "#f59e0b"};">
          <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.6;">${escapeHtml(alerte.details)}</p>
        </div>
        <table cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
          <tr>
            <td style="background:linear-gradient(135deg,#059669,#0d9488);border-radius:10px;">
              <a href="${APP_URL}/meteo" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
                Voir la météo →
              </a>
            </td>
          </tr>
        </table>`,
    }),
  }
}

export function alerteUrgenteEmail(
  user: DestinataireNotification,
  alerte: AlerteUrgente
): { subject: string; html: string } {
  return {
    subject: `[Gleba] Action urgente : ${alerte.titre}`,
    html: layoutNotification({
      headerTitle: `Action urgente`,
      headerSubtitle: alerte.titre,
      accent: "red",
      content: `
        <p style="margin:0 0 16px;font-size:15px;color:#1e293b;line-height:1.6;">
          ${escapeHtml(alerte.message)}
        </p>
        <table cellpadding="0" cellspacing="0" style="margin:24px 0 0;">
          <tr>
            <td style="background:linear-gradient(135deg,#059669,#0d9488);border-radius:10px;">
              <a href="${APP_URL}/calendrier" style="display:inline-block;padding:12px 28px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">
                Gérer dans Gleba →
              </a>
            </td>
          </tr>
        </table>`,
    }),
  }
}
