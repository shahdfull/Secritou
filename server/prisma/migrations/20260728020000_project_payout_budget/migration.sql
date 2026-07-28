-- RG-006 (refonte paiement à la tâche) : enveloppe maximale versable sur un projet, fixée
-- explicitement par le CEO. Nullable et ajoutée sans valeur par défaut — aucun projet existant
-- n'est modifié par cette migration, tant que le CEO ne fixe pas l'enveloppe l'écriture d'un
-- payoutAmount de Task est bloquée côté service (voir LOT 3, PAYOUT_BUDGET_NOT_SET).

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "payoutBudget" DECIMAL(14,3);
