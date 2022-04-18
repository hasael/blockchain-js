FROM arm64v8/node:lts-alpine
ENV NODE_ENV=production
WORKDIR /usr/src/app
COPY ["./src/package.json", "./src/package-lock.json*", "./src/npm-shrinkwrap.json*", "./"]
RUN npm install --production --silent && mv node_modules ../
COPY . .
EXPOSE 8083
EXPOSE 30083
RUN chown -R node /usr/src/app
USER node
CMD ["npm", "start"]
