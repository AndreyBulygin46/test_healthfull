# test_healthfull

Репозиторий с веб-приложением **LivePredict** — платформа для прогнозов событий во время live-трансляций (киберспорт и спорт).

Основной код приложения находится в каталоге [`prediction-game/`](prediction-game/).

## LivePredict в двух словах

- Регистрация и вход (NextAuth, credentials + JWT-сессии).
- Список матчей с фильтром по дисциплине, карточка матча с режимами прогноза `INSTANT` / `INTERVAL` и кнопкой «СЕЙЧАС».
- События матча, расчёт очков по точности времени, лидерборд (общий и с учётом матча).
- Админ-панель на `/admin`: матчи, события, роли пользователей, синхронизация интеграций (в типичной конфигурации — mock-first, без обязательных внешних API).
- Real-time: Socket.io с fallback на polling при недоступности сокета.

## Стек (актуально для `prediction-game`)

| Область | Технологии |
|--------|------------|
| Фреймворк | Next.js (App Router), React, TypeScript |
| Данные | Prisma, SQLite (локально), `better-sqlite3` |
| Auth | NextAuth.js (credentials), `@auth/prisma-adapter` |
| UI | Tailwind CSS |
| Realtime | Socket.io |
| Тесты | Jest (unit + integration), Playwright (E2E) |

Точные версии зависимости смотрите в [`prediction-game/package.json`](prediction-game/package.json).

## Быстрый старт (разработка)

```bash
cd prediction-game
npm install
```

Создайте файл окружения, например `prediction-game/.env.local`, минимум:

```env
DATABASE_URL="file:./prisma/dev.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="замените-на-случайную-строку"
```

Инициализация схемы и демо-данные:

```bash
npx prisma db push
npm run seed
npm run dev
```

Откройте в браузере: [http://localhost:3000](http://localhost:3000).

Учётные записи после `npm run seed` (см. [`prisma/seed.js`](prediction-game/prisma/seed.js)):

| Роль | Email | Пароль |
|------|--------|--------|
| Администратор | `admin@example.com` | `admin123456` |
| Игрок | `player@example.com` | `player123456` |

Сборка production:

```bash
cd prediction-game
npm run build
npm run start
```

## Документация

| Файл | Содержание |
|------|------------|
| [Docs/TESTING.md](Docs/TESTING.md) | Что и как тестировать: команды, E2E, ручные сценарии |
| [prediction-game/README.md](prediction-game/README.md) | Детали MVP, API, страницы, логика очков |

