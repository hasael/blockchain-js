FROM arm64v8/node:lts-alpine
#ENV NODE_ENV=production
#COPY . /usr
#WORKDIR /usr/src
#COPY ["./src/package.json", "./src/package-lock.json*", "./src/npm-shrinkwrap.json*", "./"]
#RUN npm install --production --silent && mv node_modules ../
#EXPOSE 8083
#EXPOSE 30083
#RUN chown -R node /usr/src
##USER node
#CMD ["npm", "start"]
CMD ["/bin/sh", "-c", "--" , "while true; do sleep 300; done;"]