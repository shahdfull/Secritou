-- RG-028/RG-029 : nouveau régime de rémunération à la tâche. Aucun projet existant n'est
-- migré vers cette valeur — l'ajout seul ne change le comportement d'aucun projet.

-- AlterEnum
ALTER TYPE "CommissionSplitMode" ADD VALUE 'PER_TASK';
