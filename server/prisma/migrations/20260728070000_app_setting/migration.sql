-- RG-020 : timeout d'inactivité de session rendu configurable (décision du porteur du
-- projet, session du 2026-07-28, voir REFERENTIEL.md §7). Table clé/valeur générique,
-- réutilisable pour de futurs paramètres système, écriture réservée à ADMIN.

-- CreateTable
CREATE TABLE "AppSetting" (
    "key" VARCHAR(120) NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMPTZ(6) NOT NULL,
    "updatedByUserId" TEXT,

    CONSTRAINT "AppSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE INDEX "AppSetting_updatedByUserId_idx" ON "AppSetting"("updatedByUserId");
