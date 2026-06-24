-- Migrate Comment.id from cuid to uuid for new rows.
-- Existing rows keep their cuid values (they are opaque strings; the PK type is TEXT either way).
-- No structural change needed : Prisma's @default(uuid()) only affects application-side generation.
-- New insertions via Prisma will use gen_random_uuid(); existing data is unaffected.
SELECT 1;
