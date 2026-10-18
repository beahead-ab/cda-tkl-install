# Webbdriften för en annan station än Charlottendal (till exempel Träkvista i Tk-TKL) på Render. deploy/publish-station.sh
# lägger filen som Dockerfile.render i stationens förråd, bredvid render.yaml. Charlottendals webbdrift byggs med
# Dockerfile.render i cda-tkl, som flyttade den befintliga installationen.
FROM node:22-bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends gosu ca-certificates && rm -rf /var/lib/apt/lists/*
# En ny installation: ägaren skapas ur TKL_OWNER_EMAIL och TKL_OWNER_PASSWORD första gången (deploy/render/start.mjs).
ENV NODE_ENV=production TKL_RENDER_NEW=1
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts
COPY src ./src
COPY public ./public
COPY scripts ./scripts
COPY packaging ./packaging
COPY stations ./stations
COPY deploy/render ./deploy/render
EXPOSE 10000
ENTRYPOINT ["/bin/sh", "/app/deploy/render/entrypoint.sh"]
