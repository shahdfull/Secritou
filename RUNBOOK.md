# Secritou — Runbook opérationnel

Référence on-call pour les incidents courants. Stack : Node 24 / Express 5 / Prisma /
PostgreSQL / Redis / BullMQ / MinIO / React 19.

---

## 1. Base de données

### 1.1 Restaurer depuis un backup S3

```bash
# Lister les backups disponibles
aws s3 ls s3://${S3_BUCKET}/daily/ --endpoint-url ${S3_ENDPOINT}

# Restaurer un dump spécifique
export DATABASE_URL=postgresql://...
export S3_BUCKET=secritou-prod
export S3_ENDPOINT=https://minio.secritou.com
export AWS_ACCESS_KEY_ID=...
export AWS_SECRET_ACCESS_KEY=...
bash scripts/restore-db.sh daily/secritou-20260711T030000Z.dump

# Après restauration, appliquer les migrations si besoin
cd server && npx prisma migrate deploy
```

> ⚠️ Le script supprime et recrée la base. Il demande une confirmation interactive.

### 1.2 Accès token JWT toujours valide après suppression d'utilisateur

**Symptôme :** Un utilisateur supprimé peut encore accéder à l'API pendant ≤ 15 min
(`JWT_ACCESS_EXPIRES_IN`).

**Comportement attendu :** Les refresh tokens sont révoqués immédiatement à la suppression.
Le token d'accès expire naturellement au bout de 15 min.

**Si révocation immédiate requise :** Redémarrer le serveur pour vider les caches
en mémoire, ou réduire `JWT_ACCESS_EXPIRES_IN` à `5m` dans `.env`.

### 1.3 Dérive de schéma Prisma

```bash
# Vérifier si le schéma local a divergé des migrations
cd server && npx prisma migrate diff \
  --from-migrations ./prisma/migrations \
  --to-schema-datamodel ./prisma/schema.prisma \
  --exit-code
# Exit 0 = ok, exit 1 = drift détecté
```

---

## 2. BullMQ / Jobs

### 2.1 Jobs bloqués ou échoués

```bash
# Voir l'état des queues via le dashboard BullMQ (si monté)
# GET /api/v1/bull-board  (accessible admin seulement)

# Ou via Redis CLI :
redis-cli -a $REDIS_PASSWORD
> KEYS bull:*:failed
> LLEN bull:communication:failed
```

**Actions :**
- Jobs `sendEmail` / `sendNotification` en échec → vérifier SMTP (`SMTP_HOST`, `SMTP_PASSWORD`)
- Jobs `generateDocument` en échec → vérifier MinIO connectivity (`S3_ENDPOINT`, `S3_BUCKET`)
- Jobs `maintenance:markOverdueInvoices` en échec → vérifier `DATABASE_URL`

### 2.2 Redémarrer un worker bloqué

```bash
docker-compose -f docker-compose.prod.yml restart server
# Les jobs repeatable (cron BullMQ) se ré-enregistrent au démarrage.
```

### 2.3 Jobs orphelins après suppression d'utilisateur

Des jobs `sendNotification` avec un `userId` supprimé peuvent rester en queue.
Ils échouent gracieusement (user not found) sans effet de bord. Nettoyage manuel :

```bash
# BullMQ dashboard → Failed → supprimer les jobs pour userId connu
```

---

## 3. Google Search Console (GSC)

### 3.1 Token révoqué (`GSC_TOKEN_REVOKED`)

**Symptôme :** Alerte `GSCTokenRevoked` dans Grafana / notification in-app admin.

**Cause :** L'utilisateur Google a révoqué l'accès OAuth ou le refresh token a expiré.

