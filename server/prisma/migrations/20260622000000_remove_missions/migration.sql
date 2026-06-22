-- Remove the freelancer marketplace "mission" concept entirely.
-- Drops FreelancerRating and MissionApplication (which FK into FreelancerMission), then
-- FreelancerMission, and finally the mission-only enums. FreelancerProfile/Skill are kept.
-- Destructive: all mission, application and rating data is permanently deleted.

-- DropForeignKey (defensive: constraints are dropped automatically with the tables, but listed
-- explicitly so the migration is readable and order-safe).
ALTER TABLE "FreelancerRating" DROP CONSTRAINT IF EXISTS "FreelancerRating_applicationId_fkey";
ALTER TABLE "FreelancerRating" DROP CONSTRAINT IF EXISTS "FreelancerRating_missionId_fkey";
ALTER TABLE "FreelancerRating" DROP CONSTRAINT IF EXISTS "FreelancerRating_freelancerId_fkey";
ALTER TABLE "FreelancerRating" DROP CONSTRAINT IF EXISTS "FreelancerRating_reviewerId_fkey";
ALTER TABLE "MissionApplication" DROP CONSTRAINT IF EXISTS "MissionApplication_missionId_fkey";
ALTER TABLE "MissionApplication" DROP CONSTRAINT IF EXISTS "MissionApplication_freelancerId_fkey";
ALTER TABLE "FreelancerMission" DROP CONSTRAINT IF EXISTS "FreelancerMission_companyId_fkey";
ALTER TABLE "FreelancerMission" DROP CONSTRAINT IF EXISTS "FreelancerMission_freelancerId_fkey";
ALTER TABLE "FreelancerMission" DROP CONSTRAINT IF EXISTS "FreelancerMission_projectId_fkey";

-- DropTable (child first, then parent)
DROP TABLE IF EXISTS "FreelancerRating";
DROP TABLE IF EXISTS "MissionApplication";
DROP TABLE IF EXISTS "FreelancerMission";

-- DropEnum (mission-only enums; PaymentStatus is kept — still used by onboarding Payment)
DROP TYPE IF EXISTS "MissionStatus";
DROP TYPE IF EXISTS "MissionApplicationStatus";
