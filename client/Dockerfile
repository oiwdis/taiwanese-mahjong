# Railway's @mahjong/client service uses this folder as the build context.
# Whatever start command the dashboard still has (npm start, vite preview,
# npx vite) must end up running the bundled game server on $PORT.
FROM node:22-slim
WORKDIR /app

COPY package.json ./
COPY server.bundle.mjs server.js run-server.mjs vite-wrapper.mjs ./
COPY dist ./dist

RUN mkdir -p node_modules/vite/bin \
  && printf '%s\n' '{"name":"vite","version":"6.0.0","type":"module","bin":{"vite":"bin/vite.js"}}' > node_modules/vite/package.json \
  && cp vite-wrapper.mjs node_modules/vite/bin/vite.js \
  && printf '%s\n' \
    '#!/bin/sh' \
    'for a in "$@"; do' \
    '  case "$a" in start|preview) exec node /app/server.bundle.mjs ;; esac' \
    'done' \
    'if [ -x /usr/local/bin/npm.real ]; then exec /usr/local/bin/npm.real "$@"; fi' \
    'exit 0' \
    > /usr/local/bin/npm \
  && printf '%s\n' '#!/bin/sh' 'exec node /app/server.bundle.mjs' > /usr/local/bin/npx \
  && printf '%s\n' '#!/bin/sh' 'exec node /app/server.bundle.mjs' > /usr/local/bin/vite \
  && chmod +x /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/vite node_modules/vite/bin/vite.js

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "server.bundle.mjs"]
