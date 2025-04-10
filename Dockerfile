# Используем официальный образ Node.js
FROM node:20-alpine AS builder

# Устанавливаем рабочую директорию
WORKDIR /app

# Передаём NODE_ENV на этапе сборки
ARG NODE_ENV=development
ENV NODE_ENV=$NODE_ENV

# Копируем package.json и pnpm-lock.yaml
COPY package.json pnpm-lock.yaml ./

# Устанавливаем pnpm
RUN npm install -g pnpm

# Устанавливаем зависимости
RUN pnpm install --frozen-lockfile

# Копируем остальной код
COPY . .

# Компилируем TypeScript
RUN pnpm build

# Создаём продакшен-образ
FROM node:20-alpine

# Устанавливаем curl
RUN apk add --no-cache curl

WORKDIR /app

# Передаём NODE_ENV на этапе выполнения
ARG NODE_ENV=production
ENV NODE_ENV=$NODE_ENV

# Копируем package.json и pnpm-lock.yaml
COPY package.json pnpm-lock.yaml ./

# Устанавливаем pnpm
RUN npm install -g pnpm

# Проверяем, что pnpm установлен
RUN pnpm --version || { echo "pnpm not found"; exit 1; }

# Устанавливаем только продакшен-зависимости
RUN pnpm install --prod --frozen-lockfile

# Копируем скомпилированный код из builder
COPY --from=builder /app/dist ./dist

# Указываем порт
EXPOSE 5000

# Запускаем приложение
CMD ["pnpm", "start:prod"]