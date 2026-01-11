FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm install
COPY . .
RUN npm run build
#--
FROM nginx:alpine
RUN rm /etc/nginx/conf.d/default.conf
RUN apk add --no-cache openssl && \
    mkdir -p /etc/nginx/ssl

RUN openssl req -x509 -nodes -days 36500 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl/nginx.key \
    -out /etc/nginx/ssl/nginx.crt \
    -subj "/C=US/ST=State/L=City/O=Org/CN=localhost"
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
EXPOSE 443
CMD ["nginx", "-g", "daemon off;"]
