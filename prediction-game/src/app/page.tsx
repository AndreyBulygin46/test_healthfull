import { auth } from "@/lib/auth";
import Link from "next/link";
import { MatchStatus } from "@prisma/client";
import { getMatchList } from "@/lib/prediction-service";

export default async function Home() {
  const session = await auth();
  const liveMatches = await getMatchList({ status: MatchStatus.LIVE, take: 3 });

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      <div className="container mx-auto px-4 py-16">
        {/* Header */}
        <header className="flex justify-between items-center mb-16">
          <h1 className="text-3xl font-bold text-cyan-400">
            🎯 LivePredict
          </h1>
          <div className="flex gap-4">
            {session ? (
              <>
                <span className="text-slate-300">Привет, {session.user?.name || session.user?.email}</span>
                <Link
                  href="/profile"
                  className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg transition"
                >
                  Профиль
                </Link>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="text-slate-300 hover:text-white px-4 py-2 transition"
                >
                  Войти
                </Link>
                <Link
                  href="/register"
                  className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg transition"
                >
                  Регистрация
                </Link>
              </>
            )}
          </div>
        </header>

        {/* Hero */}
        <div className="text-center mb-16">
          <h2 className="text-5xl font-bold mb-6">
            Угадывай события в <span className="text-cyan-400">реальном времени</span>
          </h2>
          <p className="text-xl text-slate-400 mb-8 max-w-2xl mx-auto">
            Смотри трансляции киберспорта и спорта, нажимай кнопку в момент события и получай очки за точность!
          </p>
          <div className="flex gap-4 justify-center">
            <Link
              href="/matches"
              className="bg-cyan-600 hover:bg-cyan-700 text-white text-lg px-8 py-4 rounded-xl transition font-semibold"
            >
              Смотреть матчи
            </Link>
            <Link
              href="/leaderboard"
              className="bg-slate-700 hover:bg-slate-600 text-white text-lg px-8 py-4 rounded-xl transition font-semibold"
            >
              Турнирная таблица
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700">
            <div className="text-4xl mb-4">🎮⚽</div>
            <h3 className="text-xl font-bold mb-2">CS2, Футбол, Dota 2</h3>
            <p className="text-slate-400">
              Угадывай фраги, голы, раунды и ключевые моменты в популярных дисциплинах
            </p>
          </div>
          <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700">
            <div className="text-4xl mb-4">⚡</div>
            <h3 className="text-xl font-bold mb-2">Real-time предсказания</h3>
            <p className="text-slate-400">
              Нажимай кнопку в нужный момент и соревнуйся за точность
            </p>
          </div>
          <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700">
            <div className="text-4xl mb-4">🏆</div>
            <h3 className="text-xl font-bold mb-2">Турнирные таблицы</h3>
            <p className="text-slate-400">
              Соревнуйся с друзьями и игроками со всего мира
            </p>
          </div>
        </div>

        {/* Active Matches Preview */}
        <div className="bg-slate-800 rounded-2xl p-8 border border-slate-700">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-2xl font-bold">Активные матчи</h3>
            <Link
              href="/matches"
              className="text-cyan-400 hover:text-cyan-300 transition"
            >
              Все матчи →
            </Link>
          </div>
          {liveMatches.length === 0 ? (
            <div className="text-slate-400 text-center py-8">
              Нет активных матчей. Зайдите позже.
            </div>
          ) : (
            <ul className="space-y-3">
              {liveMatches.map((match) => (
                <li
                  key={match.id}
                  className="flex justify-between items-center border-b border-slate-700 pb-3"
                >
                  <span>
                    {match.title} — {match.sportType}
                  </span>
                  <Link
                    href={`/matches/${match.id}`}
                    className="text-cyan-400 hover:text-cyan-300"
                  >
                    Сыграть
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
