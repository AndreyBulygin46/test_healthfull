import bcrypt from "bcryptjs";
import { MatchStatus, PredictionType, SportType, UserRole } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  createEventAndScore,
  createMatch,
  createPrediction,
  getLeaderboard,
} from "@/lib/prediction-service";

describe("MVP smoke flow", () => {
  beforeEach(async () => {
    await prisma.score.deleteMany();
    await prisma.prediction.deleteMany();
    await prisma.event.deleteMany();
    await prisma.match.deleteMany();
    await prisma.user.deleteMany({
      where: {
        email: {
          in: ["smoke-admin@example.com", "smoke-player@example.com"],
        },
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("подтверждает сценарий login -> match -> prediction -> event -> leaderboard", async () => {
    const adminPassword = await bcrypt.hash("admin123456", 10);
    const playerPassword = await bcrypt.hash("player123456", 10);

    const admin = await prisma.user.upsert({
      where: { email: "smoke-admin@example.com" },
      update: {
        name: "Smoke Admin",
        role: UserRole.ADMIN,
        password: adminPassword,
      },
      create: {
        email: "smoke-admin@example.com",
        name: "Smoke Admin",
        role: UserRole.ADMIN,
        password: adminPassword,
      },
    });
    const player = await prisma.user.upsert({
      where: { email: "smoke-player@example.com" },
      update: {
        name: "Smoke Player",
        password: playerPassword,
      },
      create: {
        email: "smoke-player@example.com",
        name: "Smoke Player",
        password: playerPassword,
      },
    });

    const isAdminLoginValid = await bcrypt.compare("admin123456", admin.password ?? "");
    const isPlayerLoginValid = await bcrypt.compare("player123456", player.password ?? "");
    expect(isAdminLoginValid).toBe(true);
    expect(isPlayerLoginValid).toBe(true);

    const externalId = `smoke-match-${Date.now()}-${Math.random().toString(16).slice(2)}`;

    const match = await createMatch({
      title: "Smoke Match",
      sportType: SportType.CS2,
      streamUrl: "https://youtube.com/watch?v=smoke",
      startTime: new Date().toISOString(),
      externalId,
    });

    await prisma.match.update({
      where: { id: match.id },
      data: { status: MatchStatus.LIVE },
    });

    const predictionResult = await createPrediction(player.id, {
      matchId: match.id,
      type: PredictionType.INSTANT,
      targetEvent: "goal",
    });
    expect(predictionResult.prediction.id).toBeTruthy();

    await createEventAndScore({
      matchId: match.id,
      type: "goal",
      description: "Smoke event",
    });

    const leaderboard = await getLeaderboard(match.id, 10);
    expect(leaderboard.length).toBeGreaterThan(0);
    expect(leaderboard[0]?.userId).toBe(player.id);
    expect(leaderboard[0]?.totalPoints).toBeGreaterThanOrEqual(0);
  });
});
