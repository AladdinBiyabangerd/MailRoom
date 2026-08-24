# syntax=docker/dockerfile:1

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN npm ci

FROM deps AS web-build
COPY apps/web apps/web
ENV VITE_ADMIN_API_URL=/admin/v1
RUN npm run build -w @mailroom/web

FROM deps AS api-build
COPY apps/api apps/api
RUN npx prisma generate --schema apps/api/prisma/schema.prisma
RUN npm run build -w @mailroom/api

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/package.json ./package.json
COPY --from=deps /app/apps/api/package.json ./apps/api/package.json
COPY --from=api-build /app/apps/api/dist ./apps/api/dist
COPY --from=api-build /app/apps/api/prisma ./apps/api/prisma
COPY --from=api-build /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=api-build /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=web-build /app/apps/web/dist ./apps/web/dist
EXPOSE 8090
WORKDIR /app/apps/api
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
