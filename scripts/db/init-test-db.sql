-- Exécuté une seule fois à la création du volume Postgres local.
-- Base séparée pour les tests d'intégration de l'API (jamais la base de dev).
CREATE DATABASE noise_test OWNER noise;
