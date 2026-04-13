# LivePredict - Игра на предсказание событий

Веб-платформа для интерактивных предсказаний событий во время live-трансляций киберспорта и спорта.

## 🎮 Особенности

- **Real-time предсказания**: Нажимайте кнопку в момент события
- **Множество дисциплин**: CS2, Dota 2, Valorant, футбол  
- **Турнирные таблицы**: Соревнуйтесь с другими игроками
- **Live трансляции**: Встроенные видео-плееры
- **Админ-панель**: Управление матчами и событиями

## 🚀 Технологии

- **Next.js 14** + **TypeScript**
- **Prisma** + **SQLite**
- **NextAuth.js** - Аутентификация
- **Socket.io** - Real-time коммуникация
- **Tailwind CSS** - Стилизация
- **PandaScore API** - Киберспортивные данные

## ⚡ Быстрый старт

```bash
# Установка зависимостей
cd prediction-game
npm install

# Настройка переменных окружения
cp .env.example .env.local

# Инициализация базы данных  
npx prisma migrate dev
npx prisma generate

# Запуск
npm run dev
```

Откройте http://localhost:3000

## 🔐 Тестовые данные

- **Админ**: `admin@example.com` / пароль: `admin123`
- **Демо-матч**: CS2 - "NAVI vs FaZe" (создается автоматически)

## 📖 Документация

- [Инструкция по тестированию](./TESTING.md)
- [API Documentation](./docs/api.md)

## 🎯 Основной функционал

### Для пользователей

1. **Регистрация/Вход** - Email и пароль
2. **Просмотр матчей** - Список активных трансляций
3. **Игровой процесс** - Кнопка "ПРЕДСКАЗАТЬ СЕЙЧАС!" с cooldown 5 сек
4. **Система очков**:
   - ±0-2 сек: 100 очков
   - ±2-5 сек: 80 очков
   - ±5-10 сек: 50 очков
   - ±10-20 сек: 20 очков
5. **Лидерборд** - Глобальный и по матчам

### Для администраторов

- Создание/редактирование матчей
- Ручное добавление событий
- Загрузка матчей из PandaScore API
- Управление пользователями

## 📊 Структура базы данных

### Таблицы

- **User** - Пользователи (id, email, name, role)
- **Match** - Матчи (id, title, sportType, status, streamUrl)
- **Event** - События матча (id, matchId, type, timestamp)
- **Prediction** - Предсказания (id, userId, matchId, predictedAt)
- **Score** - Очки (id, predictionId, points, accuracyMs)
- **LeaderboardEntry** - Записи лидерборда

## 🔌 API Endpoints

### Аутентификация
- `POST /api/auth/signin` - Вход
- `POST /api/auth/signout` - Выход

### Матчи
- `GET /api/matches` - Список
- `GET /api/matches/:id` - Детали
- `POST /api/matches` - Создать (admin)

### Предсказания
- `POST /api/predictions` - Создать
- `GET /api/predictions` - История

### Лидерборд
- `GET /api/leaderboard` - Глобальный
- `GET /api/leaderboard/:matchId` - По матчу

### WebSocket Events

**Клиент -> Сервер:**
- `match:join` - Присоединиться к матчу
- `prediction:make` - Сделать предсказание

**Сервер -> Клиент:**
- `event:occurred` - Новое событие
- `prediction:result` - Результат предсказания
- `leaderboard:update` - Обновление таблицы

## 🏗️ Структура проекта

```
src/
├── app/                  # Next.js App Router
│   ├── (auth)/          # Аутентификация
│   ├── matches/         # Матчи
│   ├── leaderboard/     # Турнирная таблица
│   ├── profile/         # Профиль
│   ├── admin/           # Админ-панель
│   └── api/             # API routes
├── components/          # React компоненты
├── lib/                # Утилиты
│   ├── auth.ts         # NextAuth config
│   ├── prisma.ts       # Prisma client
│   └── socket.ts       # Socket.io
└── server/             # Серверный код
    └── socket/         # Socket handlers
```

## 🧪 Тестирование

См. [TESTING.md](./TESTING.md) для подробной инструкции.

Быстрый тест:
1. Зарегистрируйтесь на `/register`
2. Войдите на `/login`
3. Перейдите к матчу на `/matches`
4. Нажмите "ПРЕДСКАЗАТЬ СЕЙЧАС!"
5. Проверьте лидерборд на `/leaderboard`

## 🚀 Деплой

### Vercel (рекомендуется)

1. Подключите GitHub репозиторий
2. Настройте переменные окружения в dashboard
3. Деплой автоматический при push в main

### Переменные окружения для Production

```env
DATABASE_URL="postgresql://..."
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="secure-random-string"
PANDASCORE_API_KEY="your-api-key"
REDIS_URL="redis://..."
```

## 📄 Лицензия

MIT License

## 🤝 Вклад в проект

1. Fork репозитория
2. Создайте feature branch: `git checkout -b feature/amazing-feature`
3. Commit: `git commit -m 'Add amazing feature'`
4. Push: `git push origin feature/amazing-feature`
5. Откройте Pull Request

## 📞 Контакты

- Email: support@livepredict.example
- GitHub Issues: [Создать issue](https://github.com/yourusername/prediction-game/issues)
