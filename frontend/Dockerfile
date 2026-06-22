# Frontend image: build the Vite app, then serve the static bundle with nginx.
# nginx also reverse-proxies /api -> the backend service (see nginx.conf).

# ---- build stage ----
FROM node:22-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
# Talk to the backend through nginx at the same origin under /api.
ENV VITE_API_BASE_URL=/api
RUN npm run build

# ---- serve stage ----
FROM nginx:alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
