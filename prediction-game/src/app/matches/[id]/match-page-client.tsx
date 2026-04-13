"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import type { MatchStatus } from "@prisma/client";
import type { Socket } from "socket.io-client";
import { io } from "socket.io-client";

import { getScoreTierName } from "@/lib/scoring";
import { formatTimeDifference } from "@/lib/scoring";
import { defaultSocketClientOptions } from "@/lib/realtime/socket-client";

type PredictionType = "INSTANT" | "INTERVAL";

type MatchEvent = {
  id: string;
  type: string;
  timestamp: string;
  description?: string | null;
  player?: string | null;
  team?: string | null;
};

type MatchPredictionRow = {
  id: string;
  userName: string;
  predictedAt: string;
  targetEvent?: string | null;
  points?: number | null;
  accuracyMs?: number | null;
  userId: string;
};

type MatchData = {
  id: string;
  title: string;
  status: MatchStatus;
  sportType: string;
  streamUrl: string;
  startTime: string;
  endTime: string | null;
  events: MatchEvent[];
  predictions: MatchPredictionRow[];
};

type MatchClientPageProps = {
  match: MatchData;
  sessionUser: { id: string; name?: string | null; email: string } | null;
  initialMessage: string | null;
};

function getEmbedUrl(url: string) {
  if (!url) return "";

  const youtubeMatch =
    /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]+)/.exec(url) ||
    /youtube\.com\/embed\/([a-zA-Z0-9_-]+)/.exec(url);
  if (youtubeMatch?.[1]) {
    return `https://www.youtube.com/embed/${youtubeMatch[1]}`;
  }

  const twitchMatch = /twitch\.tv\/([^/?]+)/.exec(url);
  if (twitchMatch?.[1]) {
    const channel = twitchMatch[1];
    return `https://player.twitch.tv/?channel=${channel}&parent=${window.location.hostname}&autoplay=false&muted=true`;
  }

  return "";
}

