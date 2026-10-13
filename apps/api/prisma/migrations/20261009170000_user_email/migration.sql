-- NOISE-047 (DEC-026) : e-mail du compte. Nul pour les comptes existants (créés avant la décision) ;
-- l'API l'exige à l'inscription. Unique, toujours en minuscules.
ALTER TABLE "users" ADD COLUMN "email" VARCHAR(254);

CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

ALTER TABLE "users" ADD CONSTRAINT "users_email_lowercase" CHECK ("email" IS NULL OR "email" = lower("email"));
