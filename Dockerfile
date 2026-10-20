# ЭТАП 1: Сборка продакшен-бандла (Node.js)
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Собираем оптимизированный продакшен-бандл (Rollup сожмет все файлы в 1-2 штуки)
RUN npm run build

# ЭТАП 2: Раздача готовой статики через Nginx
FROM nginx:alpine

# Копируем конфиг веб-сервера
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Копируем скомпилированные файлы из первого этапа
COPY --from=builder /app/build /usr/share/nginx/html

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]