# --- Build Stage ---
FROM node:20-alpine AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy configuration and source files
COPY vite.config.js postcss.config.js tailwind.config.js eslint.config.js ./
COPY index.html ./
COPY public ./public
COPY src ./src

# Set build argument for backend API URL. 
# Defaults to empty string so requests are relative (e.g. /api/...) and handled by Nginx proxy
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

# Compile the React application
RUN npm run build

# --- Runtime Stage ---
FROM nginx:1.25-alpine

# Copy built files from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Expose HTTP port 80
EXPOSE 80

# Start Nginx
CMD ["nginx", "-g", "daemon off;"]
