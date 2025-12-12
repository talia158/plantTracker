# Build stage
FROM node:20-alpine AS build
WORKDIR /app

# Build-time API URL for Vite 
ARG VITE_API_BASE_URL
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Copy only the Vite app manifests first 
COPY plantTracker/package*.json ./
RUN npm ci

# Copy the Vite app source
COPY plantTracker/ ./

# Build static site
RUN npm run build

# Run stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]

