export type Lang = "fr" | "en"

export const BLOCKER_CODES = [
  "ux_confusing",
  "missing_features",
  "bugs_perf",
  "not_suited",
  "onboarding_unclear",
  "mobile_lacking",
  "docs_lacking",
  "no_time",
] as const

export type BlockerCode = (typeof BLOCKER_CODES)[number]

export const MODULE_CODES = [
  "jardin",
  "verger",
  "elevage",
  "compta",
  "ia",
  "meteo",
] as const

export type ModuleCode = (typeof MODULE_CODES)[number]

export const t = {
  fr: {
    pageTitle: "Votre avis sur Gleba",
    hello: (name: string | null) =>
      name ? `Bonjour ${name},` : "Bonjour,",
    intro:
      "Vous faites partie des premiers utilisateurs de Gleba et votre retour est précieux pour identifier ce qui bloque. Cela prend 3 minutes — merci !",
    langSwitch: "English",
    requiredHint: "Les champs marqués * sont obligatoires.",
    q1Title: "1. Note globale *",
    q1Hint: "1 = ne répond pas du tout à mes besoins · 10 = exactement ce qu'il me faut",
    q2Title: "2. Quel est le principal point bloquant ? *",
    q2Hint: "Plusieurs réponses possibles",
    blockers: {
      ux_confusing: "Interface confuse, difficile à prendre en main",
      missing_features: "Manque de fonctionnalités importantes pour mon activité",
      bugs_perf: "Bugs, lenteur ou fiabilité insuffisante",
      not_suited: "Pas adapté à mon type d'exploitation",
      onboarding_unclear:
        "Onboarding peu clair (données de démo, premiers pas)",
      mobile_lacking: "Pas pratique sur mobile / sur le terrain",
      docs_lacking: "Documentation ou aide insuffisante",
      no_time: "Pas eu le temps d'explorer",
    } as Record<BlockerCode, string>,
    q3Title: "3. Qu'est-ce qui vous a freiné lors de votre première visite ?",
    q3Placeholder: "Le moment précis où vous avez décroché, une fonction introuvable, un message d'erreur…",
    q4Title: "4. Quelles fonctionnalités vous manquent ?",
    q4Placeholder: "Ce que vous attendiez et qui n'est pas là.",
    q5Title: "5. Quels modules avez-vous essayés ?",
    modules: {
      jardin: "Jardin / maraîchage",
      verger: "Verger / arbres",
      elevage: "Élevage",
      compta: "Comptabilité / ventes",
      ia: "Assistant IA",
      meteo: "Météo / stations",
    } as Record<ModuleCode, string>,
    q6Title: "6. Reviendrez-vous utiliser Gleba ?",
    q6Options: {
      yes: "Oui, je compte l'utiliser régulièrement",
      maybe: "Peut-être, si certains points évoluent",
      no: "Non, pas pour mon usage",
    } as Record<string, string>,
    q7Title: "7. Commentaire libre",
    q7Placeholder: "Tout ce que vous souhaitez ajouter…",
    submit: "Envoyer mon retour",
    sending: "Envoi…",
    errorGeneric: "Une erreur est survenue. Réessayez dans un instant.",
    thanksTitle: "Merci pour votre retour !",
    thanksBody:
      "Vos réponses ont bien été enregistrées. Elles serviront directement à améliorer Gleba.",
    alreadyTitle: "Ce lien a déjà été utilisé",
    alreadyBody:
      "Votre retour a déjà été enregistré. Merci à vous ! Si vous souhaitez ajouter quelque chose, écrivez-moi à contact@gleba.fr.",
  },
  en: {
    pageTitle: "Your feedback about Gleba",
    hello: (name: string | null) => (name ? `Hi ${name},` : "Hi,"),
    intro:
      "You are one of the first Gleba users and your feedback is valuable to identify what blocks people. It takes 3 minutes — thank you!",
    langSwitch: "Français",
    requiredHint: "Fields marked * are required.",
    q1Title: "1. Overall rating *",
    q1Hint: "1 = does not meet my needs · 10 = exactly what I need",
    q2Title: "2. What was the main blocker? *",
    q2Hint: "Multiple answers allowed",
    blockers: {
      ux_confusing: "Confusing interface, hard to get started",
      missing_features: "Missing features important to my work",
      bugs_perf: "Bugs, slowness or reliability issues",
      not_suited: "Not suited to my type of farm",
      onboarding_unclear: "Unclear onboarding (sample data, first steps)",
      mobile_lacking: "Not practical on mobile / in the field",
      docs_lacking: "Insufficient documentation or help",
      no_time: "Did not have time to explore",
    } as Record<BlockerCode, string>,
    q3Title: "3. What slowed you down on your first visit?",
    q3Placeholder:
      "The exact moment you dropped off, a feature you couldn't find, an error message…",
    q4Title: "4. Which features are you missing?",
    q4Placeholder: "What you expected and didn't find.",
    q5Title: "5. Which modules did you try?",
    modules: {
      jardin: "Garden / market gardening",
      verger: "Orchard / trees",
      elevage: "Livestock",
      compta: "Accounting / sales",
      ia: "AI assistant",
      meteo: "Weather / stations",
    } as Record<ModuleCode, string>,
    q6Title: "6. Will you keep using Gleba?",
    q6Options: {
      yes: "Yes, I plan to use it regularly",
      maybe: "Maybe, if some things improve",
      no: "No, not for my use case",
    } as Record<string, string>,
    q7Title: "7. Free comment",
    q7Placeholder: "Anything else you'd like to add…",
    submit: "Send my feedback",
    sending: "Sending…",
    errorGeneric: "Something went wrong. Please try again shortly.",
    thanksTitle: "Thank you for your feedback!",
    thanksBody:
      "Your answers have been saved. They will directly help improve Gleba.",
    alreadyTitle: "This link has already been used",
    alreadyBody:
      "Your feedback has already been recorded. Thank you! If you'd like to add anything, email contact@gleba.fr.",
  },
} as const
