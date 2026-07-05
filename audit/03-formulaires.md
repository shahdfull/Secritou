# Audit des 3 flux critiques de conversion — Secritou SaaS

> Date : 2026-07-05 · Commit : `eaea9f5`
> Périmètre : Formulaire de contact (A), Candidature "Join Us" (B), Login (C) — front + back, code lu intégralement.
> Méthode : traçage ligne par ligne composant → hook → API client → route → validateur → controller → service → DB/email.

---

## FLUX A — Formulaire de contact

### Parcours actuel

```
ContactPage.tsx (form)
  └─ onSubmit (ligne 84) → submitContactRequest(values)
       └─ contact.service.ts:38 → POST /contact (axios)
            └─ contact.routes.ts:10
                 contactRateLimit (5 req/h/IP) → validate(contactRequestSchema) → submitContactRequest (controller)
                      └─ contact.controller.ts:8 → contactService.sendContactMessage(req.body)
                           └─ contact.service.ts:10-56
                                ├─ prisma.$transaction : create ContactRequest + upsert Lead (find-or-create par email)  ✅ DB
                                └─ enqueueEmail(...) vers CONTACT_RECEIVER_EMAIL, best-effort (catch + warn si échec)   ✅ Email (async, non bloquant)
                           └─ res 200 { success: true }
```

**Verdict : ce flux aboutit réellement.** Aucune perte de lead — écriture DB transactionnelle (ContactRequest + Lead) puis email asynchrone via queue. Pas de constat CRITIQUE ici, contrairement à l'hypothèse de départ.

Le bouton "Send & schedule" (`t("contact.send")`) ne fait que soumettre le formulaire — il n'ouvre aucun calendrier. La prise de RDV réelle se fait via un widget Cal.com séparé plus bas sur la page (`CalBookingSection`, `ContactPage.tsx:263-325`), sans lien fonctionnel entre les deux.

### Trous constatés

| # | Sévérité | Fichier:Ligne | Constat |
|---|----------|---------------|---------|
| A1 | **HAUTE** | `ContactPage.tsx:53` + `contact.validator.ts:22` | `phone: z.string().optional()` — **aucune regex**, ni côté client ni côté serveur. La clé i18n `contact.invalidPhone` existe en EN/FR mais n'est **jamais utilisée** : la validation téléphone a été prévue puis jamais câblée. Aucun format tunisien (+216 + 8 chiffres) n'est vérifié. |
| A2 | **MOYENNE** | `ContactPage.tsx:145-164` (serviceType), `195-210` (message) | Le `*` visuel n'est affiché que sur `name`, `email`, `company` (`Field` avec prop `required`). `serviceType` (select) et `message` (textarea) sont pourtant **réellement requis** dans le schéma Zod (`z.enum(...)` sans `.optional()`, `message.min(20)`) mais n'affichent aucun astérisque → l'utilisateur ne sait pas qu'ils sont obligatoires avant l'échec de soumission. |
| A3 | **HAUTE** | Aucun fichier | **Aucun honeypot, aucun captcha.** Seule protection anti-spam : rate limit IP 5 req/heure (`contactRateLimit`). Un bot avec rotation d'IP ou proxy peut inonder la boîte mail et la base sans blocage. |
| A4 | **BASSE** | `ContactPage.tsx:19-32`, `contact.service.ts:5-18`, `contact.validator.ts:3-16` | Les enums `serviceType`/`budget` sont **dupliqués à l'identique dans 3 fichiers**, avec un commentaire d'avertissement ("must stay identical character-for-character") au lieu d'une constante partagée. Un dossier `shared/` existe dans le monorepo mais n'est pas utilisé pour ça. Risque de désynchronisation silencieuse. |
| A5 | **MOYENNE** | `ContactPage.tsx:34, 307-320` | Le calendrier Cal.com dépend de `VITE_CALCOM_LINK`. Si absente, fallback stub : *"The calendar isn't set up yet. Reach us directly at hello@secritou.com"*. À vérifier dans `client/.env` de prod si cette variable est bien définie avant lancement. |
| A6 | **BASSE** | `ContactPage.tsx:181` | `<option value="">{t("contact.budget")}</option>` réutilise le label du champ ("Budget") comme option vide au lieu d'un texte du type "Non précisé" — UX confuse. |

### États UI (constats positifs)

