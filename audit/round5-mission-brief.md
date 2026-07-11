# Mission (Round 5) : récupération des volets perdus + nouveaux domaines (surface HTTP, exports, cohérence temporelle)

## Contexte

Quatre passes d'audit ont eu lieu. La plus récente (Round 4) a explicitement signalé que les documents des Rounds 1-3 étaient introuvables et a donc reconstruit indépendamment un sous-ensemble des constats depuis le code actuel — mais a délibérément exclu les items C1-C7 (sessions/tokens, dépendances, audit trail, confidentialité données, accessibilité, secrets, passe adversariale du Round 3) et toute la conformité produit face aux documents CEO (Round 2 : noms des pôles, activation espace client, devise, conversionRate, WordPress vs sur-mesure, etc.), faute de pouvoir reconstituer leur définition exacte sans les documents sources.

Ces items ne sont donc ni corrigés ni infirmés — ils sont simplement non revérifiés depuis le Round 2/3. Cette cinquième passe a trois objectifs :

1. Vérifier les correctifs du Round 4 (3 items sévérité élevée, 5 moyenne, 3 faible/latente) + combler les zones d'ombre qu'il a lui-même listées (réconciliation numérique réelle du dashboard, usage front de idempotencyKey, balayage du pattern doc.url au-delà de DocumentsPage.tsx).
2. Reconstituer et revérifier les volets perdus des Rounds 2 et 3, en repartant des définitions exactes ci-dessous (fournies dans ce prompt pour ne plus dépendre de documents introuvables).
3. Ouvrir de nouveaux domaines jamais audités : en-têtes de sécurité HTTP/CORS/CSP, contournement de la validation d'upload (fichiers polyglotte), injection dans les exports (CSV/Excel), efficacité réelle du rate limiting, cohérence des fuseaux horaires dans toute l'application (pas seulement le booking), et fraîcheur des données côté front (cache React Query périmé après mutation).

Règle absolue inchangée : lecture intégrale du code source actuel, aucune confiance dans un rapport antérieur. Comme le Round 4 l'a bien fait, précise explicitement pour chaque point si une base de données réelle était disponible pour le vérifier empiriquement, ou si le constat repose uniquement sur une lecture structurelle du code.

---

## PARTIE A — Vérification des correctifs Round 4

Statue avec le même système (✅/⚠️/❌/🆕), preuve fichier+ligne, pour :

- GET /summary/dashboard doit désormais scoper ses agrégats par serviceId MANAGER et inclure ce scope dans la clé de cache (summary.service.ts:33-45, summary.repository.ts:103-142).
- executiveMetrics.repository.ts, clientProfitability.repository.ts, revenueForecast.repository.ts doivent désormais filtrer deletedAt: null sur client/project dans leurs agrégats.
- L'API de liste de documents (GET /documents) ne doit plus renvoyer d'URL signée longue durée persistée — le front doit passer par l'endpoint de download signé à la demande (getDownloadUrl, TTL court). Vérifie DocumentsPage.tsx et balaie tout le reste de client/src pour le même pattern (doc.url, .url sur un objet Document/Proposal/Invoice ouvert directement).
- task.repository.ts/invoice.repository.ts : filtre sur le parent (project/client) soft-supprimé.
- documentGenerator.service.ts : régénération ou flag stale sur un PDF de facture déjà généré après modification des line items.
- GET /upload/signed-url : vérification de propriété de la clé avant re-signature.
- managerPermission.service.ts/freelancer.routes.ts : requirePermission("freelancers", ...) ajouté.
- emailTemplates/base.ts : échappement HTML des variables interpolées.
- env.ts : INTEGRATIONS_ENCRYPTION_KEY validée au démarrage si le module GSC est actif.
- maintenance.processor.ts : commentaire/durcissement sur le pattern $executeRawUnsafe.

