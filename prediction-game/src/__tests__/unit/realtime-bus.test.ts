import { getRealtimeBus, realtimeLimits } from "@/lib/realtime/socket";

describe("realtime bus", () => {
  it("возвращает параметры polling до инициализации socket", () => {
    const status = getRealtimeBus().getStatus();
    expect(status.ready).toBe(false);
    expect(status.fallbackMode).toBe("polling");
    expect(status.activeConnections).toBe(0);
    expect(status.rooms).toEqual([]);
  });

  it("экспонирует лимиты предсказаний и окна", () => {
    expect(realtimeLimits.predictionCooldownMs).toBe(5000);
    expect(realtimeLimits.predictionMaxCount).toBe(50);
    expect(realtimeLimits.rooms.match("abc")).toBe("match:abc");
    expect(realtimeLimits.rooms.user("u1")).toBe("user:u1");
  });

  it("окно rate-limit согласовано с cooldown", () => {
    const rateWindowSeconds = Math.ceil(realtimeLimits.predictionCooldownMs / 1000);
    expect(rateWindowSeconds).toBe(5);
  });
});
