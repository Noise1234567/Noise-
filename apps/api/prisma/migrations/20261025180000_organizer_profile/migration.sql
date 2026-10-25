-- Contacts publics d'un organisateur (NOISE-061) : WhatsApp et réseaux sociaux, tous facultatifs.
CREATE TABLE "organizer_profiles" (
    "user_id" UUID NOT NULL,
    "whatsapp_phone" VARCHAR(16),
    "instagram_url" VARCHAR(200),
    "facebook_url" VARCHAR(200),
    "tiktok_url" VARCHAR(200),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "organizer_profiles_pkey" PRIMARY KEY ("user_id")
);

ALTER TABLE "organizer_profiles" ADD CONSTRAINT "organizer_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Liens toujours en https (la validation de l'API normalise ; garde-fou en base).
ALTER TABLE "organizer_profiles" ADD CONSTRAINT "organizer_profiles_links_https" CHECK (
    ("instagram_url" IS NULL OR "instagram_url" LIKE 'https://%')
    AND ("facebook_url" IS NULL OR "facebook_url" LIKE 'https://%')
    AND ("tiktok_url" IS NULL OR "tiktok_url" LIKE 'https://%')
);
