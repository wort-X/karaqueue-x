#Dockerfile

# Use this image as the platform to build the app
FROM node:lts-alpine AS external-website

# A small line inside the image to show who made it
LABEL Developers="Tim Fritzen"

# The WORKDIR instruction sets the working directory for everything that will happen next
WORKDIR /app

# Copy all local files into the image
COPY . .

# Clean install all node modules
RUN yarn install --locked

# Build SvelteKit app
RUN yarn build


FROM node:lts-slim AS runner

WORKDIR /build

COPY --from=external-website /app/build .

# The USER instruction sets the user name to use as the default user for the remainder of the current stage
USER node:node

# This is the command that will be run inside the image when you tell Docker to start the container
CMD ["node","index.js"]
