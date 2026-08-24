-- Link campaign membership to address-book contacts by id (live email/name).

-- 1. Add nullable contact_id for backfill
ALTER TABLE "email_campaign_contacts" ADD COLUMN "contact_id" INTEGER;

-- 2. Ensure every campaign contact row has a matching address-book contact
INSERT INTO "email_address_book_contacts" ("email", "name", "created_at", "updated_at")
SELECT DISTINCT ON (LOWER(cc."email"))
  LOWER(cc."email"),
  cc."name",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "email_campaign_contacts" cc
WHERE NOT EXISTS (
  SELECT 1
  FROM "email_address_book_contacts" ab
  WHERE LOWER(ab."email") = LOWER(cc."email")
)
ORDER BY LOWER(cc."email"), cc."id";

UPDATE "email_campaign_contacts" cc
SET "contact_id" = ab."id"
FROM "email_address_book_contacts" ab
WHERE LOWER(ab."email") = LOWER(cc."email");

-- 3. Drop duplicate membership rows (same campaign + contact)
DELETE FROM "email_campaign_contacts" a
USING "email_campaign_contacts" b
WHERE a."id" > b."id"
  AND a."campaign_id" = b."campaign_id"
  AND a."contact_id" = b."contact_id";

-- 4. Enforce NOT NULL + drop snapshot columns
ALTER TABLE "email_campaign_contacts" ALTER COLUMN "contact_id" SET NOT NULL;
ALTER TABLE "email_campaign_contacts" DROP COLUMN "email";
ALTER TABLE "email_campaign_contacts" DROP COLUMN "name";

-- 5. Indexes / constraints
CREATE UNIQUE INDEX "email_campaign_contacts_campaign_id_contact_id_key"
  ON "email_campaign_contacts"("campaign_id", "contact_id");

ALTER TABLE "email_campaign_contacts"
  ADD CONSTRAINT "email_campaign_contacts_contact_id_fkey"
  FOREIGN KEY ("contact_id") REFERENCES "email_address_book_contacts"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
