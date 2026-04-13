## LivePredict MVP (working baseline)

Минимальный рабочий минимум платформы для предсказаний времени/событий на матчах:

- регистрация и вход
- API каркас матчей и предсказаний
- страница списка матчей
- страница конкретного матча с кнопкой `СЕЙЧАС`
- расчёт очков по скользящей схеме
- лидерборд по набранным очкам
- профиль пользователя

### Текущий статус

Реализована версия MVP с real-time обновлениями, админ-операциями для матчей и каркасом интеграции внешних источников.
Текущий релиз работает в режиме **mock-first**: в runtime не выполняются outbound-запросы к внешним API, все матчи создаются вручную или через mock-feed.

### Режим работы без внешних API

- `/api/admin/integrations` синхронизирует только mock-данные и может использоваться в dry-run для предпросмотра.
- Для демонстрации можно запустить `npm run seed` и работать через `/admin` без внешних интеграций.

### Особенности прогноза

- `INSTANT` — пользователь делает прогноз «сразу», после появления следующего подходящего события для матча начисляются очки.
- `INTERVAL` — пользователь выбирает целевое событие (`targetEvent`) и окно в секундах (`intervalSeconds`, 1..120). Очки начисляются только если событие происходит в пределах окна после времени прогноза.

### Smoke-тест MVP

1. Запустить приложение:

```bash
cd prediction-game
npm install
npx prisma migrate dev
npm run seed
npm run dev
```

2. Войти как `admin@example.com / admin123456`, создать матчи/события (или нажать sync в админке).
3. Открыть матч в `/matches`, сделать прогноз от имени пользователя `player@example.com / player123456`.
4. Через админку добавить событие и убедиться, что в `/matches/[id]` и `/leaderboard` обновились очки.
5. Проверить fallback: при отключенном socket UI продолжает получать данные через polling.

### Для следующих итераций:

- полноценные интеграторы внешних API (PandaScore / API для футбола)
- расширенная аналитика и персонализация

## Быстрый старт

```bash
cd prediction-game
npm install
npm run dev
```

Перед запуском задайте переменные окружения (файл `prediction-game/.env.local`):

```env
DATABASE_URL="file:./prisma/dev.db"
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="your-secret"
```

Для первичного запуска базы:

```bash
npx prisma migrate dev
```

Откройте `http://localhost:3000`.

## API endpoints

Подробный список endpoint-ов для mock-MVP находится в [`docs/api.md`](docs/api.md).

### Матчи

- `GET /api/matches` — список матчей. Поддерживает `status`, `sportType`, `take`.
- `POST /api/matches` — создание матча (только ADMIN).
- `GET /api/matches/[id]` — детали матча, события и последние предсказания.
- `PATCH /api/matches/[id]` — обновление статуса и параметров матча (только ADMIN).
- `DELETE /api/matches/[id]` — удаление матча (только ADMIN).
- `GET /api/matches/[id]/events` — события матча с пагинацией `take`.

### Предсказания

- `POST /api/predictions` — создание прогноза авторизованным пользователем.
- `GET /api/predictions` — история прогнозов текущего пользователя.
- `GET /api/matches/[id]/predictions?scope=all|mine&limit=n` — список прогнозов по матчу: `all` для публичного фида, `mine` для текущего пользователя.

### События

- `POST /api/events` — создание события матча и авторасчёт очков для открытых прогнозов (только ADMIN).
- `GET /api/realtime/status` — статус WebSocket и лимиты API.

### Рейтинги

- `GET /api/leaderboard` — глобальный лидерборд.
- `GET /api/leaderboard?matchId=...` — рейтинг по конкретному матчу.

### Админ-интерфейс и интеграции

- `GET /api/admin/users` — список пользователей (только ADMIN).
- `PATCH /api/admin/users` — изменение роли пользователя (только ADMIN).
- `POST /api/admin/integrations` — запуск синхронизации внешних фидов, включая dry-run режим.

## Основные страницы

- `/matches` — список матчей.
- `/matches/[id]` — экран матча и кнопка `СЕЙЧАС`.
- `/leaderboard` — турнирная таблица.
- `/profile` — профиль и история своих прогнозов.
- `/admin` — простая админка (создание матчей и событий).

## Логика расчёта очков

`calculateScore(predictionTime, eventTime)`:

- 0–2 сек: 100 очков
- 2–5 сек: 80 очков
- 5–10 сек: 50 очков
- 10–20 сек: 20 очков
- более 20 сек: 0 очков

`validatePrediction` накладывает:

- матч должен быть `LIVE`,
- cooldown 5 секунд между предсказаниями одного пользователя для матча,
- лимит количества прогнозов.

## Seed-данные

Локальные демо-данные добавляются командой:

```bash
cd prediction-game
npm run seed
```

Скрипт создаёт:

- `admin@example.com` / `admin123456` (роль `ADMIN`)
- `player@example.com` / `player123456` (роль `USER`)
- 2 демонстрационных матча и базовые события

## Тесты

```bash
cd prediction-game
npm run test:unit
npm run test:integration
npm run test:smoke
```

`test:integration` запускается в изолированной SQLite базе `file:./prisma/test.db` и перед запуском автоматически делает `prisma db push`.
`test:smoke` проверяет end-to-end MVP цепочку (login credentials -> match -> prediction -> admin event -> leaderboard) на уровне интеграционного сценария.
