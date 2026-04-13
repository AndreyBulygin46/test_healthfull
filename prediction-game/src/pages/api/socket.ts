import type { NextApiRequest, NextApiResponse } from "next";
import { Server as SocketIOServer } from "socket.io";
import { registerRealtimeBus } from "@/lib/realtime/socket";

type SocketServerResponse = NextApiResponse & {
  socket: NextApiResponse["socket"] & {
    server: {
      io?: SocketIOServer;
    };
  };
};

export default function handler(request: NextApiRequest, response: SocketServerResponse) {
  const server = response.socket.server;
  if (!server.io) {
    const io = new SocketIOServer(server, {
      path: "/api/socket/socket.io",
      addTrailingSlash: false,
    });

    io.on("connection", (socket) => {
      socket.on("match:join", (payload: { matchId?: string }) => {
        if (payload?.matchId) {
          socket.join(`match:${payload.matchId}`);
        }
      });

      socket.on("user:join", (payload: { userId?: string }) => {
        if (payload?.userId) {
          socket.join(`user:${payload.userId}`);
        }
      });
    });

    server.io = io;
    registerRealtimeBus(io);
  }

  response.status(200).end();
}
