-- Cycle Audit 3: rows already waiting for a team when 0017 was applied get a starting point, so the queue shows
-- their age and supervision stops falling back to updated_at (which moves with every note).
UPDATE "support_cases" SET "waiting_internal_since" = "updated_at" WHERE "status" = 'waiting_internal' AND "waiting_internal_since" IS NULL;