function formatRemainingTime(dateString: string, fromStart = false) {
  const ms = fromStart ? Date.now() - new Date(dateString).getTime() : new Date(dateString).getTime() - Date.now();
  if (Number.isNaN(ms)) return "";

  const sign = ms >= 0 ? "" : "-";
  const abs = Math.abs(ms);
  const h = Math.floor(abs / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  const s = Math.floor((abs % 60000) / 1000);
  return `${sign}${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function MatchClientPage({ match, sessionUser, initialMessage }: MatchClientPageProps) {
  const [events, setEvents] = useState<MatchEvent[]>(match.events);
  const [allPredictions, setAllPredictions] = useState<MatchPredictionRow[]>(match.predictions);
  const [myPredictions, setMyPredictions] = useState<MatchPredictionRow[]>(() => {
    if (!sessionUser) {
      return [];
    }

    return match.predictions.filter((prediction) => prediction.userId === sessionUser.id);
  });
  const [statusMessage, setStatusMessage] = useState<string | null>(initialMessage);
  const [mode, setMode] = useState<PredictionType>("INSTANT");
  const [targetEvent, setTargetEvent] = useState("");
  const [intervalSeconds, setIntervalSeconds] = useState(10);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [now, setNow] = useState(new Date());
  const [realtimeMode, setRealtimeMode] = useState<"polling" | "socket" | "unknown">("unknown");
  const socketRef = useRef<Socket | null>(null);

  const matchStatusLabel = useMemo(() => {
    if (match.status === "UPCOMING") {
      return "Ожидает старта";
    }
    if (match.status === "LIVE") {
      return "Идёт матч";
    }
    if (match.status === "FINISHED") {
      return "Завершён";
    }
    return "Отменён";
  }, [match.status]);

  const timerLabel =
    match.status === "UPCOMING"
      ? `До старта: ${formatRemainingTime(match.startTime)}`
      : match.status === "LIVE"
        ? `Прошло: ${formatRemainingTime(match.startTime, true)}`
        : "Матч завершён";

  useEffect(() => {
    let pollingInterval: ReturnType<typeof window.setInterval> | null = null;
    let statusInterval: ReturnType<typeof window.setInterval> | null = null;
    const clock = window.setInterval(() => setNow(new Date()), 1000);

    const loadStatus = async () => {
      try {
        const statusRes = await fetch("/api/realtime/status");
        if (!statusRes.ok) {
          setRealtimeMode("polling");
          ensurePolling();
          return;
        }
        const payload = (await statusRes.json()) as {
          ready?: boolean;
          fallbackMode?: "polling" | "socketio";
        };
        if (!payload?.ready || payload?.fallbackMode === "polling") {
          setRealtimeMode((current) => (current === "socket" ? "socket" : "polling"));
          ensurePolling();
          return;
        }

        setRealtimeMode((current) => (current === "unknown" ? "polling" : current));
      } catch {
        setRealtimeMode("polling");
        ensurePolling();
      }
    };

    const loadEvents = async () => {
      const eventRes = await fetch(`/api/matches/${match.id}/events?take=100`, {
        cache: "no-store",
      });
      if (eventRes.ok) {
        const payload = (await eventRes.json()) as { events: MatchEvent[] };
        setEvents(payload.events || []);
      }
    };

    const loadAllPredictions = async () => {
      const predRes = await fetch(`/api/matches/${match.id}/predictions?scope=all&limit=30`, {
        cache: "no-store",
      });
      if (!predRes.ok) {
        return;
      }

      const list = (await predRes.json()) as Array<{
        id: string;
        user?: { name?: string | null; email?: string | null };
        userId: string;
        predictedAt: string;
        targetEvent?: string | null;
        score?: { points?: number | null; accuracyMs?: number | null };
      }>;

      const normalized = list.map((item) => ({
        id: item.id,
        userName: item.user?.name ?? item.user?.email ?? "Аноним",
        predictedAt: item.predictedAt,
        targetEvent: item.targetEvent,
        points: item.score?.points ?? null,
        accuracyMs: item.score?.accuracyMs ?? null,
        userId: item.userId,
      }));

      setAllPredictions(normalized);
    };

    const loadMyPredictions = async () => {
      if (!sessionUser?.id) {
        setMyPredictions([]);
        return;
      }

      const predRes = await fetch(
        `/api/matches/${match.id}/predictions?scope=mine&limit=30`,
        {
          cache: "no-store",
        }
      );
      if (!predRes.ok) {
        return;
      }

      const list = (await predRes.json()) as Array<{
        id: string;
        user?: { name?: string | null; email?: string | null };
        userId: string;
        predictedAt: string;
        targetEvent?: string | null;
        score?: { points?: number | null; accuracyMs?: number | null };
      }>;

      const normalized = list.map((item) => ({
        id: item.id,
        userName: item.user?.name ?? item.user?.email ?? "Аноним",
        predictedAt: item.predictedAt,
        targetEvent: item.targetEvent,
        points: item.score?.points ?? null,
        accuracyMs: item.score?.accuracyMs ?? null,
        userId: item.userId,
      }));

      setMyPredictions(normalized);
    };

    const refreshData = async () => {
      try {
        await Promise.all([loadEvents(), loadAllPredictions(), loadMyPredictions()]);
      } catch {
        // keep current state on polling failures
      }
    };

    const ensurePolling = () => {
      if (!pollingInterval) {
        pollingInterval = window.setInterval(refreshData, 5000);
      }
    };

    const stopPolling = () => {
      if (!pollingInterval) {
        return;
      }
      window.clearInterval(pollingInterval);
      pollingInterval = null;
    };

    const socket: Socket = io(defaultSocketClientOptions);
    socketRef.current = socket;

    socket.on("connect", () => {
      setRealtimeMode("socket");
      stopPolling();
      socket.emit("match:join", { matchId: match.id });
      if (sessionUser?.id) {
        socket.emit("user:join", { userId: sessionUser.id });
      }
    });

    socket.on("disconnect", () => {
      setRealtimeMode("polling");
      ensurePolling();
    });

    socket.on("connect_error", () => {
      setRealtimeMode("polling");
      ensurePolling();
    });

    socket.on("match:event", () => {
      void refreshData();
    });

    socket.on("match:update", () => {
      void refreshData();
    });

    socket.on("prediction:result", () => {
      void refreshData();
    });

    loadStatus();
    refreshData();
    ensurePolling();
    statusInterval = window.setInterval(loadStatus, 15000);

    void (async () => {
      try {
        await fetch("/api/socket", { cache: "no-store" });
      } catch {
        // fallback to existing no-op if initialization endpoint is unavailable
      }
      socket.connect();
    })();

    return () => {
      if (pollingInterval) {
        window.clearInterval(pollingInterval);
      }
      if (statusInterval) {
        window.clearInterval(statusInterval);
      }
      window.clearInterval(clock);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [match.id, sessionUser?.id]);

  const submitPrediction = async () => {
    if (!sessionUser) {
      window.location.href = "/login";
      return;
    }
    if (isSubmitting) return;

    setIsSubmitting(true);
    setStatusMessage(null);

    try {
      const body = {
        matchId: match.id,
        type: mode,
        ...(targetEvent.trim() ? { targetEvent: targetEvent.trim() } : {}),
        ...(mode === "INTERVAL" ? { intervalSeconds } : {}),
      };

      const response = await fetch("/api/predictions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || "Не удалось отправить предсказание");
      }

      setStatusMessage("Предсказание отправлено");
      const newPrediction = payload?.prediction
        ? {
            id: payload.prediction.id,
            userName: sessionUser.name || sessionUser.email,
            predictedAt: new Date(payload.prediction.predictedAt).toISOString(),
            targetEvent: payload.prediction.targetEvent,
            points: payload.prediction.score?.points ?? null,
            accuracyMs: payload.prediction.score?.accuracyMs ?? null,
            userId: sessionUser.id,
          }
        : null;

      if (newPrediction) {
        setAllPredictions((prev) => [newPrediction, ...prev].slice(0, 50));
        setMyPredictions((prev) => [newPrediction, ...prev].slice(0, 50));
      }
      setTargetEvent("");
    } catch (error) {
      setStatusMessage(
        error instanceof Error ? error.message : "Не удалось отправить предсказание"
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const embedUrl = useMemo(() => getEmbedUrl(match.streamUrl), [match.streamUrl]);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="container mx-auto px-4 py-8 space-y-6">
        <div className="flex justify-between items-start">
          <div>
            <Link href="/matches" className="text-cyan-300 hover:text-cyan-200">
              ← К списку матчей
            </Link>
            <Link
              href={`/leaderboard?matchId=${match.id}`}
              className="ml-4 text-cyan-300 hover:text-cyan-200"
            >
              Таблица по матчу
            </Link>
            <h1 className="text-3xl mt-2 font-bold">{match.title}</h1>
            <p className="text-slate-300">
              {match.sportType} · {matchStatusLabel}
            </p>
          </div>
          <p className="text-sm text-slate-300">
            Время обновления: {now.toLocaleTimeString("ru-RU")} · {realtimeMode}
          </p>
        </div>

        <section className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-2">
          <h2 className="font-semibold">Трансляция / таймер</h2>
          <p className="text-sm text-slate-300">{timerLabel}</p>
          {embedUrl ? (
            <div className="w-full aspect-video rounded-lg overflow-hidden">
              <iframe
                title="match stream"
                src={embedUrl}
                className="w-full h-full"
                allowFullScreen
              />
            </div>
          ) : (
            <a
              href={match.streamUrl}
              target="_blank"
              rel="noreferrer"
              className="text-cyan-300 hover:text-cyan-200"
            >
              Открыть трансляцию
            </a>
          )}
        </section>

        {statusMessage ? (
          <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 text-sm">
            {statusMessage}
          </div>
        ) : null}

        <section className="bg-slate-800 border border-slate-700 rounded-xl p-4 space-y-4">
          <h2 className="text-xl font-semibold">Отправить предсказание</h2>
          <p className="text-xs text-slate-400 leading-relaxed -mt-1">
            Для киберспорта и др. (не футбол) очки зависят от разницы времени между нажатием и моментом
            события: до 2 с — 100 XP, до 20 с — ещё есть очки,{" "}
            <strong className="text-slate-300">свыше 20 с — 0 XP («Мимо»)</strong>. Сначала нажмите
            «СЕЙЧАС», затем пусть админ добавит событие с тем же типом, что в поле цели (или без цели —
            подойдёт следующее событие). Регистр в названии типа не важен.
          </p>
          {sessionUser ? (
            <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-end">
              <div className="space-y-2">
                <div className="flex gap-4">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      checked={mode === "INSTANT"}
                      onChange={() => setMode("INSTANT")}
                    />
                    INSTANT
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      checked={mode === "INTERVAL"}
                      onChange={() => setMode("INTERVAL")}
                    />
                    INTERVAL
                  </label>
                </div>
                <input
                  value={targetEvent}
                  onChange={(event) => setTargetEvent(event.target.value)}
                  placeholder="Целевое событие (kill, goal...)"
                  className="w-full bg-slate-700 border border-slate-600 p-3 rounded-lg"
                />
                {mode === "INTERVAL" ? (
                  <div className="flex items-center gap-2">
                    <label className="text-sm">Окно (сек):</label>
                    <input
                      type="number"
                      min={1}
                      max={120}
                      value={intervalSeconds}
                      onChange={(event) => setIntervalSeconds(Number(event.target.value) || 10)}
                      className="w-24 bg-slate-700 border border-slate-600 p-2 rounded-lg"
                    />
                  </div>
                ) : null}
              </div>
              <button
                onClick={submitPrediction}
                disabled={isSubmitting}
                className="bg-cyan-600 disabled:opacity-60 px-6 py-3 rounded-lg font-semibold"
              >
                {isSubmitting ? "Отправка..." : "СЕЙЧАС"}
              </button>
            </div>
          ) : (
            <p>
              Для прогноза нужно{" "}
              <Link href="/login" className="text-cyan-300 hover:text-cyan-200">
                войти
              </Link>
            </p>
          )}
        </section>

        <section className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <h2 className="text-xl font-semibold mb-4">События</h2>
          {events.length === 0 ? (
            <p className="text-slate-400">Событий пока нет</p>
          ) : (
            <ul className="space-y-2">
              {events.map((event) => (
                <li key={event.id} className="text-slate-200">
                  <span className="text-cyan-300">{event.type}</span> ·{" "}
                  {new Date(event.timestamp).toLocaleTimeString("ru-RU")}
                  {event.description ? ` — ${event.description}` : ""}
                  {event.player ? ` (${event.player})` : ""}
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <h2 className="text-xl font-semibold mb-4">Последние предсказания</h2>
          {allPredictions.length === 0 ? (
            <p className="text-slate-400">Пока нет предсказаний</p>
          ) : (
            <div className="space-y-3">
              {allPredictions.map((prediction) => (
                <div
                  key={prediction.id}
                  className="flex justify-between border-b border-slate-700 pb-3"
                >
                  <div>
                    <p className="text-white">{prediction.userName}</p>
                    <p className="text-slate-400 text-sm">
                      {new Date(prediction.predictedAt).toLocaleTimeString("ru-RU")} ·{" "}
                      {prediction.targetEvent ? `цель: ${prediction.targetEvent}` : "без цели"}
                    </p>
                  </div>
                  <div className="text-right">
                    {prediction.points === null ? (
                      <p className="text-slate-500">Ожидает события</p>
                    ) : (
                      <>
                        <p className="text-cyan-300 font-semibold">+{prediction.points} XP</p>
                        <p className="text-xs text-slate-400">
                          {getScoreTierName(prediction.points)} ·{" "}
                          {prediction.accuracyMs !== null
                            ? formatTimeDifference(prediction.accuracyMs)
                            : ""}
                        </p>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-slate-800 border border-slate-700 rounded-xl p-4">
          <h2 className="text-xl font-semibold mb-4">Мои предсказания</h2>
          {sessionUser ? (
            myPredictions.length === 0 ? (
              <p className="text-slate-400">Вы еще не делали прогнозов на этот матч</p>
            ) : (
              <div className="space-y-3">
                {myPredictions.map((prediction) => (
                  <div
                    key={prediction.id}
                    className="flex justify-between border-b border-slate-700 pb-3"
                  >
                    <div>
                      <p className="text-white">{prediction.userName}</p>
                      <p className="text-slate-400 text-sm">
                        {new Date(prediction.predictedAt).toLocaleTimeString("ru-RU")} ·{" "}
                        {prediction.targetEvent ? `цель: ${prediction.targetEvent}` : "без цели"}
                      </p>
                    </div>
                    <div className="text-right">
                      {prediction.points === null ? (
                        <p className="text-slate-500">Ожидает события</p>
                      ) : (
                        <>
                          <p className="text-cyan-300 font-semibold">+{prediction.points} XP</p>
                          <p className="text-xs text-slate-400">
                            {getScoreTierName(prediction.points)} ·{" "}
                            {prediction.accuracyMs !== null
                              ? formatTimeDifference(prediction.accuracyMs)
                              : ""}
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )
          ) : (
            <p className="text-slate-400">Войдите, чтобы увидеть ваши прогнозы по этому матчу</p>
          )}
        </section>
      </div>
    </div>
  );
}
