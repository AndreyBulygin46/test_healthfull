import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { listPredictions } from "@/lib/prediction-service";
import { formatTimeDifference, getScoreTierName } from "@/lib/scoring";

export default async function ProfilePage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/profile");
  }

  const predictions = await listPredictions({ userId: session.user.id });
  const scoredPredictions = predictions.filter((prediction) => prediction.score);
  const totalPoints = scoredPredictions.reduce(
    (sum, prediction) => sum + (prediction.score?.points ?? 0),
    0
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      <div className="container mx-auto px-4 py-10 space-y-8">
        <div>
          <Link href="/" className="text-cyan-400 hover:text-cyan-300">
            ← На главную
          </Link>
          <h1 className="text-3xl font-bold mt-2">Профиль</h1>
        </div>

        <section className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h2 className="text-xl font-semibold mb-4">Аккаунт</h2>
          <p className="text-slate-200">
            Имя: {session.user.name || "Не указано"}
          </p>
          <p className="text-slate-400">Email: {session.user.email}</p>
          <p className="mt-4">
            Роль:{" "}
            <span className="text-cyan-300 font-semibold">
              {session.user.role ?? "USER"}
            </span>
          </p>
        </section>

        <section className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h2 className="text-xl font-semibold mb-4">Статистика</h2>
          <p className="text-slate-200 text-2xl">
            Общее количество очков:{" "}
            <span className="text-cyan-300">{totalPoints}</span>
          </p>
          <p className="text-slate-400 mt-2">
            Предсказаний создано: {predictions.length}
          </p>
        </section>

        <section className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h2 className="text-xl font-semibold mb-4">История ваших предсказаний</h2>
          {predictions.length === 0 ? (
            <p className="text-slate-400">
              У вас пока нет прогнозов. Перейдите в{" "}
              <Link href="/matches" className="text-cyan-400 hover:text-cyan-300">
                матчи
              </Link>{" "}
              и сделайте первый.
            </p>
          ) : (
            <div className="space-y-3">
              {predictions.map((prediction) => (
                <div
                  key={prediction.id}
                  className="flex justify-between border-b border-slate-700 pb-3"
                >
                  <div>
                    <p className="text-white">{prediction.match.title}</p>
                    <p className="text-slate-400 text-sm">
                      {new Date(prediction.predictedAt).toLocaleString("ru-RU")}
                      {prediction.targetEvent ? ` · Цель: ${prediction.targetEvent}` : ""}
                    </p>
                  </div>
                  {prediction.score ? (
                    <div className="text-right">
                      <p className="font-semibold text-cyan-300">
                        +{prediction.score.points}
                      </p>
                      <p className="text-xs text-slate-400">
                        {getScoreTierName(prediction.score.points)} ·{" "}
                        {formatTimeDifference(prediction.score.accuracyMs)}
                      </p>
                    </div>
                  ) : (
                    <span className="text-slate-500">Ожидает результата</span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
