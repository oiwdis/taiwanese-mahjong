# Single service: build the React client, then serve it from the Node game server.
FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
COPY shared/package.json shared/
COPY server/package.json server/
COPY client/package.json client/

# Only package.json files exist in this layer. Ignore lifecycle scripts so a
# client postinstall cannot fail before COPY . . brings the rest of the tree.
RUN npm ci --ignore-scripts

COPY . .
RUN npm run build

ENV NODE_ENV=production
EXPOSE 3000

CMD ["npm", "start"]
