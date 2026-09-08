# Wellbeing Transition Simulator - production image
#
# Stage 1 builds the Vite bundle; stage 2 serves it with nginx.
# The Gemini key is baked into the client bundle at build time (the app calls
# Gemini from the browser), so restrict the key by HTTP referrer in Google
# AI Studio. Pass it with: docker build --build-arg GEMINI_API_KEY=... .
# Without it the simulator still runs; only the Analysis tab is disabled.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
ARG GEMINI_API_KEY=""
ENV GEMINI_API_KEY=${GEMINI_API_KEY}
RUN npm run build

FROM nginx:1.27-alpine
# nginx's entrypoint renders *.template with envsubst, so PORT (set by Cloud Run) is honored.
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
ENV PORT=8080
EXPOSE 8080
