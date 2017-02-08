FROM node:boron

# Create app directory
RUN mkdir -p /usr/src/app
WORKDIR /usr/src/app

# Install app dependencies
COPY app.js /usr/src/app/
COPY helpers.js /usr/src/app/
COPY package.json /usr/src/app/

RUN npm install

# Bundle app source
COPY . /usr/src/app

EXPOSE 8082
#CMD [ "npm", "start" ]
CMD node /usr/src/app/app.js
