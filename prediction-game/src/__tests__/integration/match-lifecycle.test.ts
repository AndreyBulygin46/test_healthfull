import { MatchStatus, PredictionType, SportType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  createMatch,
  createPrediction,
  createEventAndScore,
  deleteMatch,
  getMatchEvents,
  updateMatch,
  listPredictions,
} from "@/lib/prediction-service";

describe("Match lifecycle integration", () => {
  let userId: string;

  beforeEach(async () => {
    await prisma.score.deleteMany();
    await prisma.prediction.deleteMany();
    await prisma.event.deleteMany();
    await prisma.match.deleteMany();
    await prisma.user.deleteMany({
      where: { email: { contains: "lifecycle-test" } },
    });

    const user = await prisma.user.create({
      data: {
        email: "lifecycle-test-user@example.com",
        name: "Lifecycle User",
      },
    });
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("создает матч, редактирует и удаляет", async () => {
    const created = await createMatch({
      title: "Match A",
      sportType: SportType.CS2,
      streamUrl: "https://youtube.com/watch?v=test",
      startTime: new Date().toISOString(),
      externalId: "ext-1",
    });

    const updated = await updateMatch(created.id, {
      status: MatchStatus.LIVE,
      title: "Match A (LIVE)",
      sportType: SportType.CS2,
    });

    expect(updated.status).toBe(MatchStatus.LIVE);
    expect(updated.title).toBe("Match A (LIVE)");

    await deleteMatch(created.id);

    const match = await prisma.match.findUnique({ where: { id: created.id } });
    expect(match).toBeNull();
  });

  it("принимает datetime-local при создании и обновлении матча", async () => {
    const created = await createMatch({
      title: "Local Datetime Match",
      sportType: SportType.CS2,
      streamUrl: "https://youtube.com/watch?v=local-time",
      startTime: "2026-04-13T19:15",
      externalId: "ext-local-1",
    });

    const updated = await updateMatch(created.id, {
      startTime: "2026-04-13T20:00",
      endTime: "2026-04-13T22:00",
    });

    expect(created.id).toBeTruthy();
    expect(updated.startTime).toBeInstanceOf(Date);
    expect(updated.endTime).toBeInstanceOf(Date);
  });

  it("создает endpoint-сбор событий матча", async () => {
    const created = await createMatch({
      title: "Event Match",
      sportType: SportType.CS2,
      streamUrl: "https://youtube.com/watch?v=test2",
      startTime: new Date().toISOString(),
      externalId: "ext-2",
    });

    await prisma.event.createMany({
      data: [
        { matchId: created.id, type: "goal", timestamp: new Date(), description: "go!" },
        { matchId: created.id, type: "kill", timestamp: new Date(), description: "kill!" },
      ],
    });

    const events = await getMatchEvents(created.id, { take: 2 });
    expect(events).toHaveLength(2);
  });

  it("должен безопасно начислять только один score на prediction", async () => {
    const match = await createMatch({
      title: "Scoring Match",
      sportType: SportType.CS2,
      streamUrl: "https://youtube.com/watch?v=score",
      startTime: new Date().toISOString(),
      externalId: "ext-3",
    });

    await prisma.match.update({
      where: { id: match.id },
      data: { status: MatchStatus.LIVE },
    });

    await createPrediction(userId, {
      matchId: match.id,
      type: PredictionType.INSTANT,
    });

    await createEventAndScore({
      matchId: match.id,
      type: "GOAL",
      description: "Первое событие",
    });

    await createEventAndScore({
      matchId: match.id,
      type: "GOAL",
      description: "Повторное событие",
    });

    const scores = await prisma.score.findMany({
      where: { userId },
    });

    expect(scores).toHaveLength(1);
  });

  it("разделяет общий и персональный списки прогнозов по matchId и userId", async () => {
    const match = await createMatch({
      title: "Prediction Feed Match",
      sportType: SportType.CS2,
      streamUrl: "https://youtube.com/watch?v=feed",
      startTime: new Date().toISOString(),
      externalId: "ext-4",
    });

    await prisma.match.update({
      where: { id: match.id },
      data: { status: MatchStatus.LIVE },
    });

    const otherUser = await prisma.user.create({
      data: {
        email: "second-lifecycle-user@example.com",
        name: "Second Lifecycle User",
      },
    });

    await createPrediction(userId, {
      matchId: match.id,
      type: PredictionType.INSTANT,
    });
    await createPrediction(otherUser.id, {
      matchId: match.id,
      type: PredictionType.INSTANT,
    });

    const allPredictions = await listPredictions({ matchId: match.id });
    const myPredictions = await listPredictions({ matchId: match.id, userId });

    expect(allPredictions).toHaveLength(2);
    expect(myPredictions).toHaveLength(1);
    expect(myPredictions[0].userId).toBe(userId);
  });

  it("для футбола начисляет очки по типу события, а не по таймингу", async () => {
    const match = await createMatch({
      title: "Football Match",
      sportType: SportType.FOOTBALL,
      streamUrl: "https://youtube.com/watch?v=football",
      startTime: new Date().toISOString(),
      externalId: "ext-football-1",
    });

    await prisma.match.update({
      where: { id: match.id },
      data: { status: MatchStatus.LIVE },
    });

    await createPrediction(userId, {
      matchId: match.id,
      type: PredictionType.INSTANT,
    });

    const oldPredictionTime = new Date(Date.now() - 40_000);
    await prisma.prediction.updateMany({
      where: { matchId: match.id, userId },
      data: { predictedAt: oldPredictionTime },
    });

    await createEventAndScore({
      matchId: match.id,
      type: "goal",
      timestamp: new Date().toISOString(),
    });

    const score = await prisma.score.findFirst({
      where: { userId },
      orderBy: { calculatedAt: "desc" },
    });

    expect(score).toBeTruthy();
    expect(score?.points).toBe(100);
  });
});
