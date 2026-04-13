import { Server as IOServer } from "socket.io";
import { MATCH_PREDICTION_COOLDOWN_MS, MATCH_PREDICTION_MAX_COUNT } from "@/lib/validation";

type MatchRoom = `match:${string}`;
type UserRoom = `user:${string}`;

type RealtimeChannel =
  | "match:update"
  | "match:event"
  | "leaderboard:update"
  | "prediction:result";

export type RealtimePayload = {
  channel: RealtimeChannel;
  matchId?: string;
  userId?: string;
  payload: Record<string, unknown>;
};

type RealtimeBus = {
  publish: (event: RealtimePayload) => void;
  getStatus: () => {
    ready: boolean;
    activeConnections: number;
    rooms: string[];
    fallbackMode: "polling" | "socketio";
  };
};

type SocketEventStatus = {
  ready: boolean;
  activeConnections: number;
  rooms: string[];
  fallbackMode: "polling" | "socketio";
};

class InProcessBus implements RealtimeBus {
  publish(event: RealtimePayload) {
    if (event.matchId || event.userId) {
      void event;
    }
  }

  getStatus(): SocketEventStatus {
    return {
      ready: false,
      activeConnections: 0,
      rooms: [],
      fallbackMode: "polling",
    };
  }
}

class SocketBus implements RealtimeBus {
  constructor(private readonly io: IOServer) {}

  publish(event: RealtimePayload) {
    const { channel, matchId, userId, payload } = event;
    if (channel === "leaderboard:update") {
      this.io.emit("leaderboard:update", payload);
      return;
    }

    if (matchId) {
      this.io.to(`match:${matchId}`).emit(channel, payload);
    }

    if (userId) {
      this.io.to(`user:${userId}`).emit(channel, payload);
    }
  }

  getStatus(): SocketEventStatus {
    const roomKeys = this.io.sockets.adapter.rooms.keys();
    const rooms: string[] = [];
    let index = 0;
    const maxRooms = 200;
    for (const key of roomKeys) {
      rooms.push(key);
      index += 1;
      if (index >= maxRooms) {
        break;
      }
    }

    return {
      ready: true,
      activeConnections: this.io.engine?.clientsCount ?? 0,
      rooms,
      fallbackMode: "socketio",
    };
  }
}

let bus: RealtimeBus | null = null;

export function registerRealtimeBus(io: IOServer) {
  bus = new SocketBus(io);
}

export function getRealtimeBus(): RealtimeBus {
  if (!bus) {
    bus = new InProcessBus();
  }
  return bus;
}

export function emitMatchRoomEvent(matchId: string, type: "match:event" | "match:update", payload: Record<string, unknown>) {
  const event: RealtimePayload = {
    channel: type,
    matchId,
    payload,
  };
  getRealtimeBus().publish(event);
}

export function emitLeaderboardUpdate() {
  getRealtimeBus().publish({
    channel: "leaderboard:update",
    payload: {},
  });
}

export function emitUserResult(userId: string, payload: Record<string, unknown>) {
  getRealtimeBus().publish({
    channel: "prediction:result",
    userId,
    payload,
  });
}

export const realtimeLimits = {
  predictionCooldownMs: MATCH_PREDICTION_COOLDOWN_MS,
  predictionMaxCount: MATCH_PREDICTION_MAX_COUNT,
  rooms: {
    match: (matchId: string): MatchRoom => `match:${matchId}`,
    user: (userId: string): UserRoom => `user:${userId}`,
  },
};
