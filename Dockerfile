FROM node:14.19.0-alpine as build

ARG BUILD_ENV
ENV NODE_ENV development
EXPOSE 80
WORKDIR /app

# Install dependencies
RUN apk add git bash
ADD ./package*.json ./
COPY . /app

RUN npm install

## Build
ADD ./ ./
RUN npm run build

FROM build as dev

ADD ./config/*.json ./dist/config/
WORKDIR /app/dist
CMD ["sh", "-c", "node src/index.js"]