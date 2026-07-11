-- Data fix: some deployments still have the four poles under their old English names
-- (Business Performance, Digital Growth, Technology Solutions, AI & Automation), seeded before
-- the pole labels were switched to French. serviceMapping.ts and prisma/seed.ts now only know
-- the French names, so any deployment still on the English names silently fails to match a
-- pole (e.g. contact-form leads land unassigned instead of routed).
--
-- For each pole: if the French-named row doesn't exist yet, rename the English row in place
-- (preserves its id and every FK pointing at it). If the French-named row already exists
-- (e.g. seed was re-run and created a duplicate), repoint every FK from the English row onto
-- the French row, then delete the now-orphaned English row.

DO $$
DECLARE
  renames text[][] := ARRAY[
    ARRAY['Business Performance', 'Management & Performance'],
    ARRAY['Digital Growth', 'Croissance digitale'],
    ARRAY['Technology Solutions', 'Technologie'],
    ARRAY['AI & Automation', 'IA & Automatisation']
  ];
  r text[];
  old_id text;
  new_id text;
BEGIN
  FOREACH r SLICE 1 IN ARRAY renames LOOP
    SELECT id INTO old_id FROM "Service" WHERE name = r[1];
    IF old_id IS NULL THEN
      CONTINUE; -- nothing to fix on this deployment
    END IF;

    SELECT id INTO new_id FROM "Service" WHERE name = r[2];

    IF new_id IS NULL THEN
      UPDATE "Service" SET name = r[2] WHERE id = old_id;
    ELSE
      UPDATE "Lead" SET "serviceId" = new_id WHERE "serviceId" = old_id;
      UPDATE "Client" SET "serviceId" = new_id WHERE "serviceId" = old_id;
      UPDATE "User" SET "serviceId" = new_id WHERE "serviceId" = old_id;
      UPDATE "Project" SET "serviceId" = new_id WHERE "serviceId" = old_id;
      -- ProjectTemplate.serviceId is @unique: repoint onto the new pole if it has no
      -- template of its own yet; otherwise the new pole's template wins and the old one
      -- (with its task checklist) is dropped rather than violating the unique constraint.
      IF EXISTS (SELECT 1 FROM "ProjectTemplate" WHERE "serviceId" = new_id) THEN
        DELETE FROM "TaskTemplate" WHERE "templateId" IN (SELECT id FROM "ProjectTemplate" WHERE "serviceId" = old_id);
        DELETE FROM "ProjectTemplate" WHERE "serviceId" = old_id;
      ELSE
        UPDATE "ProjectTemplate" SET "serviceId" = new_id WHERE "serviceId" = old_id;
      END IF;
      DELETE FROM "Service" WHERE id = old_id;
    END IF;
  END LOOP;
END $$;
