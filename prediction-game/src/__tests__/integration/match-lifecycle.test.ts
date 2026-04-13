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

  it("инстантное предсказание не матчится с уже прошедшим событием", async () => {
    const match = await createMatch({
      title: "Past Event Match",
      sportType: SportType.CS2,
      streamUrl: "https://youtube.com/watch?v=past-event",
      startTime: new Date().toISOString(),
      externalId: "ext-past-event",
    });

    await prisma.match.update({
      where: { id: match.id },
      data: { status: MatchStatus.LIVE },
    });

    await prisma.event.create({
      data: {
        matchId: match.id,
        type: "kill",
        timestamp: new Date(Date.now() - 60_000),
        description: "Прошедшее событие",
      },
    });

    const predictionResult = await createPrediction(userId, {
      matchId: match.id,
      type: PredictionType.INSTANT,
    });
    expect(predictionResult.points).toBeNull();
    expect(predictionResult.matchedEvent).toBeNull();

    await createEventAndScore({
      matchId: match.id,
      type: "kill",
      timestamp: new Date(Date.now() + 10_000).toISOString(),
      description: "Ближайшее будущее событие",
    });

    const futureScore = await prisma.score.findFirst({
      where: { predictionId: predictionResult.prediction.id },
    });
    expect(futureScore).toBeTruthy();
  });

  it("учитывает временное окно для INTERVAL предсказания", async () => {
    const match = await createMatch({
      title: "Interval Match",
      sportType: SportType.CS2,
      streamUrl: "https://youtube.com/watch?v=interval",
      startTime: new Date().toISOString(),
      externalId: "ext-interval",
    });

    await prisma.match.update({
      where: { id: match.id },
      data: { status: MatchStatus.LIVE },
    });

    const outOfWindowPrediction = await createPrediction(userId, {
      matchId: match.id,
      type: PredictionType.INTERVAL,
      targetEvent: "kill",
      intervalSeconds: 10,
    });
    await prisma.prediction.update({
      where: { id: outOfWindowPrediction.prediction.id },
      data: { predictedAt: new Date(Date.now() - 15000) },
    });

    await createEventAndScore({
      matchId: match.id,
      type: "kill",
      description: "Событие вне окна",
    });

    const outOfWindowScore = await prisma.score.findFirst({
      where: { predictionId: outOfWindowPrediction.prediction.id },
    });
    expect(outOfWindowScore).toBeNull();

    const inWindowPrediction = await createPrediction(userId, {
      matchId: match.id,
      type: PredictionType.INTERVAL,
      targetEvent: "kill",
      intervalSeconds: 10,
    });
    await prisma.prediction.update({
      where: { id: inWindowPrediction.prediction.id },
      data: { predictedAt: new Date(Date.now() - 5000) },
    });

    await createEventAndScore({
      matchId: match.id,
      type: "kill",
      description: "Событие в окне",
    });

    const inWindowScore = await prisma.score.findFirst({
      where: { predictionId: inWindowPrediction.prediction.id },
    });
    expect(inWindowScore).toBeTruthy();
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
