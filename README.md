# test_healthfull

Монорепозиторий с веб-приложением **LivePredict** — игра на предсказание исходов спортивных и киберспортивных матчей: регистрация, матчи, прогнозы, таблица лидеров, роли пользователей (в том числе администратор), обновления в реальном времени через Socket.io.

Исходный код приложения лежит в каталоге [`prediction-game/`](prediction-game/).

## Стек

- **Next.js** 16 (App Router), **React** 19, **TypeScript**
- **Prisma** 7 + **SQLite** (`better-sqlite3`)
- **NextAuth.js** (вход по email и паролю)
- **Socket.io** (сервер и клиент)
- **Tailwind CSS** 4, **Zod**, **TanStack Query**

## Требования

- **Node.js** 20+ (рекомендуется LTS)
- **npm** (идёт с Node)

## Быстрый старт

1. Перейти в каталог приложения и установить зависимости:

   ```bash
   cd prediction-game
   npm install
   ```

2. Задать URL базы (рекомендуется, чтобы CLI Prisma и Next.js использовали один и тот же файл SQLite):

   ```bash
   export DATABASE_URL="file:./prisma/dev.db"
   ```

   В **Windows (cmd)** можно один раз перед командами: `set DATABASE_URL=file:./prisma/dev.db`. Удобнее положить в `prediction-game/.env` строку `DATABASE_URL="file:./prisma/dev.db"`.

3. Применить миграции (SQLite-файл создаётся автоматически):

   ```bash
   npx prisma migrate deploy
   ```

   Для разработки с изменением схемы удобнее `npx prisma migrate dev`.

4. (Необязательно) Заполнить БД тестовыми пользователями и матчами:

   ```bash
   npm run seed
   ```

5. Запустить dev-сервер:

   ```bash
   npm run dev
   ```

   По умолчанию используется **Webpack** (`next dev --webpack`), чтобы на Windows не упираться в лимит виртуальной памяти из‑за **Turbopack** (ошибки вроде `Failed to reserve virtual memory for CodeRange`, множественные `Fatal process out of memory`). Если на машине достаточно ресурсов, можно попробовать Turbopack: `npm run dev:turbo`.

6. Открыть в браузере: [http://localhost:3000](http://localhost:3000).

## Переменные окружения

Можно создать файл `.env` в `prediction-game/` (в репозитории примера нет — значения ниже типичны для локальной разработки):

| Переменная        | Назначение |
|-------------------|------------|
| `DATABASE_URL`    | URL SQLite, по умолчанию `file:./prisma/dev.db` |
| `NEXTAUTH_SECRET` | Секрет для подписи JWT сессий; для продакшена обязателен |
| `NEXTAUTH_URL`    | Базовый URL приложения, например `http://localhost:3000` |

В рантайме Next.js при отсутствии `DATABASE_URL` подставляется `file:./prisma/dev.db` (см. `src/lib/prisma.ts`). Команды Prisma без переменной могут обращаться к другому пути — поэтому для миграций и сидов лучше явно задать `DATABASE_URL`, как в таблице выше.

## Учётные записи после `npm run seed`

- Администратор: `admin@example.com` / `admin123456`
- Игрок: `player@example.com` / `player123456`

Скрипт `npm run seed` загружает `.env`, поэтому пользователи создаются в **той же** SQLite-базе, что и Next.js (`DATABASE_URL`). Если пароль «не подходит» после сида, выполните `npm run seed` ещё раз уже с исправленным скриптом или проверьте, что в `.env` указан нужный файл БД.

## Полезные команды

Выполняются из `prediction-game/`:

| Команда | Описание |
|---------|----------|
| `npm run dev` | Режим разработки (Webpack) |
| `npm run dev:turbo` | Режим разработки с Turbopack (быстрее, но тяжелее по памяти) |
| `npm run build` | Сборка для продакшена |
| `npm run start` | Запуск production-сборки |
| `npm run lint` | ESLint |
| `npm test` | Jest (все тесты) |
| `npm run test:unit` | Юнит-тесты |
| `npm run test:integration` | Интеграционные тесты |
| `npm run test:e2e` | E2E (Playwright; см. `e2e:prepare` в `package.json`) |

## Ошибка P3005 при `prisma migrate deploy`

Сообщение *«The database schema is not empty»* значит: в `prisma/dev.db` уже есть таблицы, а нужная миграция ещё не записана в `_prisma_migrations` (часто после `prisma db push` или старой БД).

**Локально, если данные не жалко:** удалить файл БД и применить миграции снова:

```bash
rm -f prisma/dev.db prisma/dev.db-journal
export DATABASE_URL="file:./prisma/dev.db"
npx prisma migrate deploy
npm run seed   # по желанию заново заполнить тестовыми данными
```

Перед удалением при необходимости сделайте копию `prisma/dev.db`.

## Структура репозитория

```
test_healthfull/
├── prediction-game/   # Next.js-приложение LivePredict
└── Docs/              # заметки и планы
```
