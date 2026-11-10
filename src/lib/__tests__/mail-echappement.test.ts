import { describe, expect, it } from 'vitest'
import { newUserNotificationEmail, passwordResetEmail, verifyEmailEmail, welcomeEmail } from '../mail'

/**
 * Revue du 2026-11-04 — le nom saisi à l'inscription entrait brut dans le HTML
 * des courriels envoyés depuis le SMTP de Gleba : un tiers inscrit avec
 * l'adresse de sa cible y injectait un lien et commentait le reste.
 */
const piege = '<a href="https://faux.example">Confirmez ici</a><!--'

describe('courriels transactionnels : le nom saisi est échappé', () => {
  it.each([
    ['vérification', verifyEmailEmail(piege, 'jeton').html],
    ['réinitialisation', passwordResetEmail(piege, 'jeton').html],
    ['bienvenue', welcomeEmail(piege).html],
    ['notification d’inscription', newUserNotificationEmail({ email: 'x"<b>@example.com', name: piege }).html],
  ])('%s', (_cas, html) => {
    expect(html).not.toContain('<a href="https://faux.example">')
    expect(html).not.toContain('Confirmez ici</a><!--')
    expect(html).toContain('&lt;a href=&quot;https://faux.example&quot;&gt;')
  })
})
