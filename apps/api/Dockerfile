FROM node:22-bookworm-slim AS builder

WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/package.json
COPY apps/desktop/package.json apps/desktop/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN npm ci --workspace @inventory/api --workspace @inventory/contracts --include-workspace-root

COPY tsconfig.base.json ./
COPY packages/contracts packages/contracts
COPY apps/api apps/api
RUN npm run build -w @inventory/contracts \
    && npm run prisma:generate -w @inventory/api \
    && npm run build -w @inventory/api

FROM node:22-bookworm-slim AS runner

ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /app/package.json /app/package-lock.json ./
COPY --from=builder /app/node_modules node_modules
COPY --from=builder /app/packages/contracts packages/contracts
COPY --from=builder /app/apps/api/package.json apps/api/package.json
COPY --from=builder /app/apps/api/dist apps/api/dist
COPY --from=builder /app/apps/api/prisma apps/api/prisma

USER node
EXPOSE 3000
CMD ["node", "apps/api/dist/main.js"]

