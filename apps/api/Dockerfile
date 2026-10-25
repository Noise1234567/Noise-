# syntax=docker/dockerfile:1
#
# Image de l'API Noise (NOISE-016). Elle contient aussi le scanner web, servi par l'API sous /scan.
# Le contexte de build est la racine du dépôt :
#   docker build -f apps/api/Dockerfile -t noise-api .
#
# Deux étapes : « build » compile tout (outils de compilation, dépendances de développement),
# « runtime » ne garde que le résultat. Le même Dockerfile sert sur Intel et sur ARM.

ARG NODE_VERSION=24

# ---------- Étape 1 : compiler ----------
FROM node:${NODE_VERSION}-slim AS build
WORKDIR /app

# OpenSSL est requis par Prisma. corepack installe la version de pnpm fixée dans package.json.
RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/* \
  && corepack enable

# Les fichiers de dépendances d'abord : cette couche est réutilisée tant que pnpm-lock.yaml
# ne change pas, ce qui rend les déploiements suivants beaucoup plus rapides.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/
COPY apps/scanner/package.json apps/scanner/
COPY packages/shared/package.json packages/shared/

# Seulement l'API, le scanner et leurs dépendances : l'application mobile (React Native) n'est pas installée.
# --ignore-scripts, puis rebuild des seuls paquets qui téléchargent un binaire (moteur Prisma, esbuild).
# « prisma --version » force le téléchargement du moteur de migration : si le réseau le bloque, c'est
# le build qui échoue, pas le démarrage de l'API.
RUN pnpm install --frozen-lockfile --ignore-scripts --filter "@noise/api..." --filter "@noise/scanner..." \
  && pnpm rebuild @prisma/engines prisma esbuild \
  && pnpm --filter @noise/api exec prisma --version

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api
COPY apps/scanner apps/scanner

RUN pnpm --filter @noise/shared build \
  && pnpm --filter @noise/api db:generate \
  && pnpm --filter @noise/api build \
  && pnpm --filter @noise/scanner build

# ---------- Étape 2 : exécuter ----------
FROM node:${NODE_VERSION}-slim AS runtime
WORKDIR /app/apps/api

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Même arborescence que le dépôt : l'API cherche le scanner dans ../scanner/dist.
# On garde les dépendances de développement : le CLI Prisma applique les migrations au démarrage.
COPY --from=build --chown=node:node /app /app

ENV NODE_ENV=staging \
  PORT=3000
USER node
EXPOSE 3000

# Au démarrage : migrations (prisma migrate deploy), puis l'API. Si une migration échoue, le
# conteneur s'arrête et l'ancienne version reste visible dans les journaux au lieu de tourner à moitié.
CMD ["sh", "-c", "/app/node_modules/.bin/prisma migrate deploy && exec node dist/server.js"]
