# Image base used to install and build the code
FROM node:20.15.0 AS build

# Set our node environment, either development or production
ARG NODE_ENV=development
ENV NODE_ENV $NODE_ENV

# Define npm token to install private dependencies
ARG NPM_TOKEN

# Install global dependencies
RUN npm install -g typescript @nestjs/cli

# Install dependencies first, in a different location for easier app bind mounting for local development
RUN mkdir /opt/node_app && chown node:node /opt/node_app
WORKDIR /opt/node_app

# Use an unprivileged user as a security best practice
USER node

# Copy dependencies and configurations
COPY --chown=node:node package*.json ./

# Install dependencies
RUN npm ci
ENV PATH /opt/node_app/node_modules/.bin:$PATH

# Copy source code
WORKDIR /opt/node_app/app
COPY --chown=node:node . .

# Build source code
RUN npm run build

#
# Build image used in production
#
FROM node:20.15.0-slim AS prod
LABEL org.opencontainers.image.source https://github.com/tango-crypto/cardano-api

# Define production mode
ENV NODE_ENV production
# Use an unprivileged user as a security best practice
USER node

# Prepare the workspace for the app
WORKDIR /usr/src/app

# Copy node modules and the app compiled from the previous stage
COPY --from=build --chown=node:node /opt/node_app/node_modules ./node_modules
COPY --from=build --chown=node:node /opt/node_app/app/dist ./dist
ENV PATH /opt/node_app/node_modules/.bin:$PATH

# Start node process
CMD ["node", "dist/main"]