- Bouton désactivé immédiatement via `disabled={isSubmitting}` (react-hook-form) → **pas de double-soumission possible**.
- Texte du bouton passe à "Envoi en cours..." pendant l'envoi.
- Message de succès affiché en haut du form, auto-masqué après 5s, formulaire réinitialisé (`reset()`).
- **Erreur réseau gérée correctement** : `catch` → `toast.error(t("contact.unableToSend"))`. C'est le seul des 3 flux qui gère bien ce cas.
- Erreurs de champ affichées sous chaque champ, dans la langue courante (clés i18n existantes en FR/EN).

### Budget — cohérence marché tunisien

Valeurs : `< 1 000 DT`, `1 000–5 000 DT`, `5 000–15 000 DT`, `+15 000 DT`. Devise DT cohérente. Tranches raisonnables pour des prestations d'agence en Tunisie — pas de trou fonctionnel ici, seulement le problème de duplication (A4).

### Code correctif priorisé

**A1 — Validation téléphone (P0)**

```ts
// client/src/features/landing/pages/ContactPage.tsx — dans contactSchema
const TN_PHONE_RE = /^(\+216)?\s?[2-9]\d{7}$/;

phone: z.string().trim().optional().refine(
  (v) => !v || TN_PHONE_RE.test(v.replace(/[\s.-]/g, "")),
  t("contact.invalidPhone")
),
```

```ts
// server/src/validators/contact.validator.ts
const TN_PHONE_RE = /^(\+216)?[2-9]\d{7}$/;

phone: z.string().trim().optional().refine(
  (v) => !v || TN_PHONE_RE.test(v.replace(/[\s.-]/g, "")),
  "Enter a valid Tunisian phone number"
),
```

**A2 — Astérisques manquants (P1)**

```tsx
// ContactPage.tsx:147 — ajouter un indicateur requis au label du select serviceType
<label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
  {t("contact.serviceType")} *
</label>
// ContactPage.tsx:196 — idem pour message
<label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
  {t("contact.message")} *
</label>
```

**A3 — Honeypot (P0, rapide à poser avant lancement)**

```tsx
// ContactPage.tsx — champ caché ajouté au schéma et au form
const contactSchema = z.object({
  // ...
  website: z.string().max(0, "").optional(), // honeypot : doit rester vide
});
```
```tsx
<input type="text" {...register("website")} tabIndex={-1} autoComplete="off"
  style={{ position: "absolute", left: "-9999px" }} aria-hidden="true" />
```
```ts
// contact.validator.ts — rejeter silencieusement si rempli
body: z.object({
  // ...
  website: z.string().max(0).optional(),
})
```
```ts
// contact.controller.ts — si le honeypot est rempli, renvoyer 200 sans rien faire (ne pas alerter le bot)
if (req.body.website) {
  res.status(200).json({ success: true, message: "Message sent successfully" });
  return;
}
```

---

## FLUX B — Candidature "Join Us"

### Parcours actuel

```
JoinUsPage.tsx (form)
  ├─ FileUploadField (cv, accept=".pdf") ─┐
  ├─ FileUploadField (portfolio, .pdf/.zip) ─┤ mode "stockage mémoire" (uploadImmediately=false)
  │                                         │ → PAS d'upload réseau à la sélection, juste useRef
  └─ onSubmit (ligne 62)
       ├─ vérif manuelle uploadedCv.current / uploadedPortfolio.current (sinon toast.error, return)
       ├─ construit un FormData (texte + cvFile + portfolioFile)
       └─ createApplication.mutate(formData as any, { onSuccess })
            └─ useCreateFreelancerApplication (hook typé JSON {cvUrl, portfolioUrl} — incohérent avec FormData réellement envoyé)
                 └─ freelancerApplicationsApi.createApplication → POST /freelancer-applications
                      └─ axios.ts : détecte FormData → retire Content-Type (le multipart part correctement malgré le typage cassé)
                           └─ freelancerApplication.routes.ts:17
                                sensitiveWriteRateLimit (10/min) → createApplication (controller, tableau de middlewares)
                                     ├─ multer.memoryStorage(), limite 10MB/fichier (les deux fichiers)
                                     ├─ validate(createFreelancerApplicationValidator) — champs texte seulement
                                     └─ handler final :
                                          ├─ 400 si cvFile ou portfolioFile absent
                                          └─ freelancerApplicationService.createApplication(...)
                                               ├─ upload.service.ts : vérif magic bytes (file-type) + upload S3/MinIO  ✅ Storage
                                               ├─ freelancerApplicationRepository.create(...) → DB (cvUrl/portfolioUrl signées 7j)  ✅ DB
                                               └─ enqueueEmail(candidat) + enqueueEmail(admins), best-effort, non attendu  ✅ Email
                           └─ res 201 { data: application }
```

