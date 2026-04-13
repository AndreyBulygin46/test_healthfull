import type { ManagerOptions } from "socket.io-client";

/** Общие настройки клиента: без бесконечных переподключений и с ограничением «шторма» при ошибках. */
export const defaultSocketClientOptions: Partial<ManagerOptions> = {
  path: "/api/socket/socket.io",
  transports: ["websocket", "polling"],
  autoConnect: false,
  reconnectionAttempts: 8,
  reconnectionDelay: 1500,
  reconnectionDelayMax: 10000,
  randomizationFactor: 0.5,
};
