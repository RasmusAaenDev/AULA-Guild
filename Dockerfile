FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production PORT=3000 HOSTNAME=0.0.0.0
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
COPY --from=build --chown=node:node /app/drizzle ./drizzle
# Uploadmappen oprettes her, så en monteret volumen arver ejerskabet; compose sætter UPLOAD_DIR.
RUN mkdir -p /app/data/uploads && chown node:node /app/data /app/data/uploads && chmod 0700 /app/data/uploads
USER node
EXPOSE 3000
CMD ["node", "server.js"]