**Verdict : ce flux aboutit aussi réellement** (DB + S3 + emails). Pas de perte de candidature en soi, mais plusieurs trous sérieux en UX/robustesse.

### Trous constatés

| # | Sévérité | Fichier:Ligne | Constat |
|---|----------|---------------|---------|
| B1 | **HAUTE** | `JoinUsPage.tsx:84` + `useFreelancerApplications.ts:36-48` | `createApplication.mutate(formData as any, ...)` — le hook est typé pour recevoir `{ cvUrl, portfolioUrl }` (JSON) mais reçoit en réalité un `FormData` avec des fichiers bruts. Ça fonctionne uniquement parce qu'axios détecte `instanceof FormData` et adapte les headers — **aucune garantie de type, aucun test ne semble couvrir ce chemin**. Une évolution future de l'API client (sérialisation JSON explicite) casserait l'upload silencieusement. |
| B2 | **HAUTE** | `freelancerApplication.controller.ts:38-41` vs i18n `joinUs.portfolio` (EN: "max 20MB") | **Incohérence de taille annoncée vs réelle** : Multer limite `fileSize: 10MB` pour CV **et** portfolio, alors que le texte affiché à l'utilisateur promet 20MB pour le portfolio. Un candidat uploadant un portfolio de 15MB (dans la limite annoncée) sera rejeté par une erreur Multer non gérée explicitement (pas de message clair). |
| B3 | **HAUTE** | `JoinUsPage.tsx:84-89` | **Aucun `onError`** sur `createApplication.mutate(...)`. En cas d'échec serveur (413 fichier trop gros, 415 mauvais type, 500), **aucun toast n'est affiché** — l'utilisateur reste bloqué sur le formulaire sans feedback, pense que ça a peut-être marché. |
| B4 | **MOYENNE** | `FileUploadField.tsx:53-60` | Validation côté client limitée à l'extension déclarée dans `accept`. **Aucune vérification de `file.size`** avant l'envoi — le dépassement de 10MB n'est découvert qu'après un aller-retour serveur complet. |
| B5 | **MOYENNE** | Aucun fichier | Pas de honeypot/captcha. Rate limit générique `sensitiveWriteRateLimit` (10 req/min/IP) — élevé pour un formulaire de candidature public (10 candidatures/minute par IP est largement suffisant pour un bot spammeur). |
| B6 | **MOYENNE** | `JoinUsPage.tsx:44` | `phone: z.string().optional()` — même absence totale de regex que le flux A. |
| B7 | **BASSE** | `FileUploadField.tsx:110-114` | Le spinner de chargement ne s'affiche qu'en mode `uploadImmediately=true`, jamais utilisé ici — aucun feedback visuel pendant l'upload final déclenché au submit global (le fichier est déjà en mémoire, mais l'utilisateur ne voit aucune progression pendant que le FormData part vers le serveur). |

### Code correctif priorisé

**B1 — Corriger le typage du hook (P0)**

```ts
// client/src/hooks/useFreelancerApplications.ts
export function useCreateFreelancerApplication() {
  const { t } = useTranslation();
  return useMutation<FreelancerApplication, Error, FormData>({
    mutationFn: (formData) => freelancerApplicationsApi.createApplication(formData),
    onSuccess: () => toast.success(t("joinUs.success")),
    onError: () => toast.error(t("joinUs.submitError")),
  });
}
```
```ts
// client/src/api/freelancerApplications.api.ts
createApplication: async (formData: FormData) => {
  const response = await apiClient.post<{ data: FreelancerApplication }>(
    "/freelancer-applications",
    formData
  );
  return response.data.data;
},
```

**B2 — Aligner les limites de taille (P0)**

```ts
// server/src/controllers/freelancerApplication.controller.ts
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // aligné sur le message i18n "max 20MB"
});
```
Séparer explicitement CV (10MB, PDF only) et portfolio (20MB, PDF/ZIP) via `upload.fields` avec des limites par champ n'est pas nativement supporté par Multer — utiliser un middleware de vérification post-parse :

