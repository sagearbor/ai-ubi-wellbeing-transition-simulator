# Wellbeing Transition Simulator - production image
#
# Stage 1 builds the Vite bundle; stage 2 serves it with nginx.
# The Gemini key is baked into the client bundle at build time (the app calls
# Gemini from the browser), so restrict the key by HTTP referrer in Google
# AI Studio. Vite reads it from .env.local in the build context, or pass
# --build-arg GEMINI_API_KEY=... for local docker builds. Without a key the
# simulator still runs; only the Analysis tab is disabled.

FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
# A build-arg is visible to RUN as an environment variable even when it is empty, and Vite's
# loadEnv lets ANY process.env value (including "") override .env.local. So when no build-arg
# is given, unset it before building so the key in .env.local is used. Every Cloud Build
# before this fix shipped a bundle with no Gemini key for exactly this reason.
ARG GEMINI_API_KEY=""
RUN if [ -z "$GEMINI_API_KEY" ]; then unset GEMINI_API_KEY; fi; npm run build

FROM nginx:1.27-alpine
# nginx's entrypoint renders *.template with envsubst, so PORT (set by Cloud Run) is honored.
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template
COPY --from=build /app/dist /usr/share/nginx/html
ENV PORT=8080
EXPOSE 8080
