FROM node:6.9.4
WORKDIR /usr/src/app
COPY package.json .
RUN npm install
COPY util.js .
COPY command.js .
COPY config.js .
COPY listener.js .
COPY replicator.js .
COPY server.js .
COPY test/ ./test/
EXPOSE 80
CMD ["npm", "start"]