```ts
const cvFile = (req.files as any)?.cvFile?.[0];
if (cvFile && cvFile.size > 10 * 1024 * 1024) {
  res.status(413).json({ error: "CV file exceeds 10MB limit" });
  return;
}
```

**B3 — Gestion d'erreur (P0)**

```tsx
// JoinUsPage.tsx:84
createApplication.mutate(formData, {
  onSuccess: () => {
    setIsSuccess(true);
    toast.success(t("joinUs.successMessage"));
  },
  onError: (error) => {
    toast.error(error.message || t("joinUs.submitError"));
  },
});
```

**B4 — Validation taille côté client (P1)**

```ts
// FileUploadField.tsx — dans handleChange, après la vérif d'extension
const maxBytes = context === "cv" ? 10 * 1024 * 1024 : 20 * 1024 * 1024;
if (file.size > maxBytes) {
  toast.error(`Fichier trop volumineux (max ${maxBytes / 1024 / 1024}MB)`);
  return;
}
```

---

## FLUX C — Login et redirection

### Parcours actuel

```
LoginPage.tsx (form)
  ├─ redirectTo = ?redirect= validé anti-open-redirect (startsWith("/") && !startsWith("//"))  ✅
  └─ onSubmit → login(data, { onSuccess })
       └─ useLogin (useAuth.ts:87)
            └─ authApi.login → POST /auth/login
                 └─ auth.routes.ts : authRateLimit (30/15min) → validate(loginSchema) → login (controller)
                      └─ authService.login(...) → sendAuthResponse : cookie refresh HTTP-only + { user, tokens.accessToken }
            └─ onSuccess : setSession(...) [accessToken en mémoire Zustand, jamais persisté]
                           toast.success(t("toasts.loginSuccess"))  ✅ traduit FR/EN
                           navigate(redirectTo ?? getRedirectPathForRole(user.role))

Bootstrap (au chargement de l'app) :
useBootstrapSession → POST /auth/refresh (via cookie HTTP-only) → restaure la session en mémoire

Expiration en session :
axios.ts intercepteur 401 → refresh singleton (file d'attente si déjà en cours, timeout 10s)
   ├─ succès → nouveau accessToken, requête originale rejouée
   └─ échec  → useAuthStore.logout() → status "unauthenticated"
                └─ ProtectedRoute réagit → <Navigate to="/login" replace />
```

**Verdict : le mécanisme est globalement solide** (token en mémoire, refresh cookie HTTP-only, anti-open-redirect déjà présent, singleton de refresh anti-race-condition). Les trous sont des détails de robustesse/UX, pas des failles structurelles.

### Trous constatés

| # | Sévérité | Fichier:Ligne | Constat |
|---|----------|---------------|---------|
| C1 | **HAUTE** | `LoginPage.tsx:16` vs `server/src/validators/auth.validator.ts:14` | **Incohérence de validation** : le schéma client accepte un mot de passe dès **6 caractères** (`z.string().min(6, ...)`), le serveur exige **8 caractères minimum**. Un mot de passe de 6-7 caractères passe la validation front, part en requête, et se fait rejeter en 400 par le serveur — sans qu'aucun handler `onError` n'affiche de message (voir C2), l'utilisateur ne comprend pas pourquoi rien ne se passe. |
| C2 | **HAUTE** | `useAuth.ts:87-99` (`useLogin`) + `LoginPage.tsx:29-34` | **Aucun `onError`** sur la mutation de login. Identifiants invalides (401), compte verrouillé, ou incohérence de validation (C1) → **aucun toast d'erreur, aucun message affiché**. Le bouton retombe silencieusement à l'état non-pending et l'utilisateur ne sait pas que ça a échoué. |
| C3 | **MOYENNE** | Aucun appel trouvé dans `axios.ts`, `useAuth.ts`, `auth.store.ts` | La clé i18n `toasts.sessionExpired` existe en FR/EN ("Votre session a expiré...") mais **n'est jamais invoquée**. Quand le refresh échoue en pleine session (cookie expiré), l'utilisateur est redirigé vers `/login` sans aucune explication — il perd son contexte de travail sans comprendre pourquoi. |
| C4 | **BASSE** | `ProtectedRoute.tsx:27-28` | Lors de la redirection vers `/login` après expiration de session en cours de navigation, le `redirectTo` (chemin courant) n'est **pas propagé** en query param `?redirect=`. Après reconnexion, l'utilisateur atterrit sur la page par défaut de son rôle plutôt que sur la page qu'il consultait. |
| C5 | **BASSE** | `ProtectedRoute.tsx` (ensemble) | Pas de vérification des permissions fines (`useAuthStore.can()`) pour le rôle MANAGER au niveau du garde de route global — dépend de chaque page d'appeler `can()` individuellement, risque d'oubli sur une nouvelle route MANAGER-only. |

