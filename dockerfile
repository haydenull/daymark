FROM oven/bun:1.4.4-slim AS builder
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN bun run build:client

FROM oven/bun:1.4.4-slim AS production
WORKDIR /app
COPY --from=builder /app/package.json /app/bun.lock ./
RUN bun install --frozen-lockfile --production
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/shared ./shared
COPY --from=builder /app/drizzle ./drizzle
COPY --from=builder /app/env.ts /app/tsconfig.json ./
VOLUME /app/data
EXPOSE 3000
CMD bun run db:migrate && bun run start
