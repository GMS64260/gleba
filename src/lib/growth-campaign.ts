export const GROWTH_TEMPLATE_VERSION = "growth-feedback-fr-v1"
export const MAX_CONTACTS_24H = 5
export const CONTACT_COOLDOWN_DAYS = 30

export type CampaignKind = "first" | "follow_up"
export type ModuleSignal = "maraichage" | "verger" | "elevage" | "comptabilite"

export type ContactHistory = {
  contactedAt: Date
  kind: CampaignKind
  outcome: string
}

export type GrowthCandidateProfile = {
  role: string
  active: boolean
  emailVerified: boolean
  emailOptOut: boolean
  email: string
  activityDays: number
  modules: ModuleSignal[]
  hasResponded: boolean
}

export function eligibleGrowthProfile(profile: GrowthCandidateProfile): boolean {
  return profile.role === "USER"
    && profile.active
    && profile.emailVerified
    && !profile.emailOptOut
    && !profile.email.toLowerCase().includes("demo")
    && profile.activityDays >= 3
    && profile.modules.length > 0
    && !profile.hasResponded
}

export function cadenceDecision(
  now: Date,
  globalHistory: ContactHistory[],
  userHistory: ContactHistory[],
  hasResponded: boolean,
): { allowed: boolean; kind?: CampaignKind; reason?: string } {
  if (hasResponded) return { allowed: false, reason: "feedback_already_received" }
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const counted = globalHistory.filter((item) => item.contactedAt >= dayAgo && item.outcome !== "failed")
  if (counted.length >= MAX_CONTACTS_24H) return { allowed: false, reason: "global_24h_limit" }

  const successful = userHistory
    .filter((item) => item.outcome !== "failed")
    .sort((a, b) => b.contactedAt.getTime() - a.contactedAt.getTime())
  if (successful.length === 0) return { allowed: true, kind: "first" }
  const cooldown = new Date(now.getTime() - CONTACT_COOLDOWN_DAYS * 24 * 60 * 60 * 1000)
  if (successful[0].contactedAt > cooldown) return { allowed: false, reason: "user_30d_cooldown" }
  if (successful.some((item) => item.kind === "follow_up")) {
    return { allowed: false, reason: "follow_up_already_sent" }
  }
  return { allowed: true, kind: "follow_up" }
}

export function redactedPreview(
  index: number,
  activityDays: number,
  modules: ModuleSignal[],
  kind: CampaignKind,
) {
  return { candidate: index + 1, activityDays, modules, kind, templateVersion: GROWTH_TEMPLATE_VERSION }
}

const moduleLabels: Record<ModuleSignal, string> = {
  maraichage: "le maraîchage",
  verger: "le verger",
  elevage: "l’élevage",
  comptabilite: "la comptabilité",
}

export function growthFeedbackEmail(input: {
  name: string | null
  modules: ModuleSignal[]
  feedbackUrl: string
  unsubscribeUrl: string
  kind: CampaignKind
}) {
  const greeting = input.name?.trim() ? `Bonjour ${input.name.trim()},` : "Bonjour,"
  const usages = input.modules.slice(0, 2).map((module) => moduleLabels[module]).join(" et ")
  const intro = input.kind === "follow_up"
    ? "Je me permets une unique relance au sujet de votre expérience Gleba."
    : `Vous utilisez Gleba, notamment pour ${usages}. Votre retour nous aiderait à mieux prioriser la suite.`
  const subject = input.kind === "follow_up" ? "Un dernier mot sur votre expérience Gleba ?" : "Votre retour pour améliorer Gleba"
  const html = `<p>${greeting}</p><p>${intro}</p><p>Quels workflows utilisez-vous aujourd’hui dans Gleba ? Quels sont vos blocages, vos idées ou les fonctionnalités qui vous manquent ? Enfin, qu’est-ce qui rendrait Gleba indispensable au quotidien et pour quelle valeur seriez-vous prêt à payer ?</p><p>Vous pouvez utiliser le bouton Feedback dans Gleba ou répondre via votre lien personnel :</p><p><a href="${input.feedbackUrl}">Partager mon retour</a></p><p><a href="${input.unsubscribeUrl}">Se désabonner de ces messages</a></p>`
  return { subject, html }
}
