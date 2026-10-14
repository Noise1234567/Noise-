-- NOISE-014 : un événement a plusieurs styles choisis par l'organisateur (liste EVENT_STYLES)
-- à la place d'un genre libre. Les anciens genres sont reportés quand ils correspondent à un style
-- de la liste (sans tenir compte de la casse ni du « s » final), sinon « Autre ».
ALTER TABLE "events" ADD COLUMN "styles" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

UPDATE "events" SET "styles" = ARRAY[
  CASE regexp_replace(lower("genre"), 's$', '')
    WHEN 'afrobeat' THEN 'Afrobeat'
    WHEN 'amapiano' THEN 'Amapiano'
    WHEN 'rap' THEN 'Rap'
    WHEN 'électro' THEN 'Électro'
    WHEN 'electro' THEN 'Électro'
    WHEN 'concert' THEN 'Concert'
    WHEN 'soirée' THEN 'Soirée'
    WHEN 'gospel' THEN 'Gospel'
    WHEN 'zouk' THEN 'Zouk'
    WHEN 'coupé-décalé' THEN 'Coupé-décalé'
    WHEN 'dancehall' THEN 'Dancehall'
    WHEN 'jazz' THEN 'Jazz'
    WHEN 'r&b' THEN 'R&B'
    WHEN 'festival' THEN 'Festival'
    ELSE 'Autre'
  END
];

DROP INDEX "events_genre_city_idx";
ALTER TABLE "events" DROP COLUMN "genre";
CREATE INDEX "events_city_idx" ON "events"("city");
CREATE INDEX "events_styles_idx" ON "events" USING GIN ("styles");
