-- SEC-016 (ANOMALIES.yaml) : server/src/jobs/processors/maintenance.processor.ts
-- (archiveColdData) référence LeadArchive et ContactRequestArchive, absentes du
-- schéma depuis l'introduction du job. Ces deux tables sont créées ici avec
-- exactement le même jeu de colonnes que "Lead"/"ContactRequest" (le job fait
-- INSERT INTO ... SELECT * FROM moved, donc la forme doit être identique).
--
-- Partitionnement RANGE sur "createdAt", mensuel : c'est ce que
-- ensureMonthlyPartitions() attend (CREATE TABLE ... PARTITION OF ... FOR VALUES
-- FROM/TO sur une colonne date). Les partitions elles-mêmes sont créées à
-- l'exécution par le job, pas ici — seule la table partitionnée parente est créée.
--
-- Volontairement PAS de clé primaire, FK, ni index sur ces tables : ce sont des
-- copies d'archive en écriture seule (le job ne les relit jamais), et Postgres
-- exige que toute clé unique inclue la colonne de partition — reproduire les
-- contraintes de la table source ajouterait de la complexité sans bénéfice ici.
--
-- Scope volontairement limité à Lead + ContactRequest (décision du porteur du
-- projet, session du 2026-07-17) : Document et Notification restent hors de
-- cette migration — voir ANOMALIES.yaml SEC-016 pour le détail (risque de
-- cascade sur DocumentAccessLog/versioning pour Document, non ré-évalué pour
-- Notification malgré l'absence de FK entrante trouvée).

-- CreateTable
-- Column order below matches "Lead"'s ACTUAL physical column order (verified via
-- information_schema.columns against a live migrated database, session du 2026-07-17,
-- SEC-020) — not schema.prisma's field-declaration order, which places "lostReason"
-- before "createdAt"/"updatedAt". Physical order is what `INSERT ... SELECT *` binds
-- positionally in Postgres; a text-order match is not sufficient (this mismatch broke
-- the job's INSERT with "column updatedAt is of type timestamptz but expression is of
-- type character varying" on first real run, see SEC-020).
CREATE TABLE "LeadArchive" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255),
    "phone" VARCHAR(50),
    "source" VARCHAR(100),
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "notes" TEXT,
    "serviceId" TEXT,
    "convertedClientId" TEXT,
    "archivedAt" TIMESTAMPTZ(6),
    "sourceContactId" TEXT,
    "assignedManagerId" TEXT,
    "department" VARCHAR(255),
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "lostReason" VARCHAR(500),

    CONSTRAINT "LeadArchive_pkey" PRIMARY KEY ("id", "createdAt")
) PARTITION BY RANGE ("createdAt");

-- CreateTable
CREATE TABLE "ContactRequestArchive" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "phone" VARCHAR(50),
    "serviceType" VARCHAR(255) NOT NULL,
    "budget" VARCHAR(255),
    "company" VARCHAR(255) NOT NULL,
    "message" TEXT NOT NULL,
    "status" "ContactStatus" NOT NULL DEFAULT 'NEW',
    "convertedAt" TIMESTAMPTZ(6),
    "createdAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "ContactRequestArchive_pkey" PRIMARY KEY ("id", "createdAt")
) PARTITION BY RANGE ("createdAt");
