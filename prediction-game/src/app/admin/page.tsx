import Link from "next/link";
import { redirect } from "next/navigation";
import { MatchStatus, SportType } from "@prisma/client";
import { auth } from "@/lib/auth";
import { createEventAndScore, createMatch, deleteMatch, getMatchList, updateMatch } from "@/lib/prediction-service";
import { prisma } from "@/lib/prisma";
import { syncActiveSources } from "@/lib/integrations/scheduler";
import { FOOTBALL_EVENT_TYPES } from "@/lib/validation";
import { INTEGRATION_MODE } from "@/lib/integrations/match-feed";

export default async function AdminPage({
  searchParams,
}: {
  searchParams?: { message?: string; error?: string };
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/admin");
  }

  if (session.user.role !== "ADMIN") {
    return (
      <div className="min-h-screen bg-slate-900 text-white">
        <div className="container mx-auto px-4 py-12">
          <h1 className="text-3xl font-bold text-red-400">Доступ запрещён</h1>
          <p className="text-slate-300 mt-4">
            У этой учётной записи нет административных прав.
          </p>
          <Link href="/" className="text-cyan-400 hover:text-cyan-300 mt-6 inline-block">
            На главную
          </Link>
        </div>
      </div>
    );
  }

  const matches = await getMatchList({ take: 50 });
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true },
    orderBy: { createdAt: "desc" },
  });
  const message = searchParams?.message ? decodeURIComponent(searchParams.message) : null;
  const error = searchParams?.error ? decodeURIComponent(searchParams.error) : null;

  const createMatchAction = async (formData: FormData) => {
    "use server";
    try {
      const payload = {
        title: formData.get("title")?.toString(),
        sportType: formData.get("sportType")?.toString(),
        streamUrl: formData.get("streamUrl")?.toString(),
        startTime: formData.get("startTime")?.toString(),
        externalId: formData.get("externalId")?.toString() || undefined,
      };

      await createMatch(payload);
      redirect(`/admin?message=${encodeURIComponent("Матч создан")}`);
    } catch (error) {
      redirect(
        `/admin?error=${encodeURIComponent(
          error instanceof Error ? error.message : "Не удалось создать матч"
        )}`
      );
    }
  };

  const updateMatchAction = async (formData: FormData) => {
    "use server";
    try {
      const matchId = formData.get("matchId")?.toString();
      if (!matchId) {
        throw new Error("Не передан матч");
      }

      const payload: Record<string, unknown> = {};
      const title = formData.get("title")?.toString();
      if (title) payload.title = title;

      const status = formData.get("status")?.toString();
      if (status) payload.status = status;

      const sportType = formData.get("sportType")?.toString();
      if (sportType) payload.sportType = sportType;

      const streamUrl = formData.get("streamUrl")?.toString();
      if (streamUrl) payload.streamUrl = streamUrl;

      const startTime = formData.get("startTime")?.toString();
      if (startTime) payload.startTime = new Date(startTime).toISOString();

      const endTime = formData.get("endTime")?.toString();
      if (endTime) payload.endTime = new Date(endTime).toISOString();

      const externalId = formData.get("externalId")?.toString();
      payload.externalId = externalId || null;

      await updateMatch(matchId, payload);
      redirect(`/admin?message=${encodeURIComponent("Матч обновлен")}`);
    } catch (error) {
      redirect(
        `/admin?error=${encodeURIComponent(
          error instanceof Error ? error.message : "Не удалось обновить матч"
        )}`
      );
    }
  };

  const deleteMatchAction = async (formData: FormData) => {
    "use server";
    try {
      const matchId = formData.get("matchId")?.toString();
      if (!matchId) {
        throw new Error("Не передан матч");
      }

      await deleteMatch(matchId);
      redirect(`/admin?message=${encodeURIComponent("Матч удален")}`);
    } catch (error) {
      redirect(
        `/admin?error=${encodeURIComponent(
          error instanceof Error ? error.message : "Не удалось удалить матч"
        )}`
      );
    }
  };

  const setUserRoleAction = async (formData: FormData) => {
    "use server";
    try {
      const userId = formData.get("userId")?.toString();
      const role = formData.get("role")?.toString();
      if (!userId || (role !== "USER" && role !== "ADMIN")) {
        throw new Error("Неверные параметры");
      }

      if (session.user.id === userId && role !== "ADMIN") {
        throw new Error("Нельзя снять собственную роль ADMIN");
      }

      await prisma.user.update({
        where: { id: userId },
        data: { role },
      });

      redirect(`/admin?message=${encodeURIComponent("Роль пользователя изменена")}`);
    } catch (error) {
      redirect(
        `/admin?error=${encodeURIComponent(
          error instanceof Error ? error.message : "Не удалось изменить роль"
        )}`
      );
    }
  };

  const createEventAction = async (formData: FormData) => {
    "use server";

    try {
      await createEventAndScore({
        matchId: formData.get("matchId")?.toString(),
        type: formData.get("type")?.toString(),
        description: formData.get("description")?.toString() || undefined,
        player: formData.get("player")?.toString() || undefined,
        team: formData.get("team")?.toString() || undefined,
      });

      redirect(`/admin?message=${encodeURIComponent("Событие создано")}`);
    } catch (error) {
      redirect(
        `/admin?error=${encodeURIComponent(
          error instanceof Error ? error.message : "Не удалось создать событие"
        )}`
      );
    }
  };

  const syncFeedAction = async (formData: FormData) => {
    "use server";
    try {
      const source = formData.get("source")?.toString() as
        | "pandascore"
        | "api-football"
        | null;
      const report = await syncActiveSources(source ? [source] : ["pandascore", "api-football"]);
      const payload = report
        .map((item) => {
          const summaryLine = [
            `матчей: ${item.matches}`,
            `событий: ${item.events}`,
            `создано: ${item.created}`,
            `обновлено: ${item.updated}`,
          ];

          if (item.skippedEvents && item.skippedEvents > 0) {
            summaryLine.push(`дубликатов событий: ${item.skippedEvents}`);
          }

          if (item.skipped && item.skipped > 0) {
            summaryLine.push(`пропущено матчей: ${item.skipped}`);
          }

          return `${item.source} (${summaryLine.join(", ")})`;
        })
        .join("; ");

      redirect(`/admin?message=${encodeURIComponent(`Интеграция: ${payload}`)}`);
    } catch (error) {
      redirect(
        `/admin?error=${encodeURIComponent(
          error instanceof Error ? error.message : "Не удалось выполнить синхронизацию"
        )}`
      );
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="container mx-auto px-4 py-10 space-y-8">
        <div className="flex justify-between">
          <h1 className="text-3xl font-bold text-cyan-400">Админ-панель</h1>
          <Link href="/" className="text-cyan-400 hover:text-cyan-300">
            На главную
          </Link>
        </div>

        {message ? (
          <div className="bg-emerald-900/40 border border-emerald-500 rounded-lg p-4">
            {message}
          </div>
        ) : null}

        {error ? (
          <div className="bg-red-900/40 border border-red-500 rounded-lg p-4">
            {error}
          </div>
        ) : null}

        <section className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-6">
          <h2 className="text-xl font-semibold">Создание матча</h2>
          <form action={createMatchAction} className="grid md:grid-cols-2 gap-4">
            <input
              name="title"
              required
              className="bg-slate-700 border border-slate-600 rounded-lg p-3"
              placeholder="Название матча"
            />
            <select
              name="sportType"
              required
              className="bg-slate-700 border border-slate-600 rounded-lg p-3"
              defaultValue={SportType.CS2}
            >
              {Object.values(SportType).map((sport) => (
                <option key={sport} value={sport}>
                  {sport}
                </option>
              ))}
            </select>
            <input
              name="streamUrl"
              required
              type="url"
              className="bg-slate-700 border border-slate-600 rounded-lg p-3"
              placeholder="https://www.youtube.com/..."
            />
            <input
              name="startTime"
              required
              type="datetime-local"
              className="bg-slate-700 border border-slate-600 rounded-lg p-3"
            />
            <input
              name="externalId"
              className="bg-slate-700 border border-slate-600 rounded-lg p-3 md:col-span-2"
              placeholder="ID внешнего источника"
            />
            <button className="md:col-span-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg p-3">
              Создать матч
            </button>
          </form>
        </section>

        <section className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-6">
          <h2 className="text-xl font-semibold">Редактирование матчей</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {matches.map((match) => (
              <div key={match.id} className="border border-slate-700 rounded-lg p-4 bg-slate-900/50">
                <h3 className="font-semibold">{match.title}</h3>
                <p className="text-slate-400 text-sm">
                  {match.sportType} · {match.status}
                </p>
                <form action={updateMatchAction} className="space-y-2 mt-3">
                  <input type="hidden" name="matchId" value={match.id} />
                  <input
                    name="title"
                    placeholder="Название (необязательно)"
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select name="sportType" className="bg-slate-700 border border-slate-600 rounded-lg p-3">
                      {Object.values(SportType).map((sport) => (
                        <option key={sport} value={sport}>
                          {sport}
                        </option>
                      ))}
                    </select>
                    <select name="status" defaultValue={match.status} className="bg-slate-700 border border-slate-600 rounded-lg p-3">
                      {Object.values(MatchStatus).map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                  <input
                    name="streamUrl"
                    defaultValue={match.streamUrl}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3"
                  />
                  <input
                    name="externalId"
                    defaultValue={match.externalId ?? ""}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      name="startTime"
                      type="datetime-local"
                      className="bg-slate-700 border border-slate-600 rounded-lg p-3"
                    />
                    <input
                      name="endTime"
                      type="datetime-local"
                      className="bg-slate-700 border border-slate-600 rounded-lg p-3"
                    />
                  </div>
                  <button className="w-full bg-cyan-600 hover:bg-cyan-700 rounded-lg p-3">
                    Обновить матч
                  </button>
                </form>
                <form action={deleteMatchAction} className="mt-2">
                  <input type="hidden" name="matchId" value={match.id} />
                  <button className="w-full bg-red-700 hover:bg-red-800 rounded-lg p-3">
                    Удалить матч
                  </button>
                </form>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-6">
          <h2 className="text-xl font-semibold">Добавить событие</h2>
          <form action={createEventAction} className="grid md:grid-cols-2 gap-4">
            <select
              name="matchId"
              required
              className="bg-slate-700 border border-slate-600 rounded-lg p-3"
            >
              <option value="">Выберите матч</option>
              {matches.map((match) => (
                <option key={match.id} value={match.id}>
                  {match.title} ({match.status})
                </option>
              ))}
            </select>
            <div className="space-y-2">
              <input
                name="type"
                required
                className="w-full bg-slate-700 border border-slate-600 rounded-lg p-3"
                placeholder="Тип события (kill, goal, yellow_card, ...)"
              />
              <p className="text-sm text-slate-400">
                <span className="font-medium">CS2/Dota/Valorant:</span> kill, round_win, ace, etc.<br />
                <span className="font-medium">Футбол:</span> {Object.values(FOOTBALL_EVENT_TYPES).join(", ")}
              </p>
            </div>
            <input
              name="description"
              className="bg-slate-700 border border-slate-600 rounded-lg p-3 md:col-span-2"
              placeholder="Описание"
            />
            <input
              name="player"
              className="bg-slate-700 border border-slate-600 rounded-lg p-3"
              placeholder="Игрок"
            />
            <input
              name="team"
              className="bg-slate-700 border border-slate-600 rounded-lg p-3"
              placeholder="Команда"
            />
            <button className="md:col-span-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg p-3">
              Добавить событие
            </button>
          </form>
        </section>

        <section className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          <h2 className="text-xl font-semibold mb-4">Пользователи</h2>
          <div className="grid md:grid-cols-2 gap-3">
            {users.map((user) => (
              <form
                key={user.id}
                action={setUserRoleAction}
                className="border border-slate-700 rounded-lg p-4 bg-slate-900/50"
              >
                <p className="font-semibold">{user.name || user.email}</p>
                <p className="text-slate-400 text-sm">{user.email}</p>
                <input type="hidden" name="userId" value={user.id} />
                <div className="flex gap-2 mt-3">
                  <select
                    name="role"
                    defaultValue={user.role}
                    className="bg-slate-700 border border-slate-600 rounded-lg p-2"
                  >
                    <option value="USER">
                      USER
                    </option>
                    <option value="ADMIN">
                      ADMIN
                    </option>
                  </select>
                  <button className="bg-cyan-600 hover:bg-cyan-700 rounded-lg px-3">
                    Сменить
                  </button>
                </div>
              </form>
            ))}
          </div>
        </section>

        <section className="bg-slate-800 rounded-xl border border-slate-700 p-6 space-y-4">
          <h2 className="text-xl font-semibold">Интеграция матчей</h2>
          <p className="text-sm text-emerald-300">
            Режим интеграции: <span className="font-semibold">{INTEGRATION_MODE}</span> (без внешних API, только mock feed)
          </p>
          <form action={syncFeedAction} className="space-y-3">
            <select
              name="source"
              className="bg-slate-700 border border-slate-600 rounded-lg p-3"
              defaultValue=""
            >
              <option value="">Авто-режим</option>
              <option value="pandascore">PandaScore</option>
              <option value="api-football">API-Football</option>
            </select>
            <p className="text-sm text-slate-400">
              Заглушки интеграции возвращают структурированные payload и могут запускаться вручную/по cron.
            </p>
            <button className="bg-cyan-600 hover:bg-cyan-700 rounded-lg p-3">
              Запустить синхронизацию
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}