**Action :**
1. Aller dans `Settings → Intégrations → Search Console`
2. Déconnecter et reconnecter le compte Google du client
3. Vérifier que `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `INTEGRATIONS_ENCRYPTION_KEY` sont bien définis

### 3.2 Quotas Google dépassés

**Symptôme :** Alerte `GSCSyncErrors` — erreurs 429 dans les logs.

**Action :** `syncAllConnectedClients` s'exécute une fois par jour (05:00 Tunisia).
Si le quota est dépassé, décaler le cron à une heure creuse ou réduire la fréquence.

---

## 4. Déploiement et rollback

### 4.1 Déploiement standard

```bash
# Sur le serveur de production
cd ~/secritou
git pull origin main
GIT_SHA=$(git rev-parse --short HEAD) docker-compose -f docker-compose.prod.yml up --build -d
```

### 4.2 Rollback (H-2 : sans image registry)

Le `docker-compose.prod.yml` actuel construit depuis les sources — un rollback requiert
un rebuild depuis un commit antérieur :

```bash
git checkout <previous-sha>
GIT_SHA=<previous-sha> docker-compose -f docker-compose.prod.yml up --build -d
```

**Temps estimé :** 3–8 min (rebuild TypeScript + Prisma).

> **Futur (H-2 mitigation) :** Pousser des images taguées vers un registry
> (`ghcr.io/secritou/server:<sha>`) permettrait un rollback en < 30 s via
> `docker pull + up -d`.

### 4.3 Vérifier la version déployée

```bash
curl https://api.secritou.com/api/v1/health
# {"data":{"status":"ok","version":"ab3f1c2"}}
```

---

## 5. Upload / MinIO

### 5.1 Upload échouant (503 / timeout)

**Symptôme :** Erreur `S3ServiceException` dans les logs.

**Action :**
```bash
# Vérifier la santé de MinIO
curl http://localhost:9000/minio/health/live
# Redémarrer si nécessaire
docker-compose -f docker-compose.prod.yml restart minio
```

### 5.2 Fichiers orphelins en bucket

Des clés S3 peuvent exister sans ligne `Document` correspondante si une suppression
a échoué partiellement. Audit manuel :

```bash
# Lister les clés en bucket
aws s3 ls s3://${S3_BUCKET}/ --recursive --endpoint-url ${S3_ENDPOINT} | awk '{print $4}' > /tmp/s3-keys.txt
# Comparer avec les fileKey en DB (Prisma Studio ou psql)
```

---

## 6. Secrets à faire pivoter

| Secret | Où pivoter | Urgence |
|---|---|---|
| `JWT_ACCESS_SECRET` | `server/.env` → redémarrer server | Sur compromission |
| `JWT_REFRESH_SECRET` | `server/.env` → redémarrer server (révoque toutes sessions) | Sur compromission |
| `INTEGRATIONS_ENCRYPTION_KEY` | `server/.env` → reconnecter tous les comptes GSC | Sur compromission |
| Gmail App Password (`SMTP_PASSWORD`) | `myaccount.google.com/apppasswords` + `server/.env` | **Maintenant** (voir CRIT-1) |
| MinIO root password | Console MinIO + `docker-compose.prod.yml` env | Annuellement |

---

## 7. Processus breaking-change API

Secritou est single-tenant (une seule agence) et n'expose pas d'API publique tierce.
Un « breaking change » est tout changement qui casse le contrat entre le client React
et le serveur Express (renommage de champ, suppression d'endpoint, nouveau champ
obligatoire, changement de format de date).

### Procédure obligatoire avant tout breaking change

1. **Identifier les consommateurs** — grep le champ/endpoint dans `client/src/` et `e2e/`.
2. **Migrer les deux côtés dans le même PR** — le client et le serveur doivent être
   déployés ensemble (même image, même `docker-compose up`). Ne jamais déployer
   le serveur seul si le client a un changement correspondant.
3. **Tester en staging** (`NODE_ENV=staging`) avant la production.
4. **Version dans le health endpoint** — vérifier que `GET /api/v1/health` retourne
   le bon SHA après déploiement :
   ```bash
   curl https://api.secritou.com/api/v1/health
   # {"data":{"status":"ok","version":"<new-sha>"}}
   ```
5. **Rollback immédiat si régression** — voir §4.2 (rollback < 8 min).

### Cas particuliers

| Scénario | Approche |
|---|---|
| Renommage de champ Prisma | Migration additive (nouveau champ) + backfill + suppression de l'ancien dans un second PR |
| Suppression d'endpoint | Conserver l'endpoint avec `410 Gone` pendant 1 sprint, puis supprimer |
| Nouveau champ obligatoire en body | Ajouter Zod `.optional()` + valeur par défaut côté serveur d'abord |
| Changement de format de date | Toujours ISO 8601 UTC — ne pas changer sauf migration explicite |

---

## 8. Contacts et escalade

| Rôle | Contact | Quand |
|---|---|---|
| Dev on-call | — | Incidents applicatifs |
| Hébergeur / VPS | — | Réseau, disque, VM |
| Google Support | support.google.com | Quota GSC, OAuth |
