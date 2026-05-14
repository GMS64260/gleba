---
title: 'Widget de feedback utilisateur'
slug: 'feedback-widget'
created: '2026-03-30'
status: 'ready-for-dev'
stepsCompleted: [1, 2, 3, 4]
tech_stack: ['Next.js 16', 'TypeScript', 'React 18', 'nodemailer', 'zod', 'shadcn-dialog', 'lucide-react', 'next-auth v5']
files_to_modify: ['src/lib/mail.ts', 'src/lib/validations/feedback.ts', 'src/lib/validations/index.ts', 'src/app/api/feedback/route.ts', 'src/components/feedback/FeedbackWidget.tsx', 'src/app/layout.tsx']
code_patterns: ['sendMail({to,subject,html})', 'requireAuthApi() → {error,session}', 'useSession() from next-auth/react', 'Dialog shadcn (Radix)', 'select natif (pas Radix Select)', 'toast via useToast()']
test_patterns: ['pas de framework de test — vérification manuelle curl + visuelle']
---

# Tech-Spec: Widget de feedback utilisateur

**Created:** 2026-03-30

## Overview

### Problem Statement

Les utilisateurs de Gleba n'ont aucun moyen intégré de remonter des bugs ou des demandes d'évolution. Le seul recours est d'envoyer un email manuellement à contact@gleba.fr, ce qui n'est ni visible ni guidé.

### Solution

Ajouter un bouton flottant discret (coin bas-droit) accessible depuis toutes les pages authentifiées. Au clic, une Dialog s'ouvre avec un formulaire minimal (type + message). L'envoi déclenche un email à l'admin avec les infos de l'utilisateur en `Reply-To` pour permettre une réponse directe.

### Scope