### Code correctif priorisé

**C1 — Aligner la validation password (P0)**

```ts
// client/src/features/auth/LoginPage.tsx:16
password: z.string().min(8, t("auth.passwordMinLength")),
```

**C2 — Gestion d'erreur login (P0)**

```ts
// client/src/hooks/useAuth.ts
export function useLogin() {
  const queryClient = useQueryClient();
  const setSession = useAuthStore((state) => state.setSession);

  return useMutation({
    mutationFn: async (credentials: LoginCredentials) => authApi.login(credentials),
    onSuccess: async (data) => {
      setSession({ user: data.user, accessToken: data.tokens.accessToken });
      queryClient.setQueryData(["auth.bootstrap"], data);
      toast.success(i18n.t("toasts.loginSuccess"));
    },
    onError: (error: Error) => {
      toast.error(error.message || i18n.t("auth.invalidCredentials", "Email ou mot de passe incorrect"));
    },
  });
}
```

**C3 — Toast session expirée (P1)**

```ts
// client/src/api/axios.ts — dans le bloc catch du refresh échoué (autour de la ligne 154)
} catch (refreshError) {
  processQueue(refreshError, null);
  useAuthStore.getState().logout();
  toast.error(i18n.t("toasts.sessionExpired"));
  rejectRefresh(refreshError);
}
```
(nécessite d'importer `toast` de `sonner` et `i18n` de `@/i18n` dans `axios.ts`)

**C4 — Propager le redirect au logout forcé (P1)**

```tsx
// ProtectedRoute.tsx:27-28
if (status === "unauthenticated") {
  const target = `${redirectTo}?redirect=${encodeURIComponent(location.pathname)}`;
  return <Navigate to={target} replace />;
}
```

---

## Récapitulatif — priorité de correction avant lancement

| Priorité | Flux | Constat | Effort |
|----------|------|---------|--------|
| 🔴 P0 | C | Login : password min 6 (client) vs 8 (serveur) — désynchro validation | 2 min |
| 🔴 P0 | C | Login : aucun `onError` → échecs silencieux | 10 min |
| 🔴 P0 | A | Contact : aucun honeypot/captcha → risque de spam boîte mail | 30 min |
| 🔴 P0 | B | JoinUs : `FormData` via `as any` dans hook typé JSON — fragile | 15 min |
| 🔴 P0 | B | JoinUs : limite Multer 10MB vs 20MB annoncé pour portfolio | 20 min |
| 🔴 P0 | B | JoinUs : aucun `onError` → échecs silencieux | 10 min |
| 🟠 P1 | A | Contact : téléphone sans validation (regex TN absente), clé i18n orpheline | 20 min |
| 🟠 P1 | A | Contact : astérisques manquants sur serviceType/message requis | 5 min |
| 🟠 P1 | B | JoinUs : aucune validation de taille fichier côté client | 15 min |
| 🟠 P1 | B | JoinUs : honeypot/captcha absent, rate limit générique trop permissif | 30 min |
| 🟠 P1 | C | Toast `sessionExpired` jamais déclenché | 10 min |
| 🟠 P1 | C | Redirect non propagé lors du logout forcé | 10 min |
| 🟡 P2 | A | Enums serviceType/budget dupliqués dans 3 fichiers | 30 min |
| 🟡 P2 | A | Vérifier `VITE_CALCOM_LINK` configurée en prod | 5 min |
| 🟢 P3 | A | Option vide du select budget réutilise le label | 5 min |
| 🟢 P3 | C | Pas de vérification `can()` centralisée pour MANAGER dans ProtectedRoute | — (architectural, hors scope formulaires) |

**Constat général** : contrairement à l'hypothèse initiale, **aucun des trois flux ne part dans le vide** — contact et candidature écrivent bien en DB et envoient des emails ; login gère correctement le cycle de vie du token. Les trous réels sont concentrés sur : absence totale de protection anti-bot (A, B), incohérences de validation front/back qui produisent des échecs silencieux sans message utilisateur (A, B, C), et un typage TypeScript cassé côté candidature qui fonctionne par accident.
