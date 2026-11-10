# syntax=docker/dockerfile:1
# --- Stage 1: byg simc (SimulationCraft Forever) på en fastlåst commit ---
FROM alpine:3.20 AS build
ARG SIMC_REF=3c1d319e707f0e9a52b603b41fb7b8e230db97ac
ARG JOBS=4
RUN apk --no-cache add g++ make curl-dev git
WORKDIR /src
RUN git clone --filter=blob:none https://github.com/simulationcraft/simc-forever.git . \
 && git checkout "$SIMC_REF"
RUN make -C engine release -j"$JOBS" OPTS="-O2" && strip engine/simc
RUN test -x /src/engine/simc

# --- Stage 2: runtime ---
FROM node:22-alpine
RUN apk --no-cache add libcurl libgcc libstdc++ \
 && adduser -D -u 10001 worker
COPY --from=build /src/engine/simc /opt/simc/simc
COPY server.mjs sanitize.mjs /app/
ENV NODE_ENV=production
USER 10001
WORKDIR /app
EXPOSE 8080
CMD ["node","/app/server.mjs"]
