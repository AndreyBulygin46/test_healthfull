"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import type { Socket } from "socket.io-client";
import { io } from "socket.io-client";

type Row = {
  rank: number;
  userId: string;
  userName: string;
  totalPoints: number;
  matchesPlayed: number;
  period: string;
  matchId: string | null;
};

type LeaderboardClientProps = {
  initialLeaderboard: Row[];
  matchId?: string;
};

export function LeaderboardClient({
  initialLeaderboard,
  matchId,
}: LeaderboardClientProps) {
  const [rows, setRows] = useState(initialLeaderboard);
  const [status, setStatus] = useState<"polling" | "socket" | "unknown">("unknown");
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    let pollingInterval: ReturnType<typeof window.setInterval> | null = null;

    const ensurePolling = () => {
      if (!pollingInterval) {
        pollingInterval = window.setInterval(poll, 5000);
      }
    };

    const stopPolling = () => {
      if (!pollingInterval) {
        return;
      }
      window.clearInterval(pollingInterval);
      pollingInterval = null;
    };

    const loadStatus = async () => {
      try {
        const statusRes = await fetch("/api/realtime/status");
        if (!statusRes.ok) {
          setStatus((current) => (current === "socket" ? "socket" : "polling"));
          ensurePolling();
          return;
        }
        const payload = (await statusRes.json()) as {
          ready?: boolean;
          fallbackMode?: "polling" | "socketio";
        };

        if (!payload?.ready || payload?.fallbackMode === "polling") {
          setStatus((current) => (current === "socket" ? "socket" : "polling"));
          ensurePolling();
          return;
        }

        setStatus((current) => (current === "unknown" ? "polling" : current));
      } catch {
        setStatus((current) => (current === "socket" ? "socket" : "polling"));
        ensurePolling();
      }
    };

    const poll = async () => {
      try {
        const res = await fetch(
          `/api/leaderboard${matchId ? `?matchId=${encodeURIComponent(matchId)}` : ""}`,
          { cache: "no-store" }
        );
        if (!res.ok) {
          return;
        }
        const payload = (await res.json()) as Row[];
        setRows(payload);
      } catch {
        // keep previous leaderboard values if poll fails
      }
    };

    const connectSocket = () => {
      const socket = io({
        path: "/api/socket/socket.io",
        transports: ["websocket", "polling"],
        autoConnect: false,
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        setStatus("socket");
        stopPolling();
      });

      socket.on("disconnect", () => {
        setStatus("polling");
        ensurePolling();
      });

      socket.on("connect_error", () => {
        setStatus("polling");
        ensurePolling();
      });

      socket.on("leaderboard:update", () => {
        void poll();
      });

      void (async () => {
        try {
          await fetch("/api/socket", { cache: "no-store" });
        } catch {
          // fallback to polling-only mode if WebSocket init endpoint failed
        }
        socket.connect();
      })();

      return () => {
        socket.disconnect();
        socketRef.current = null;
      };
    };

    loadStatus();
    ensurePolling();
    const statusInterval = window.setInterval(loadStatus, 15000);
    const socketCleanup = connectSocket();

    return () => {
      stopPolling();
      window.clearInterval(statusInterval);
      socketCleanup();
    };
  }, [matchId]);

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="container mx-auto px-4 py-10">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h1 className="text-3xl font-bold text-cyan-400">Турнирная таблица</h1>
            <p className="text-slate-400">{matchId ? "По одному матчу" : "Общий рейтинг"}</p>
            <p className="text-xs text-slate-500 mt-1">Обновления: {status}</p>
          </div>
          <Link href="/matches" className="text-cyan-400 hover:text-cyan-300">
            К матчам
          </Link>
        </div>

        <section className="bg-slate-800 rounded-xl border border-slate-700 p-6">
          {rows.length === 0 ? (
            <p className="text-slate-400">
              Пока нет оценок — сделайте несколько прогнозов и возвращайтесь.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-auto text-left">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-700">
                    <th className="py-3 pr-4">Место</th>
                    <th className="py-3 pr-4">Игрок</th>
                    <th className="py-3 pr-4">Очки</th>
                    <th className="py-3">Матчи</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr key={`${row.userId}:${row.period}`} className="border-b border-slate-700">
                      <td className="py-3 pr-4 text-lg font-semibold text-cyan-300">
                        #{row.rank}
                      </td>
                      <td className="py-3 pr-4">{row.userName}</td>
                      <td className="py-3 pr-4 text-cyan-300 font-semibold">
                        {row.totalPoints}
                      </td>
                      <td className="py-3">{row.matchesPlayed}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