Zones d'ombre du Round 4 à combler explicitement :
- Réconciliation numérique réelle du dashboard exécutif (B3) : si une base de données de test/dev avec des données réalistes est désormais accessible, exécute le recalcul SQL direct pour 4-5 métriques clés et compare ligne à ligne à l'API — sinon, documente à nouveau explicitement l'impossibilité et pourquoi. (NOTE: try connecting via the DATABASE_URL in server/.env — a local Postgres may genuinely be reachable now; check before assuming it's unavailable.)
- Vérifie si le front fournit systématiquement un idempotencyKey sur le formulaire d'ajout de paiement (conditionnait la sévérité réelle de la race condition résiduelle).
- SPF/DKIM/DMARC du domaine d'envoi réel (hors code, à documenter comme action infra si toujours non vérifiable depuis le dépôt).

---

## PARTIE B — Reconstitution et revérification des volets perdus (Round 2 & Round 3)

### B1. Conformité au cadrage produit (documents CEO) — définitions exactes fournies ici, à ne plus perdre
Extraits pertinents des deux documents CEO (Secritou_Cadrage.docx, Secritou_CahierDesCharges_Site.docx) :

Les 4 pôles officiels (§4, §8.1 du cadrage) : Management & Performance · Croissance digitale · Technologie · IA & Automatisation, chacun piloté par un associé responsable (Responsable Technologie / Responsable Management & Chiffres / Responsable Marketing).
Parcours client en 6 étapes (§6 du cadrage) : RDV découverte → Proposition → paiement 1re tranche = ouverture de l'espace client → 2e réunion de cadrage → Exécution & suivi → Mesure des résultats (rapport mensuel + dashboard en direct).
Répartition des revenus (§7.2) : 60 % CEO / 40 % associé par défaut, évolutif vers 50/50 ; base de calcul (CA brut ou marge nette) et règle d'évolution 60/40→50/50 explicitement non tranchées dans le document.
Devise de référence (§1.1) : dinar tunisien (TND/DT) uniquement.
Paiement en ligne (§4.4 CDC, marqué "À COMPLÉTER") : suivi informatif vs paiement en ligne (Flouci/Konnect/Paymee/e-Dinar) — non tranché.
Plateforme technique (§5 CDC, marqué "À COMPLÉTER") : WordPress envisagé vs sur-mesure — non tranché.
Bilinguisme FR/EN : critère de réception explicite (§9 CDC) : "le site est responsive et bilingue FR/EN".
Rôles du CDC (§2) : Visiteur, Client (activé après acceptation + paiement 1re tranche), Associé, Admin/CEO. Le rôle Freelancer n'y figure pas mais a été confirmé oralement avec le CEO comme extension voulue — à auditer normalement, pas comme écart.

Revérifie chacun de ces points contre le code actuel :
- Les Service.name en base correspondent-ils exactement aux 4 pôles ci-dessus ? (grep seed files / migrations / any hardcoded service names)
- Existe-t-il un flag d'activation de l'espace client (portalActivatedAt ou équivalent) posé uniquement au paiement effectif de la 1re tranche, ou l'accès CLIENT reste-t-il ouvert dès l'acceptation de la proposition ? (Trace: proposal.service.ts acceptWithCascade creates the Client/User immediately — does the CLIENT role's ability to log in / access the portal wait for the deposit invoice's Payment record, or is a login-capable account created at acceptance time regardless of payment?)
- Un rapport mensuel client est-il généré/envoyé, ou seul un dashboard temps réel existe ? (grep for any monthly report generation/email job)
- La base de calcul de la commission (brut vs marge nette) et le mécanisme 60/40→50/50 — inchangés depuis le dernier constat (CA brut, ajustement manuel) ? (re-read commission.service.ts, ProjectCommissionSplit model)
- Un sélecteur de devise autre que TND existe-t-il encore quelque part côté front (ex. CreateInvoiceDialog.tsx, CreateProposalDialog, etc.) ?
- LegalPage.tsx (ou équivalent mentions légales) est-elle entièrement traduite FR/EN ?
- Deux métriques de taux de conversion distinctes cohabitent-elles encore sous un nom ambigu (conversionRate) ? (grep exhaustively for "conversionRate" across server and client)

### B2. Domaines nouveaux du Round 3 — définitions exactes fournies ici
- Cycle de vie des sessions/tokens : durée de vie JWT access/refresh, rotation du refresh token (détection de réutilisation), invalidation réelle au logout, invalidation des sessions actives après changement de mot de passe/rôle, sécurité du flux de reset password (déjà vérifié une fois en Round 4 comme sain — reconfirme).
- Dépendances/supply chain : lance `npm audit --omit=dev` puis `npm audit` (les deux, séparément) sur server/ et client/, liste les vulnérabilités high/critical trouvées, évalue l'exploitabilité réelle compte tenu de l'usage effectif du package dans ce projet (pas juste "il y a une CVE").
- Traçabilité des actions sensibles (audit trail) : suppression de client, changement de rôle, annulation de facture, marquage commission payée, changement de permission MANAGER — trace immuable de qui/quand, au-delà des logs génériques applicatifs (winston/pino). Cherche un modèle d'audit log dédié en base (grep schema.prisma pour "AuditLog" ou équivalent) — sinon confirme son absence.
- Confidentialité des données personnelles : mécanisme de suppression/export sur demande pour un client/freelance (droit RGPD-like même si Tunisie n'est pas UE, bonne pratique), exposition de données sensibles en clair dans logs/erreurs/exports (grep logger.error/info calls near password/token/hourlyRate fields), politique de rétention des leads/candidatures rejetées (y a-t-il une purge automatique après X mois, ou conservation indéfinie ?).
- Accessibilité du site public (WCAG de base) : alt sur images, contraste, navigation clavier sur le formulaire de contact et le module de prise de RDV, labels de formulaire correctement associés (grep <label>/aria-label/htmlFor vs id matching in the public contact/booking form components).
- Hygiène de configuration/secrets : balayage systématique de `process.env.X ?? "..."` / `|| "..."` sur des valeurs sensibles dans TOUT server/src (grep exhaustif, pas seulement les cas déjà identifiés). Vérifie aussi si des données de seed/démo (grep prisma/seed.ts for hardcoded credentials/test accounts) restent accessibles/documented as removable in production.

---

## PARTIE C — Nouveaux domaines (jamais audités en 4 rounds)

### C1. En-têtes de sécurité HTTP, CORS, CSP
- Vérifie la configuration CORS du serveur (app.ts ou middleware dédié) : liste blanche d'origines stricte, ou origin: "*"/reflète l'origine sans validation ? credentials: true combiné à une origine trop permissive serait une faille sérieuse.
- Vérifie la présence et la configuration de helmet (ou équivalent) : Content-Security-Policy, X-Frame-Options/frame-ancestors (protection clickjacking sur les pages d'authentification et le portail client), Strict-Transport-Security, X-Content-Type-Options.
- Vérifie si les cookies (refresh token) ont HttpOnly, Secure, SameSite correctement configurés.

### C2. Contournement de la validation d'upload — fichiers polyglotte
- Le mécanisme de sniffing par magic-byte (file-type) résiste-t-il à un fichier polyglotte (ex. un fichier qui est simultanément un PDF valide et contient du HTML/JS exploitable si jamais servi avec un mauvais Content-Type, ou un fichier ZIP/image avec une charge utile appendée après la fin du format attendu) ?
- Vérifie le Content-Type réellement servi au téléchargement (document.service.ts/route de download) : est-il forcé à une valeur sûre cohérente avec le magic-byte détecté à l'upload (Content-Disposition: attachment pour empêcher l'exécution inline dans le navigateur), ou reflète-t-il un champ contrôlé par l'utilisateur qui pourrait permettre un XSS stocké au moment du téléchargement ?

### C3. Injection dans les exports (CSV/Excel)
- Cherche toute fonctionnalité d'export de données (factures, clients, leads, rapports) en CSV/Excel : un champ texte libre utilisateur commençant par =, +, -, @ est-il échappé avant d'être écrit dans le fichier exporté ? Sinon, injection de formule CSV classique.

### C4. Efficacité réelle du rate limiting
- Pour chaque endpoint public rate-limité (contact, login, candidature freelance, réservation) : la clé de rate limiting est-elle basée sur l'IP seule ? Si oui, dérivée de X-Forwarded-For sans validation d'un proxy de confiance en amont ? Vérifie la config `trust proxy` d'Express en cohérence avec l'infra réelle.

### C5. Vérification de signature des webhooks (si applicable)
- Recherche toute route recevant un webhook externe (paiement, email transactionnel, service tiers). Si présent : vérifie qu'une signature crypto du payload est vérifiée avant traitement.

### C6. Cohérence des fuseaux horaires dans toute l'application (au-delà du booking déjà vérifié)
- Vérifie la cohérence entre les dates stockées (UTC en base), les dates affichées côté client (fuseau Tunisie ou fuseau navigateur ?), et les dates utilisées dans les calculs métier côté serveur (échéances de facture, jobs cron "daily 08:00" — heure serveur ou heure Tunisie ?).
- Vérifie particulièrement les bornes from/to des filtres dashboard/rapports (MTD, YTD) : fuseau utilisateur ou fuseau serveur qui pourrait décaler un total d'un jour entier pour un utilisateur en Tunisie.

### C7. Fraîcheur des données côté front après mutation (staleness de cache React Query)
- Après une mutation (paiement ajouté, statut de tâche changé, approbation traitée), les vues qui en dépendent (liste, dashboard, badge de notification) sont-elles invalidées/rafraîchies, ou un utilisateur peut-il voir un état périmé jusqu'à un rechargement manuel ? Concentre-toi sur les écrans où un état périmé pourrait induire une double action (ex. écran de paiement qui ne se rafraîchit pas après ajout, l'utilisateur soumet un second paiement croyant que le premier n'est pas passé).

---

## Format de sortie

- Rapport 1 — statuts des correctifs Round 4 + zones d'ombre comblées.
- Rapport 2 — reconstitution et statut des volets perdus (conformité produit B1, nouveaux domaines Round 3 B2), avec la même rigueur que s'ils étaient audités pour la première fois.
- Rapport 3 — nouveaux domaines C1 à C7.
- Synthèse consolidée finale — liste unique de tous les items encore réellement ouverts, toutes passes confondues (Round 1 à 5), triée par sévérité réelle. Cette liste doit désormais servir de seule référence à jour ; précise explicitement, pour chaque item historique, dans quel round il a été trouvé/vérifié pour la dernière fois.
- Section "Non vérifié / zones d'ombre" actualisée.
- Section méthodologie actualisée, avec mention explicite de toute base de données réelle utilisée ou non pour les vérifications empiriques (comme fait au Round 4).
