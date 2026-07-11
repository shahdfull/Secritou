-- External performance data: generic MetricSnapshot model (source-agnostic:
-- GSC now, GA4/Meta/Google Ads later without a schema change) + per-client
-- Search Console OAuth connection (refresh/access tokens encrypted at rest).

CREATE TYPE "MetricSource" AS ENUM ('GSC', 'GA4', 'META', 'GADS');

CREATE TABLE "GscConnection" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "siteUrl" VARCHAR(500) NOT NULL,
    "encryptedRefreshToken" TEXT NOT NULL,
    "encryptedAccessToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMPTZ(6),
    "connectedById" TEXT NOT NULL,
    "lastSyncedAt" TIMESTAMPTZ(6),
    "lastSyncError" TEXT,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "GscConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GscConnection_clientId_key" ON "GscConnection"("clientId");
CREATE INDEX "GscConnection_clientId_idx" ON "GscConnection"("clientId");

ALTER TABLE "GscConnection" ADD CONSTRAINT "GscConnection_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "GscConnection" ADD CONSTRAINT "GscConnection_connectedById_fkey" FOREIGN KEY ("connectedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "MetricSnapshot" (
    "id" TEXT NOT NULL,
    "clientId" TEXT NOT NULL,
    "projectId" TEXT,
    "source" "MetricSource" NOT NULL,
    "metric" VARCHAR(100) NOT NULL,
    "value" DECIMAL(18,6) NOT NULL,
    "dimension" VARCHAR(500) NOT NULL DEFAULT '',
    "periodStart" TIMESTAMPTZ(6) NOT NULL,
    "periodEnd" TIMESTAMPTZ(6) NOT NULL,
    "createdAt" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetricSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MetricSnapshot_clientId_source_metric_dimension_periodStar_key" ON "MetricSnapshot"("clientId", "source", "metric", "dimension", "periodStart", "periodEnd");
CREATE INDEX "MetricSnapshot_clientId_source_metric_idx" ON "MetricSnapshot"("clientId", "source", "metric");
CREATE INDEX "MetricSnapshot_periodStart_idx" ON "MetricSnapshot"("periodStart");

ALTER TABLE "MetricSnapshot" ADD CONSTRAINT "MetricSnapshot_clientId_fkey" FOREIGN KEY ("clientId") REFERENCES "Client"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetricSnapshot" ADD CONSTRAINT "MetricSnapshot_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE SET NULL ON UPDATE CASCADE;
