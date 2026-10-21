-- Un compte par rôle (DEC-028, NOISE-060). La colonne roles (liste) devient role (un seul rôle).
-- Un même numéro ou e-mail peut porter un compte participant et un compte organisateur,
-- jamais deux comptes du même rôle. Tout ou rien : une seule transaction.

BEGIN;

ALTER TABLE "users" ADD COLUMN "role" "UserRole";

-- Unicité par numéro et par e-mail seuls levée avant de créer les comptes séparés.
DROP INDEX "users_phone_key";
DROP INDEX "users_email_key";

-- Rôle de chaque compte : ADMIN avant ORGANIZER avant PARTICIPANT. Un compte sans rôle
-- (ne devrait pas exister) devient participant.
UPDATE "users" SET "role" = CASE
  WHEN 'ADMIN' = ANY("roles") THEN 'ADMIN'::"UserRole"
  WHEN 'ORGANIZER' = ANY("roles") THEN 'ORGANIZER'::"UserRole"
  ELSE 'PARTICIPANT'::"UserRole"
END;

-- Comptes participant ET organisateur (NOISE-015) : le compte existant reste organisateur
-- (événements, pièce d'identité, liens scanner) ; un compte participant est créé avec le même
-- nom, numéro, e-mail et mot de passe, et reçoit les commandes, billets compris (rattachés
-- à la commande) et les parrainages.
CREATE TEMP TABLE "split_accounts" AS
SELECT "id" AS "organizer_id", gen_random_uuid() AS "participant_id"
FROM "users"
WHERE "role" = 'ORGANIZER' AND 'PARTICIPANT' = ANY("roles");

INSERT INTO "users" ("id", "name", "phone", "email", "password_hash", "roles", "role", "status", "created_at", "updated_at")
SELECT s."participant_id", u."name", u."phone", u."email", u."password_hash", ARRAY['PARTICIPANT']::"UserRole"[],
       'PARTICIPANT', u."status", u."created_at", now()
FROM "split_accounts" s JOIN "users" u ON u."id" = s."organizer_id";

UPDATE "orders" o SET "participant_id" = s."participant_id"
FROM "split_accounts" s WHERE o."participant_id" = s."organizer_id";

UPDATE "orders" o SET "referrer_id" = s."participant_id"
FROM "split_accounts" s WHERE o."referrer_id" = s."organizer_id";

-- Les sessions de ces comptes sont fermées : l'app redemande la connexion, dans le rôle voulu.
UPDATE "refresh_tokens" t SET "revoked_at" = now()
FROM "split_accounts" s WHERE t."user_id" = s."organizer_id" AND t."revoked_at" IS NULL;

ALTER TABLE "users" ALTER COLUMN "role" SET NOT NULL;
ALTER TABLE "users" DROP COLUMN "roles";

CREATE UNIQUE INDEX "users_phone_role_key" ON "users"("phone", "role");
CREATE UNIQUE INDEX "users_email_role_key" ON "users"("email", "role");

DROP TABLE "split_accounts";

COMMIT;
