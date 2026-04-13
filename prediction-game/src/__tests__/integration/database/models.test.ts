import { prisma } from "@/lib/prisma";
import { MatchStatus, SportType } from "@prisma/client";

describe("Match Model Integration", () => {
  beforeEach(async () => {
    // Clean up before each test
    await prisma.prediction.deleteMany();
    await prisma.event.deleteMany();
    await prisma.leaderboardEntry.deleteMany();
    await prisma.match.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("создает матч с корректными данными", async () => {
    const match = await prisma.match.create({
      data: {
        title: "NAVI vs FaZe",
        sportType: SportType.CS2,
        streamUrl: "https://youtube.com/embed/test",
        status: MatchStatus.UPCOMING,
        startTime: new Date("2024-01-01T12:00:00Z"),
      },
    });

    expect(match.title).toBe("NAVI vs FaZe");
    expect(match.sportType).toBe(SportType.CS2);
    expect(match.status).toBe(MatchStatus.UPCOMING);
  });

  it("обновляет статус матча", async () => {
    const match = await prisma.match.create({
      data: {
        title: "Test Match",
        sportType: SportType.CS2,
        streamUrl: "https://test.com",
        status: MatchStatus.UPCOMING,
        startTime: new Date(),
      },
    });

    const updated = await prisma.match.update({
      where: { id: match.id },
      data: { status: MatchStatus.LIVE },
    });

    expect(updated.status).toBe(MatchStatus.LIVE);
  });

  it("создает матч с событиями", async () => {
    const match = await prisma.match.create({
      data: {
        title: "Match with Events",
        sportType: SportType.CS2,
        streamUrl: "https://test.com",
        status: MatchStatus.LIVE,
        startTime: new Date(),
        events: {
          create: [
            {
              type: "kill",
              timestamp: new Date(),
              description: "s1mple killed NiKo",
              player: "s1mple",
            },
            {
              type: "kill",
              timestamp: new Date(),
              description: "b1t killed rain",
              player: "b1t",
            },
          ],
        },
      },
      include: { events: true },
    });

    expect(match.events).toHaveLength(2);
    expect(match.events[0].type).toBe("kill");
  });

  it("создает матч с предсказаниями", async () => {
    const user = await prisma.user.create({
      data: {
        email: "test-match@example.com",
        name: "Test User",
      },
    });

    const match = await prisma.match.create({
      data: {
        title: "Match with Predictions",
        sportType: SportType.CS2,
        streamUrl: "https://test.com",
        status: MatchStatus.LIVE,
        startTime: new Date(),
        predictions: {
          create: [
            {
              userId: user.id,
              type: "INSTANT",
              predictedAt: new Date(),
            },
          ],
        },
      },
      include: { predictions: true },
    });

    expect(match.predictions).toHaveLength(1);
    expect(match.predictions[0].type).toBe("INSTANT");

    // Cleanup
    await prisma.prediction.deleteMany({ where: { userId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it("фильтрует матчи по статусу", async () => {
    await prisma.match.createMany({
      data: [
        {
          title: "Live Match",
          sportType: SportType.CS2,
          streamUrl: "https://test.com",
          status: MatchStatus.LIVE,
          startTime: new Date(),
        },
        {
          title: "Upcoming Match",
          sportType: SportType.CS2,
          streamUrl: "https://test.com",
          status: MatchStatus.UPCOMING,
          startTime: new Date(Date.now() + 86400000),
        },
        {
          title: "Finished Match",
          sportType: SportType.CS2,
          streamUrl: "https://test.com",
          status: MatchStatus.FINISHED,
          startTime: new Date(Date.now() - 86400000),
          endTime: new Date(),
        },
      ],
    });

    const liveMatches = await prisma.match.findMany({
      where: { status: MatchStatus.LIVE },
    });

    expect(liveMatches).toHaveLength(1);
    expect(liveMatches[0].title).toBe("Live Match");
  });

  it("удаляет матч каскадно", async () => {
    const match = await prisma.match.create({
      data: {
        title: "Match to Delete",
        sportType: SportType.CS2,
        streamUrl: "https://test.com",
        status: MatchStatus.UPCOMING,
        startTime: new Date(),
        events: {
          create: {
            type: "kill",
            timestamp: new Date(),
            description: "Test event",
          },
        },
      },
      include: { events: true },
    });

    const eventId = match.events[0].id;

    await prisma.match.delete({ where: { id: match.id } });

    // Verify event was also deleted
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    expect(event).toBeNull();
  });
});

describe("Prediction Model Integration", () => {
  let testUserId: string;
  let testMatchId: string;

  beforeEach(async () => {
    // Clean up
    await prisma.score.deleteMany();
    await prisma.prediction.deleteMany();
    await prisma.match.deleteMany();
    await prisma.user.deleteMany({
      where: { email: { contains: "test-prediction" } },
    });

    // Create test data
    const user = await prisma.user.create({
      data: {
        email: "test-prediction@example.com",
        name: "Test User",
      },
    });
    testUserId = user.id;

    const match = await prisma.match.create({
      data: {
        title: "Test Match",
        sportType: SportType.CS2,
        streamUrl: "https://test.com",
        status: MatchStatus.LIVE,
        startTime: new Date(),
      },
    });
    testMatchId = match.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("создает предсказание", async () => {
    const prediction = await prisma.prediction.create({
      data: {
        userId: testUserId,
        matchId: testMatchId,
        type: "INSTANT",
        predictedAt: new Date(),
      },
    });

    expect(prediction.userId).toBe(testUserId);
    expect(prediction.matchId).toBe(testMatchId);
    expect(prediction.type).toBe("INSTANT");
  });

  it("создает предсказание с очками", async () => {
    const prediction = await prisma.prediction.create({
      data: {
        userId: testUserId,
        matchId: testMatchId,
        type: "INSTANT",
        predictedAt: new Date(),
        score: {
          create: {
            userId: testUserId,
            points: 80,
            accuracyMs: 3000,
          },
        },
      },
      include: { score: true },
    });

    expect(prediction.score).toBeTruthy();
    expect(prediction.score?.points).toBe(80);
    expect(prediction.score?.accuracyMs).toBe(3000);
  });

  it("находит предсказания пользователя", async () => {
    await prisma.prediction.createMany({
      data: [
        {
          userId: testUserId,
          matchId: testMatchId,
          type: "INSTANT",
          predictedAt: new Date(),
        },
        {
          userId: testUserId,
          matchId: testMatchId,
          type: "INSTANT",
          predictedAt: new Date(Date.now() + 1000),
        },
      ],
    });

    const predictions = await prisma.prediction.findMany({
      where: { userId: testUserId },
    });

    expect(predictions).toHaveLength(2);
  });

  it("агрегирует очки пользователя", async () => {
    await prisma.prediction.create({
      data: {
        userId: testUserId,
        matchId: testMatchId,
        type: "INSTANT",
        predictedAt: new Date(),
        score: {
          create: {
            userId: testUserId,
            points: 100,
            accuracyMs: 500,
          },
        },
      },
    });

    await prisma.prediction.create({
      data: {
        userId: testUserId,
        matchId: testMatchId,
        type: "INSTANT",
        predictedAt: new Date(),
        score: {
          create: {
            userId: testUserId,
            points: 80,
            accuracyMs: 3000,
          },
        },
      },
    });

    const aggregate = await prisma.score.aggregate({
      where: { userId: testUserId },
      _sum: { points: true },
    });

    expect(aggregate._sum.points).toBe(180);
  });
});

describe("Leaderboard Integration", () => {
  beforeEach(async () => {
    await prisma.leaderboardEntry.deleteMany();
    await prisma.user.deleteMany({ where: { email: { contains: "test-lb" } } });
    await prisma.match.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("создает запись лидерборда", async () => {
    const user = await prisma.user.create({
      data: {
        email: "test-lb@example.com",
        name: "LB Test User",
      },
    });

    const match = await prisma.match.create({
      data: {
        title: "LB Test Match",
        sportType: SportType.CS2,
        streamUrl: "https://test.com",
        status: MatchStatus.FINISHED,
        startTime: new Date(),
        endTime: new Date(),
      },
    });

    const entry = await prisma.leaderboardEntry.create({
      data: {
        userId: user.id,
        matchId: match.id,
        totalPoints: 500,
        matchesPlayed: 1,
        rank: 1,
        period: "all_time",
      },
    });

    expect(entry.totalPoints).toBe(500);
    expect(entry.rank).toBe(1);

    // Cleanup
    await prisma.leaderboardEntry.delete({ where: { id: entry.id } });
    await prisma.match.delete({ where: { id: match.id } });
    await prisma.user.delete({ where: { id: user.id } });
  });

  it("сортирует глобальный лидерборд", async () => {
    const users = await Promise.all([
      prisma.user.create({ data: { email: "lb1@example.com", name: "User1" } }),
      prisma.user.create({ data: { email: "lb2@example.com", name: "User2" } }),
      prisma.user.create({ data: { email: "lb3@example.com", name: "User3" } }),
    ]);

    await prisma.leaderboardEntry.createMany({
      data: [
        { userId: users[0].id, totalPoints: 100, matchesPlayed: 5, period: "all_time" },
        { userId: users[1].id, totalPoints: 300, matchesPlayed: 3, period: "all_time" },
        { userId: users[2].id, totalPoints: 200, matchesPlayed: 4, period: "all_time" },
      ],
    });

    const leaderboard = await prisma.leaderboardEntry.findMany({
      where: { period: "all_time" },
      orderBy: { totalPoints: "desc" },
      include: { user: true },
    });

    expect(leaderboard).toHaveLength(3);
    expect(leaderboard[0].totalPoints).toBe(300);
    expect(leaderboard[1].totalPoints).toBe(200);
    expect(leaderboard[2].totalPoints).toBe(100);
  });
});
