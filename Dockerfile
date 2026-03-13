#FROM node:14
#WORKDIR /app
#COPY src/package*.json ./
#RUN npm install
#COPY src/ ./
#EXPOSE 3000
#CMD ["node", "server.js"]

# ✅ Image Alpine (plus légère et sécurisée) - Version la plus récente
# ✅ Utilisation d'une version LTS stable et légère
FROM node:22-alpine

# ✅ Définition de l'environnement en production dès le build
ENV NODE_ENV=production

WORKDIR /app

# ✅ Optimisation du cache : on ne copie que les fichiers de dépendances d'abord
# ✅ Utilisation de --chown directement pour éviter une couche RUN supplémentaire
COPY --chown=node:node src/package*.json ./

# ✅ npm ci est plus rapide et plus sûr en CI/CD que npm install
# ✅ Suppression du cache npm pour réduire la taille finale de l'image
RUN npm ci --omit=dev && npm cache clean --force

# ✅ Copie du reste du code avec les bons droits
COPY --chown=node:node src/ ./

# ✅ Utilisation de l'utilisateur 'node' déjà créé dans l'image officielle Alpine
# ✅ C'est plus propre que de recréer un utilisateur manuellement
USER node

# Port de l'application
EXPOSE 3000

# ✅ Healthcheck : Crucial pour que l'orchestrateur (Docker/K8s) sache si l'app est saine
# Ajout de --start-period pour laisser le temps à l'app de démarrer
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "require('http').get('http://localhost:3000/health', (r) => process.exit(r.statusCode === 200 ? 0 : 1))"

# ✅ Lancement sécurisé
CMD ["node", "server.js"]