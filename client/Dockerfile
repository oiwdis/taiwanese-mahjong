# Self-contained: this folder is what Railway's @mahjong/client service has.
FROM node:22-slim
WORKDIR /app
COPY server.bundle.mjs server.js run-server.mjs vite-wrapper.mjs ./
COPY dist ./dist
RUN mkdir -p node_modules/.bin node_modules/vite/bin \
  && cp vite-wrapper.mjs node_modules/.bin/vite \
  && cp vite-wrapper.mjs node_modules/vite/bin/vite.js \
  && chmod +x node_modules/.bin/vite node_modules/vite/bin/vite.js
ENV NODE_ENV=production
ENV PATH="/app/node_modules/.bin:${PATH}"
EXPOSE 3000
CMD ["node", "server.bundle.mjs"]
