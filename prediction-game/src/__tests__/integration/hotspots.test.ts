import { MatchStatus, PredictionType, SportType } from "@prisma/client";
import { NextRequest } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  createEventAndScore,
  createMatch,
  createPrediction,
  getLeaderboard,
} from "@/lib/prediction-service";
import { MATCH_PREDICTION_MAX_COUNT } from "@/lib/validation";
import { GET as getPredictionsRoute } from "@/app/api/matches/[id]/predictions/route";
import { GET as getPredictionsApiRoute } from "@/app/api/predictions/route";
import { GET as getRealtimeStatusRoute } from "@/app/api/realtime/status/route";

jest.mock("@/lib/auth", () => ({
  auth: jest.fn(),
}));

const mockedAuth = auth as jest.MockedFunction<typeof auth>;

function randomString(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 10_000_000)}`;
}

async function createLiveMatchWithPlayer(): Promise<{
  user: { id: string; email: string; name: string };
  match: {
    id: string;
  };
}> {
  const user = await prisma.user.create({
    data: {
      email: `e2e-test-user-${randomString("user")}.test`,
      name: "Test Player",
    },
  });

  const match = await createMatch({
    title: "Live Match",
    sportType: SportType.CS2,
    streamUrl: "https://youtube.com/watch?v=live",
    startTime: new Date().toISOString(),
    externalId: randomString("live-match"),
  });

  await prisma.match.update({
    where: { id: match.id },
    data: { status: MatchStatus.LIVE },
  });

  return { user, match };
}

describe("Высокорисковые интеграционные сценарии", () => {
  beforeEach(async () => {
    await prisma.score.deleteMany();
    await prisma.prediction.deleteMany();
    await prisma.event.deleteMany();
    await prisma.match.deleteMany();
    await prisma.user.deleteMany({
      where: { email: { contains: "e2e-test-" } },
    });
    mockedAuth.mockReset();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("createPrediction блокирует создание вне LIVE матча", async () => {
    const user = await prisma.user.create({
      data: {
        email: `e2e-test-user-${randomString("upcoming")}.test`,
        name: "Player Upcoming",
      },
    });

    const match = await createMatch({
      title: "Upcoming Match",
      sportType: SportType.CS2,
      streamUrl: "https://youtube.com/watch?v=upcoming",
      startTime: new Date().toISOString(),
      externalId: randomString("upcoming-match"),
    });

    await prisma.match.update({
      where: { id: match.id },
      data: { status: MatchStatus.UPCOMING },
    });

    await expect(
      createPrediction(user.id, {
        matchId: match.id,
        type: PredictionType.INSTANT,
      })
    ).rejects.toThrow(/Матч еще не начался/);
  });

  it("createPrediction блокирует превышение лимита предсказаний", async () => {
    const { user, match } = await createLiveMatchWithPlayer();

    const base = Date.now();
    await Promise.all(
      Array.from({ length: MATCH_PREDICTION_MAX_COUNT }).map((_, index) =>
        prisma.prediction.create({
          data: {
            userId: user.id,
            matchId: match.id,
            type: PredictionType.INSTANT,
            predictedAt: new Date(base - (index + 1) * 10_000),
          },
        })
      )
    );

    await expect(
      createPrediction(user.id, {
        matchId: match.id,
        type: PredictionType.INSTANT,
      })
    ).rejects.toThrow(/Достигнут лимит/);
  });

  it("createPrediction блокирует предсказания по cooldown", async () => {
    const { user, match } = await createLiveMatchWithPlayer();

    await prisma.prediction.create({
      data: {
        userId: user.id,
        matchId: match.id,
        type: PredictionType.INSTANT,
        predictedAt: new Date(),
      },
    });

    await expect(
      createPrediction(user.id, {
        matchId: match.id,
        type: PredictionType.INSTANT,
      })
    ).rejects.toThrow(/Подождите/);
  });

  it("GET /api/matches/:id/predictions корректно разделяет scope=all|mine", async () => {
    const userA = await prisma.user.create({
      data: {
        email: `e2e-test-user-a-${randomString("scope")}.test`,
        name: "User A",
      },
    });
    const userB = await prisma.user.create({
      data: {
        email: `e2e-test-user-b-${randomString("scope")}.test`,
        name: "User B",
      },
    });

    const match = await createMatch({
      title: "Scope Match",
      sportType: SportType.CS2,
      streamUrl: "https://youtube.com/watch?v=scope",
      startTime: new Date().toISOString(),
      externalId: randomString("scope-match"),
    });

    await prisma.match.update({
      where: { id: match.id },
      data: { status: MatchStatus.LIVE },
    });

    await prisma.prediction.create({
      data: {
        userId: userA.id,
        matchId: match.id,
        type: PredictionType.INSTANT,
        predictedAt: new Date(),
      },
    });
    await prisma.prediction.create({
      data: {
        userId: userB.id,
        matchId: match.id,
        type: PredictionType.INSTANT,
        predictedAt: new Date(),
      },
    });

    mockedAuth.mockResolvedValue({
      user: { id: userA.id, name: userA.name, email: userA.email, role: "USER" },
    } as any);

    const allResponse = await getPredictionsRoute(
      new NextRequest(`http://localhost:3000/api/matches/${match.id}/predictions?scope=all&limit=10`),
      { params: { id: match.id } }
    );
    const allPayload = (await allResponse.json()) as Array<{
      userId: string;
    }>;

    expect(allResponse.status).toBe(200);
    expect(allPayload).toHaveLength(2);
    expect(allPayload.some((prediction) => prediction.userId === userA.id)).toBe(true);
    expect(allPayload.some((prediction) => prediction.userId === userB.id)).toBe(true);

    const mineResponse = await getPredictionsRoute(
      new NextRequest(`http://localhost:3000/api/matches/${match.id}/predictions?scope=mine&limit=10`),
      { params: { id: match.id } }
    );
    const minePayload = (await mineResponse.json()) as Array<{
      userId: string;
    }>;

    expect(mineResponse.status).toBe(200);
    expect(minePayload).toHaveLength(1);
    expect(minePayload[0]?.userId).toBe(userA.id);
  });

  it("scope=all не должен раскрывать email пользователя", async () => {
    const { user, match } = await createLiveMatchWithPlayer();
    const secondUser = await prisma.user.create({
      data: {
        email: `e2e-test-user-${randomString("scope2")}.test`,
        name: "Second",
      },
    });

    await prisma.prediction.create({
      data: {
        userId: user.id,
        matchId: match.id,
        type: PredictionType.INSTANT,
        predictedAt: new Date(),
      },
    });
    await prisma.prediction.create({
      data: {
        userId: secondUser.id,
        matchId: match.id,
        type: PredictionType.INSTANT,
        predictedAt: new Date(),
      },
    });

    mockedAuth.mockResolvedValue({
      user: { id: user.id, name: user.name, email: user.email, role: "USER" },
    } as any);

    const response = await getPredictionsRoute(
      new NextRequest(`http://localhost:3000/api/matches/${match.id}/predictions?scope=all&limit=10`),
      { params: { id: match.id } }
    );
    const payload = (await response.json()) as Array<{
      user?: {
        email?: string | null;
        name?: string | null;
      };
    }>;

    const hasEmails = payload.some((prediction) => typeof prediction.user?.email === "string");
    expect(hasEmails).toBe(false);
  });

  it("лидерборд сортируется по сумме очков и режется по limit", async () => {
    const match = await createMatch({
      title: "Leaderboard Match",
      sportType: SportType.CS2,
      streamUrl: "https://youtube.com/watch?v=leaderboard",
      startTime: new Date().toISOString(),
      externalId: randomString("leaderboard-match"),
    });

    const alice = await prisma.user.create({
      data: {
        email: "e2e-test-alice.leaderboard@test.local",
        name: "Alice",
      },
    });
    const bob = await prisma.user.create({
      data: {
        email: "e2e-test-bob.leaderboard@test.local",
        name: "Bob",
      },
    });
    const charlie = await prisma.user.create({
      data: {
        email: "e2e-test-charlie.leaderboard@test.local",
        name: "Charlie",
      },
    });

    const alicePrediction = await prisma.prediction.create({
      data: {
        userId: alice.id,
        matchId: match.id,
        type: PredictionType.INSTANT,
        predictedAt: new Date(),
      },
    });
    const bobPrediction = await prisma.prediction.create({
      data: {
        userId: bob.id,
        matchId: match.id,
        type: PredictionType.INSTANT,
        predictedAt: new Date(),
      },
    });
    const charliePrediction = await prisma.prediction.create({
      data: {
        userId: charlie.id,
        matchId: match.id,
        type: PredictionType.INSTANT,
        predictedAt: new Date(),
      },
    });

    await prisma.score.createMany({
      data: [
        { predictionId: alicePrediction.id, userId: alice.id, points: 120, accuracyMs: 1200 },
        { predictionId: bobPrediction.id, userId: bob.id, points: 200, accuracyMs: 1100 },
        { predictionId: charliePrediction.id, userId: charlie.id, points: 200, accuracyMs: 800 },
      ],
    });

    const topTwo = await getLeaderboard(undefined, 2);
    expect(topTwo).toHaveLength(2);
    expect(topTwo[0]?.totalPoints).toBe(200);
    expect(topTwo[1]?.totalPoints).toBe(200);
    expect(topTwo[0]?.userName).toBe("Bob");
    expect(topTwo[1]?.userName).toBe("Charlie");

    const allRows = await getLeaderboard(undefined, 10);
    expect(allRows).toHaveLength(3);
  });

  it("API /api/predictions отдает 401 для неавторизованного пользователя", async () => {
    mockedAuth.mockResolvedValue(null);

    const response = await getPredictionsApiRoute(new NextRequest("http://localhost:3000/api/predictions"));
    expect(response.status).toBe(401);
  });

  it("валидация матчей и событий блокирует некорректные payload", async () => {
    const { match } = await createLiveMatchWithPlayer();

    await expect(
      createMatch({
        title: "xx",
        sportType: SportType.CS2,
        streamUrl: "https://youtube.com/watch?v=bad",
        startTime: "not-date-time",
      })
    ).rejects.toThrow();

    await expect(
      createEventAndScore({
        matchId: match.id,
        type: "",
      })
    ).rejects.toThrow();
  });

  it("API /api/realtime/status возвращает параметры polling и лимиты", async () => {
    const response = await getRealtimeStatusRoute();
    const payload = (await response.json()) as {
      ready: boolean;
      limits: {
        predictionCooldownMs: number;
        predictionMaxCount: number;
        rateWindowSeconds: number;
      };
    };

    expect(response.status).toBe(200);
    expect(payload.ready).toBe(false);
    expect(payload.limits.predictionMaxCount).toBe(MATCH_PREDICTION_MAX_COUNT);
    expect(payload.limits.rateWindowSeconds).toBe(5);
  });
});
