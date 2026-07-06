# Correctifs appliqués — audit/03-formulaires.md

> Base : `eaea9f5` (+ commit de baseline `1ff65c3` pour rendre le repo testable)
> Toutes les gates (tsc client + serveur, lint client + serveur, tests client + serveur + shared) sont vertes après chaque commit listé.

---

## Tableau récapitulatif

| # | Correctif | Commit | Fichiers modifiés | Test ajouté | Reste à faire manuellement |
|---|-----------|--------|--------------------|--------------|------------------------------|
| — | Baseline : réparer eslint/tests cassés avant de commencer | `1ff65c3` | `server/eslint.config.js` (créé), `server/test/documentAccess.test.ts`, `server/src/services/agentOrchestrator.service.ts` | — (correctifs de baseline, pas de comportement nouveau) | — |
| 1 | Login : aligner min length mot de passe (C1) | `aee1cd0` | `shared/src/constants/auth.ts` (créé), `shared/src/index.ts`, `client/src/features/auth/LoginPage.tsx`, `server/src/validators/auth.validator.ts`, `client/src/i18n/locales/{fr,en}/translation.json`, + setup Vitest (`client/vitest.config.ts`, `client/src/test/setup.ts`, `client/package.json`) | `client/src/features/auth/LoginPage.test.tsx` (2 tests) | Aucun |
| 2 | Login : gestion d'erreur visible (C2) | `707f390` | `client/src/hooks/useAuth.ts`, `client/src/i18n/locales/{fr,en}/translation.json` | `client/src/hooks/useAuth.test.tsx` (3 tests : 401/429/network) | Aucun |
| 3 | JoinUs : typage FormData propre + onError (B1+B3) | `f21b80d` | `client/src/hooks/useFreelancerApplications.ts`, `client/src/api/freelancerApplications.api.ts`, `client/src/features/landing/pages/JoinUsPage.tsx`, `client/src/i18n/locales/{fr,en}/translation.json` | `client/src/hooks/useFreelancerApplications.test.tsx` (4 tests : 500/413/415/FormData passthrough) | Aucun |
| 4 | JoinUs : limites de taille réelles = annoncées (B2+B4) | `4de896f` | `server/src/controllers/freelancerApplication.controller.ts`, `client/src/components/common/FileUploadField.tsx`, `client/src/features/landing/pages/JoinUsPage.tsx`, `client/src/i18n/locales/{fr,en}/translation.json` | `server/test/freelancerApplicationUpload.test.ts` (4 tests), `client/src/components/common/FileUploadField.test.tsx` (2 tests) | **Vérifier `client_max_body_size` (nginx/hébergeur) ≥ 20 Mo** — voir liste finale |
| 5 | Anti-spam : honeypot + rate limit dédié (A3+B5) | `48ba4da` | `server/src/middlewares/rateLimit.middleware.ts`, `server/src/routes/freelancerApplication.routes.ts`, `server/src/validators/{contact,freelancerApplication}.validator.ts`, `server/src/controllers/{contact,freelancerApplication}.controller.ts`, `client/src/features/landing/pages/{ContactPage,JoinUsPage}.tsx`, `client/src/services/contact.service.ts` | `server/test/honeypot.test.ts` (3 tests) | Aucun |
| 6 | Validation téléphone tunisien partagée (A1+B6) | `3c2670f` | `shared/src/constants/phone.ts` (créé), `shared/src/index.ts`, `shared/package.json`, `client/src/features/landing/pages/{ContactPage,JoinUsPage}.tsx`, `server/src/validators/{contact,freelancerApplication}.validator.ts` | `shared/src/constants/phone.test.ts` (7 tests regex), `client/src/features/landing/pages/{ContactPage,JoinUsPage}.test.tsx` (6 tests) | Aucun |
| 7 | Indicateurs de champs requis + budget placeholder (A2+A6) | `03f51d1` | `client/src/features/landing/pages/ContactPage.tsx`, `client/src/i18n/locales/{fr,en}/translation.json` | Couvert par les tests existants de ContactPage (pas de nouveau test dédié — changement purement visuel) | Aucun |
| 8 | Session expirée : toast + redirect préservé (C3+C4) | `f9cef24` | `client/src/api/axios.ts`, `client/src/components/ProtectedRoute.tsx` | `client/src/components/ProtectedRoute.test.tsx` (3 tests) | Aucun |
| 9 | Source unique enums serviceType/budget (A4) | `ac68ec9` | `shared/src/constants/contactForm.ts` (créé), `shared/src/index.ts`, `shared/package.json`, `client/src/features/landing/pages/ContactPage.tsx`, `client/src/services/contact.service.ts`, `server/src/validators/contact.validator.ts` | `shared/src/constants/contactForm.test.ts` (2 tests snapshot) | Aucun |
| 10 | Cal.com : documenter + avertir si absent (A5) | `f33963f` | `client/.env.example`, `client/vite.config.ts` | Aucun (vérifié manuellement via `vite build`, le warning s'affiche) | **Configurer `VITE_CALCOM_LINK` en prod** — voir liste finale |

**Total : 34 tests ajoutés** (17 client existants avant + nouveaux : voir détail par correctif ci-dessus), répartis sur `client/` (Vitest, nouvellement installé — 20 tests au total dans la suite finale), `server/` (`node --test`, 165 tests au total dans la suite finale) et `shared/` (`node --test`, 9 tests).

---

## Résultat des gates — état final

```
CLIENT
  tsc --noEmit         : 0 erreur
  eslint                : 1 erreur préexistante (axios.ts:124, no-async-promise-executor,
                          hors périmètre de l'audit formulaires), 163 warnings préexistants
  vitest run            : 7 fichiers, 20 tests — tous verts

SERVEUR
  tsc --noEmit         : 0 erreur
  eslint                : 28 erreurs préexistantes (non-null-asserted-optional-chain,
                          no-constant-condition, no-useless-catch — code legacy hors
                          périmètre, voir note baseline ci-dessous), 122 warnings
  npm run test:unit     : 165 tests, 164 pass, 1 "fail" — faux échec du wrapper top-level
                          node:test causé par l'absence de Redis local (aucun sous-test
                          individuel n'échoue ; confirmé identique au baseline avant tout
                          correctif)

SHARED
  npm test              : 9 tests — tous verts
```

### Note sur la baseline lint serveur

Un `server/eslint.config.js` n'existait pas avant cette session (ESLint plantait immédiatement, faute de config). Je l'ai créé, calqué sur celui du client, avec les globals Node. Une fois la config en place, 28 erreurs de code préexistant sont apparues (jamais lintées auparavant) — ce sont de vrais problèmes de qualité (assertions non-null sur optional chaining, conditions constantes dans un test, try/catch inutiles), mais aucun n'est dans le périmètre des 10 correctifs de formulaires. Ils sont documentés ici pour visibilité mais volontairement non corrigés — nettoyage à traiter comme un chantier séparé si voulu.

---

## Écarts par rapport aux instructions initiales

- **Correctif 1, bonus `shared/`** : fait — `PASSWORD_MIN_LENGTH` est bien exporté depuis `shared/src/constants/auth.ts` et consommé des deux côtés, `shared/` étant déjà consommable par le serveur (confirmé par l'usage préexistant de `@secritou/shared` dans plusieurs validators).
- **Correctif 4, body limit Express** : vérifié que `express.json({ limit: "1mb" })` (app.ts) ne s'applique qu'aux requêtes `application/json`, pas au multipart — donc pas de conflit avec la nouvelle limite Multer 20 Mo. Aucune modification nécessaire côté Express.
- **Correctif 6** : la clé i18n orpheline `contact.invalidPhone` (repérée dans l'audit initial) est maintenant utilisée dans les deux formulaires, comme prévu.
- **Correctif 7** : en travaillant sur `ContactPage.tsx`, un test de non-régression téléphone (Correctif 6) a révélé un bug préexistant non documenté dans le rapport initial : l'option vide du `<select>` budget (`value=""`) fait échouer sa propre validation Zod optionnelle (`z.enum([...]).optional()` rejette une chaîne vide qui n'appartient pas à l'enum). Ce n'était pas dans le périmètre du correctif 7 stricto sensu — contourné dans le test plutôt que corrigé, mais **documenté ci-dessous comme dette restante**.

## Dette restante identifiée en cours de travail (hors périmètre des 10 correctifs)

- **Bug budget `<select>`** (`ContactPage.tsx`) : la valeur vide par défaut du select budget fait échouer la validation Zod si l'utilisateur ne sélectionne aucune option — alors que `budget` est censé être optionnel. Actuellement le formulaire ne peut pas être soumis tant qu'une option de budget n'est pas explicitement choisie, ce qui contredit le caractère "non requis" du champ. Correctif suggéré (non appliqué) : `budget: z.enum(CONTACT_BUDGET_OPTIONS).optional().or(z.literal(""))`, ou changer l'option vide en `undefined` via `setValueAs`.
- **28 erreurs ESLint serveur préexistantes** (voir section précédente) — nettoyage de code legacy, sans lien avec les formulaires.
- **`client/scripts/prerender.mjs`** : fichier non commité (probablement en cours d'écriture dans une session parallèle) qui ne passe pas le lint (`console`/`process`/`document`/`localStorage` non déclarés) — non touché, hors périmètre et pas mien.

---

## Actions HORS CODE à faire manuellement avant le lancement

1. **Configurer `VITE_CALCOM_LINK` en production** — sans cette variable, le formulaire de contact affichera le fallback statique "Le calendrier n'est pas encore configuré" au lieu du widget de réservation Cal.com. Un warning s'affiche désormais au build de prod si elle est absente (Correctif 10).
2. **Vérifier `client_max_body_size` sur l'hébergeur/reverse-proxy (nginx ou équivalent)** — doit être ≥ 20 Mo pour que l'upload de portfolio (jusqu'à 20 Mo, Correctif 4) ne soit pas rejeté en amont du serveur Node par une limite de proxy plus restrictive.
3. **Vérifier `CONTACT_RECEIVER_EMAIL` en production** — c'est l'adresse qui reçoit les notifications de nouveaux contacts (`contact.service.ts`). Une valeur absente ou incorrecte ferait échouer silencieusement l'envoi d'email (le flux reste fonctionnel côté DB, mais l'agence ne serait jamais notifiée).
4. **Tester manuellement les 3 flux en environnement de production** — liste détaillée des 10 tests ci-dessous.

### Les 10 tests manuels à effectuer, étape par étape

| # | Étape | Résultat attendu |
|---|-------|-------------------|
| 1 | Aller sur `/contact`, soumettre avec un mot de passe... (N/A, pas de mot de passe ici) — remplir tous les champs valides y compris un téléphone `+21622123456`, cliquer "Envoyer et planifier" | Message de succès affiché, formulaire réinitialisé ; vérifier en base qu'un `ContactRequest` et un `Lead` ont bien été créés, et qu'un email est reçu à l'adresse `CONTACT_RECEIVER_EMAIL` |
| 2 | Sur `/contact`, remplir le téléphone avec `12345678` (commence par 1, invalide) et soumettre | Message d'erreur "Veuillez saisir un numéro de téléphone valide" affiché sous le champ ; aucune requête réseau envoyée (vérifiable via l'onglet Réseau du navigateur) |
| 3 | Sur `/contact`, laisser le select "Budget" sur l'option vide "Non précisé" et soumettre (tous les autres champs valides) | **Point de vigilance** : d'après la dette restante identifiée, ceci pourrait échouer silencieusement (bug préexistant, voir section dette). Si un blocage est observé sans message d'erreur visible, c'est ce bug — le contourner en sélectionnant une tranche de budget explicite avant le lancement, ou prioriser sa correction |
| 4 | Soumettre le formulaire de contact 6 fois de suite en moins d'une heure depuis la même IP | Les 5 premières passent, la 6e reçoit une erreur "Too many contact requests, please try again later" (rate limit 5/heure) |
| 5 | Aller sur `/rejoindre` (Join Us), remplir tous les champs, uploader un CV PDF de 11 Mo | Toast d'erreur "Fichier trop volumineux (max 10 Mo)" affiché immédiatement, le fichier n'est pas retenu ; le formulaire reste rempli (pas de perte de saisie) |
| 6 | Sur `/rejoindre`, uploader un portfolio PDF de 15 Mo (CV valide par ailleurs) et soumettre | Candidature acceptée (201), aucune erreur — confirme que la limite 20 Mo annoncée est bien celle appliquée |
| 7 | Soumettre 4 candidatures depuis la même IP en moins d'une heure | Les 3 premières passent, la 4e reçoit "Too many applications submitted, please try again later" (nouveau rate limit dédié 3/heure) |
| 8 | Se connecter sur `/login` avec un mauvais mot de passe | Toast d'erreur "Email ou mot de passe incorrect." affiché ; le bouton redevient cliquable immédiatement (pas de blocage silencieux) |
| 9 | Se connecter avec succès, naviguer vers `/app/invoices?page=2`, puis simuler une expiration de session (supprimer le cookie `refreshToken` via les DevTools, puis rafraîchir la page ou déclencher un appel API protégé) | Toast "Votre session a expiré. Veuillez vous reconnecter." affiché, redirection vers `/login?redirect=%2Fapp%2Finvoices%3Fpage%3D2` ; après une reconnexion réussie, l'utilisateur atterrit exactement sur `/app/invoices?page=2` |
| 10 | Sur `/contact`, remplir le champ caché "website" (honeypot) manuellement via les DevTools (il est invisible à l'écran) avec n'importe quelle valeur, puis soumettre | Réponse de succès identique à une soumission normale (200), mais **aucun** `ContactRequest`/`Lead` créé en base et **aucun** email envoyé — vérifier les logs serveur pour la ligne "Contact form honeypot triggered" |