**In Scope:**
- Bouton flottant `MessageSquarePlus` (lucide-react) en position fixed bas-droit
- Dialog shadcn avec formulaire : type (Bug / Demande d'évolution / Autre) + textarea message
- Route API `POST /api/feedback` protégée par auth
- Envoi email via `sendMail()` existant avec `Reply-To: <email utilisateur>`
- Validation Zod du payload
- Toast de confirmation après envoi

**Out of Scope:**
- Stockage en base de données (pas de modèle Prisma)
- Vue admin pour lister les feedbacks
- Upload de captures d'écran
- Historique des feedbacks côté utilisateur

## Context for Development

### Codebase Patterns

- **sendMail()** dans `src/lib/mail.ts` — interface actuelle : `{ to, subject, html }`. **Doit être étendue** avec un champ optionnel `replyTo?: string` pour supporter le Reply-To. Le `from` est géré automatiquement via `SMTP_FROM` ou `SMTP_USER`. Les emails existants appellent `sendMail()` en fire-and-forget (`.catch()`).
- **requireAuthApi(request?)** dans `@/lib/auth-utils` retourne `{ error, session }`. La session expose `session.user.id`, `session.user.email`, `session.user.name`, `session.user.role`.
- **Validations Zod** dans `src/lib/validations/` avec barrel export dans `index.ts` (18 exports actuels).
- **Dialog shadcn** dans `src/components/ui/dialog.tsx` (Radix UI). Utiliser `<select>` natif (pas Radix Select — migration faite).
- **SessionProvider** wraps le layout racine — `useSession()` de `next-auth/react` est disponible partout.
- **Layout racine** (`src/app/layout.tsx`) contient `<SessionProvider>`, `<Toaster />` — le widget feedback se place au même niveau.
- **Toast** : utiliser `useToast()` depuis `@/components/ui/use-toast`.

### Files to Reference

| File | Purpose |
| ---- | ------- |
| `src/lib/mail.ts` | Service email — étendre `SendMailOptions` avec `replyTo`, ajouter `feedbackEmail()` |
| `src/lib/auth-utils.ts` | `requireAuthApi(request)` — retourne `{ error, session }` avec `session.user.{id,email,name}` |
| `src/lib/validations/index.ts` | Barrel export — ajouter `export * from './feedback'` |
| `src/app/layout.tsx` | Layout racine — ajouter `<FeedbackWidget />` à côté de `<Toaster />` |
| `src/components/ui/dialog.tsx` | Dialog shadcn (Radix) — composant existant à réutiliser |
| `src/components/auth/SessionProvider.tsx` | Wraps le layout — `useSession()` disponible dans les enfants |

### Technical Decisions

- **Email-only, pas de BDD** : volonté explicite de garder ça léger pour le moment. On pourra ajouter un modèle Prisma plus tard si besoin.
- **`Reply-To` avec l'email utilisateur** : permet de répondre directement depuis le client mail sans copier-coller l'adresse.
- **Bouton flottant** : pattern le plus standard et le moins intrusif. Position `fixed bottom-6 right-6` avec `z-50`.
- **Destinataire** : hardcodé à `guillaume.ossau64@gmail.com` (email personnel de l'admin, pas via env var pour simplifier).
- **Affichage conditionnel** : le composant FeedbackWidget utilise `useSession()` pour ne s'afficher que si l'utilisateur est connecté.

## Implementation Plan

### Tasks

- [ ] **Task 1 : Étendre `sendMail()` avec `replyTo`**
  - File: `src/lib/mail.ts`
  - Action: Ajouter `replyTo?: string` à l'interface `SendMailOptions`. Passer `replyTo` dans l'appel `transporter.sendMail()`.
  - Notes: Changement rétro-compatible — le champ est optionnel, les appels existants ne sont pas affectés.

- [ ] **Task 2 : Schéma de validation Zod**
  - File: `src/lib/validations/feedback.ts` (nouveau)
  - Action: Créer le fichier avec `feedbackSchema` :
    - `type`: `z.enum(["bug", "evolution", "autre"])`
    - `message`: `z.string().min(10, "Le message doit contenir au moins 10 caractères").max(2000, "Le message ne peut pas dépasser 2000 caractères")`
  - File: `src/lib/validations/index.ts`
  - Action: Ajouter `export * from './feedback'`

- [ ] **Task 3 : Template email feedback**
  - File: `src/lib/mail.ts`
  - Action: Ajouter la fonction `feedbackEmail(params)` :
    - Paramètres : `{ userName: string, userEmail: string, type: string, message: string }`
    - Retourne : `{ subject: string, html: string, replyTo: string }`
    - Subject : `[Gleba Feedback] [Bug] Message de NomUtilisateur` (adapter le tag selon le type : `[Bug]`, `[Évolution]`, `[Autre]`)
    - HTML : reprendre le layout des emails existants (gradient header `#065f46→#0d9488`, table de détails, footer gleba.fr). Inclure : type, nom, email, message (avec `white-space: pre-wrap`), date/heure FR.
    - `replyTo` : l'email de l'utilisateur

- [ ] **Task 4 : Route API `POST /api/feedback`**
  - File: `src/app/api/feedback/route.ts` (nouveau)
  - Action: Créer la route `POST` :
    1. `const { error, session } = await requireAuthApi(request)` — retourner `error` si non authentifié
    2. Parser le body JSON, valider avec `feedbackSchema.safeParse(body)`
    3. Si validation échoue : retourner `{ error: "Données invalides" }` avec status 400
    4. Appeler `feedbackEmail()` avec `session!.user.name`, `session!.user.email`, `type`, `message`
    5. Appeler `await sendMail({ to: "guillaume.ossau64@gmail.com", subject, html, replyTo })`
    6. Retourner `NextResponse.json({ success: true })`
    7. Catch : `console.error('POST /api/feedback error:', error)` + retourner `{ error: "Erreur lors de l'envoi" }` status 500

- [ ] **Task 5 : Composant FeedbackWidget**
  - File: `src/components/feedback/FeedbackWidget.tsx` (nouveau)
  - Action: Créer un composant `"use client"` :
    - Imports : `useSession` (next-auth/react), `Dialog/DialogContent/DialogHeader/DialogTitle/DialogDescription` (shadcn), `MessageSquarePlus` (lucide-react), `useToast`, `feedbackSchema` (pour les types enum)
    - État : `open` (dialog), `type` (défaut `"bug"`), `message` (string), `loading` (boolean)
    - Rendu conditionnel : si `!session?.user` → retourner `null`
    - Bouton flottant : `<button>` avec classes `fixed bottom-6 right-6 z-50 rounded-full bg-primary p-3 text-primary-foreground shadow-lg hover:bg-primary/90 transition-colors`
    - Dialog : titre "Envoyer un feedback", description "Signaler un bug ou proposer une amélioration"
    - Formulaire : `<select>` natif (3 options : Bug / Demande d'évolution / Autre) + `<textarea>` (placeholder, rows=5) + bouton Envoyer (désactivé si `loading`)
    - Validation côté client : vérifier `message.length >= 10` avant submit, afficher erreur inline sinon
    - Submit handler : `fetch('/api/feedback', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ type, message }) })`
    - Succès : `toast({ title: "Merci !", description: "Votre feedback a été envoyé." })`, fermer dialog, reset state
    - Erreur : `toast({ title: "Erreur", description: "Impossible d'envoyer le feedback.", variant: "destructive" })`

- [ ] **Task 6 : Intégration dans le layout**
  - File: `src/app/layout.tsx`
  - Action: Importer `FeedbackWidget` depuis `@/components/feedback/FeedbackWidget`. Ajouter `<FeedbackWidget />` juste après `<Toaster />` dans le `<SessionProvider>`.

### Acceptance Criteria

- [ ] **AC1 — Bouton visible** : Given un utilisateur connecté sur n'importe quelle page, when la page se charge, then un bouton flottant rond avec icône message est visible en bas à droite.

- [ ] **AC2 — Bouton caché si non connecté** : Given un visiteur non authentifié sur `/login` ou `/register`, when la page se charge, then aucun bouton flottant n'est visible.

- [ ] **AC3 — Formulaire fonctionnel** : Given un utilisateur connecté clique sur le bouton, when la dialog s'ouvre, then il voit un select (Bug / Demande d'évolution / Autre) et un textarea avec placeholder.

- [ ] **AC4 — Validation client** : Given l'utilisateur soumet un message de moins de 10 caractères, when il clique sur Envoyer, then un message d'erreur s'affiche et le formulaire n'est pas soumis à l'API.

- [ ] **AC5 — Validation serveur** : Given une requête POST /api/feedback avec un body invalide (type manquant ou message trop court), when l'API reçoit la requête, then elle retourne `{ error: "Données invalides" }` avec status 400.

- [ ] **AC6 — Envoi email avec Reply-To** : Given l'utilisateur remplit le formulaire correctement et envoie, when l'API traite la requête, then un email est envoyé à `guillaume.ossau64@gmail.com` avec le type en tag dans le sujet, le contenu du message, et le header `Reply-To` positionné sur l'email de l'utilisateur connecté.

- [ ] **AC7 — Confirmation utilisateur** : Given l'email est envoyé avec succès, when l'API retourne `{ success: true }`, then la dialog se ferme, un toast vert confirme l'envoi, et le formulaire est réinitialisé (type revient à "bug", message vidé).

- [ ] **AC8 — Gestion d'erreur** : Given le serveur SMTP est indisponible ou l'envoi échoue, when l'API catch l'erreur, then elle retourne `{ error: "Erreur lors de l'envoi" }` avec status 500 et un toast destructif s'affiche côté client.

## Additional Context

### Dependencies

- Aucune nouvelle dépendance npm — tout est déjà disponible (nodemailer, zod, shadcn dialog, lucide-react, next-auth)
- Dépendance infra : le serveur SMTP doit être configuré (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` dans `.env`) — déjà en place pour les emails d'inscription

### Testing Strategy

1. **Build** : `npm run build` → 0 erreurs TypeScript
2. **Déploiement** : `rm -rf .next && docker compose up -d --build app` → container up
3. **API nominale** : `curl -X POST https://gleba.fr/api/feedback -H "Cookie: <session>" -H "Content-Type: application/json" -d '{"type":"bug","message":"Test de feedback depuis curl avec un message suffisamment long"}'` → `{ "success": true }` + email reçu sur `guillaume.ossau64@gmail.com` avec Reply-To
4. **API erreur validation** : `curl -X POST https://gleba.fr/api/feedback -H "Cookie: <session>" -H "Content-Type: application/json" -d '{"type":"bug","message":"court"}'` → `{ "error": "Données invalides" }` status 400
5. **API non authentifié** : `curl -X POST https://gleba.fr/api/feedback -H "Content-Type: application/json" -d '{"type":"bug","message":"test sans auth"}'` → status 401
6. **Visuel** : vérifier le bouton flottant sur `/`, `/cultures`, `/arbres` (visible) et `/login` (absent)
7. **Formulaire** : ouvrir la dialog, tenter d'envoyer un message trop court → erreur inline. Envoyer un message valide → toast de succès, dialog fermée

### Notes

- Les feedbacks sont envoyés directement à `guillaume.ossau64@gmail.com`.
- L'email de l'utilisateur est récupéré depuis la session NextAuth (pas de saisie manuelle).
- **Risque faible** : si SMTP est down, l'utilisateur verra un toast d'erreur. Pas de file d'attente ni retry — acceptable pour le volume attendu.
- **Évolution future** : si le volume de feedbacks augmente, envisager un modèle Prisma `Feedback` + vue admin. Le code API est déjà structuré pour supporter cet ajout (il suffit d'ajouter un `prisma.feedback.create()` dans la route).
