import Link from "next/link";
import { MatchStatus, SportType } from "@prisma/client";
import { getMatchList } from "@/lib/prediction-service";
import { auth } from "@/lib/auth";

function MatchCard({
  id,
  title,
  status,
  sportType,
  startTime,
  predictionsCount,
}: {
  id: string;
  title: string;
  status: string;
  sportType: string;
  startTime: Date;
  predictionsCount: number;
}) {
  return (
    <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-white">{title}</h2>
        <p className="text-slate-400 text-sm">
          {sportType} · {status}
        </p>
      </div>
      <p className="text-slate-300 text-sm mb-4">
        Старт: {new Date(startTime).toLocaleString("ru-RU")}
      </p>
      <p className="text-slate-400 text-sm mb-6">
        Прогнозов: {predictionsCount}
      </p>
      <Link
        href={`/matches/${id}`}
        className="inline-flex bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg transition"
      >
        Перейти к матчу
      </Link>
    </div>
  );
}

// Sport type display names
const sportTypeLabels: Record<SportType | "ALL", string> = {
  ALL: "Все дисциплины",
  CS2: "CS2",
  FOOTBALL: "Футбол",
  DOTA2: "Dota 2",
  VALORANT: "Valorant",
};

interface MatchesPageProps {
  searchParams?: { sport?: string };
}

export default async function MatchesPage({ searchParams }: MatchesPageProps) {
  const session = await auth();
  const selectedSport = searchParams?.sport as SportType | "ALL" | undefined;
  
  // Filter by sport type if selected
  const sportFilter = selectedSport && selectedSport !== "ALL" 
    ? selectedSport 
    : undefined;

  const [liveMatches, upcomingMatches] = await Promise.all([
    getMatchList({ status: MatchStatus.LIVE, sportType: sportFilter, take: 20 }),
    getMatchList({ status: MatchStatus.UPCOMING, sportType: sportFilter, take: 20 }),
  ]);

  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      <div className="container mx-auto px-4 py-10 space-y-8">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-cyan-400">Матчи</h1>
          <div className="space-x-4">
            <Link href="/" className="text-slate-300 hover:text-white">
              На главную
            </Link>
            {isAdmin ? (
              <Link href="/admin" className="text-cyan-400 hover:text-cyan-300">
                Админка
              </Link>
            ) : null}
          </div>
        </div>

        {/* Sport Type Filter */}
        <section className="bg-slate-800 rounded-xl border border-slate-700 p-4">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-slate-400 text-sm mr-2">Фильтр:</span>
            <Link
              href="/matches"
              className={`px-4 py-2 rounded-lg transition ${
                !selectedSport || selectedSport === "ALL"
                  ? "bg-cyan-600 text-white"
                  : "bg-slate-700 text-slate-300 hover:bg-slate-600"
              }`}
            >
              {sportTypeLabels.ALL}
            </Link>
            {Object.values(SportType).map((sport) => (
              <Link
                key={sport}
                href={`/matches?sport=${sport}`}
                className={`px-4 py-2 rounded-lg transition ${
                  selectedSport === sport
                    ? "bg-cyan-600 text-white"
                    : "bg-slate-700 text-slate-300 hover:bg-slate-600"
                }`}
              >
                {sportTypeLabels[sport]}
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Сейчас в эфире</h2>
          {liveMatches.length === 0 ? (
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 text-slate-400">
              Нет активных матчей
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {liveMatches.map((match) => (
                <MatchCard
                  key={match.id}
                  id={match.id}
                  title={match.title}
                  status={match.status}
                  sportType={match.sportType}
                  startTime={match.startTime}
                  predictionsCount={match._count?.predictions ?? 0}
                />
              ))}
            </div>
          )}
        </section>

        <section>
          <h2 className="text-xl font-semibold mb-4">Скоро начнутся</h2>
          {upcomingMatches.length === 0 ? (
            <div className="bg-slate-800 rounded-xl border border-slate-700 p-6 text-slate-400">
              Нет матчей в ожидании
            </div>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
              {upcomingMatches.map((match) => (
                <MatchCard
                  key={match.id}
                  id={match.id}
                  title={match.title}
                  status={match.status}
                  sportType={match.sportType}
                  startTime={match.startTime}
                  predictionsCount={match._count?.predictions ?? 0}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
