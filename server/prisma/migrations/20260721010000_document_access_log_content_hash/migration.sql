-- SEC-185: adds a content hash column to DocumentAccessLog, populated only for the "SIGN" action
-- — binds a contract signature to the exact document bytes (S3 ETag/MD5) at signature time,
-- independent of Document.signedAt.
ALTER TABLE "DocumentAccessLog" ADD COLUMN "contentHash" VARCHAR(64);
