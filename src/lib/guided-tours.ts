/**
 * Interrupteur global des visites guidées (Shepherd) de Gleba : élevage,
 * maraîchage, cultures… Coupées à la demande de Guillaume le 2026-07-24, les
 * popups « censés guider » étant jugés parasites. Repasser à `true` pour les
 * réactiver : le démarrage automatique et la relance depuis /aide reprennent.
 *
 * Module sans « use client » : la page d'aide (composant serveur) le lit pour
 * ne pas proposer de relancer des visites qui ne démarrent pas (FB-6U2C9A).
 */
export const GUIDED_TOURS_ENABLED: boolean = false
