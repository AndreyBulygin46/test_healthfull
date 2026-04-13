import { MatchStatus, Prisma, PredictionType, SportType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { calculateEventScore, validatePrediction } from "@/lib/scoring";
import {
  createEventSchema,
  createMatchSchema,
  createPredictionSchema,
  MATCH_PREDICTION_COOLDOWN_MS,
  MATCH_PREDICTION_MAX_COUNT,
  matchEventsQuerySchema,
  updateMatchSchema,
} from "@/lib/validation";
import {
  emitLeaderboardUpdate,
  emitMatchRoomEvent,
  emitUserResult,
} from "@/lib/realtime/socket";

type MatchFilters = {
  status?: MatchStatus | string;
  sportType?: string;
  take?: number;
};

type MatchDetails = NonNullable<
  Awaited<ReturnType<typeof prisma.match.findUnique>>
>;

export async function getMatchList(filters: MatchFilters = {}) {
  const where: Prisma.MatchWhereInput = {};

  if (filters.status) {
    where.status = filters.status as MatchStatus;
  }

  if (filters.sportType) {
    where.sportType = filters.sportType;
  }

  return prisma.match.findMany({
    where,
    orderBy: { startTime: "asc" },
    take: filters.take ?? 20,
    include: {
      _count: {
        select: { events: true, predictions: true },
      },
    },
  });
}

export async function getMatchById(matchId: string) {
  return prisma.match.findUnique({
    where: { id: matchId },
    include: {
      events: {
        orderBy: { timestamp: "asc" },
      },
      predictions: {
        take: 20,
        orderBy: { predictedAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
          score: true,
        },
      },
    },
  }) as Promise<MatchDetails | null>;
}

export async function getMatchEvents(matchId: string, query: { take?: number } = {}) {
  const parsed = matchEventsQuerySchema.safeParse(query);
  const take = parsed.success ? parsed.data.take : undefined;

  return getMatchById(matchId).then((match) => {
    if (!match) {
      return [];
    }

    return prisma.event.findMany({
      where: { matchId },
      orderBy: { timestamp: "asc" },
      take,
    });
  });
}

function parseIntervalSeconds(metadata?: string | null): number | null {
  if (!metadata) {
    return null;
  }

  try {
    const payload = JSON.parse(metadata) as { intervalSeconds?: unknown };
    if (typeof payload?.intervalSeconds === "number" && Number.isFinite(payload.intervalSeconds)) {
      return payload.intervalSeconds;
    }
  } catch {
    return null;
  }

  return null;
}

function isWithinIntervalPredictionWindow(
  predictionType: PredictionType,
  predictionMetadata: string | null,
  predictedAt: Date,
  eventTimestamp: Date
) {
  if (predictionType !== "INTERVAL") {
    return true;
  }

  const intervalSeconds = parseIntervalSeconds(predictionMetadata);
  if (!intervalSeconds || intervalSeconds <= 0) {
    return true;
  }

  const deltaMs = eventTimestamp.getTime() - predictedAt.getTime();
  return deltaMs >= 0 && deltaMs <= intervalSeconds * 1000;
}

export async function createMatch(input: unknown) {
  const parsed = createMatchSchema.safeParse(input);

  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Неверные данные матча");
  }

  const { title, sportType, streamUrl, startTime, endTime, externalId } = parsed.data;

  return prisma.match.create({
    data: {
      title,
      sportType,
      streamUrl,
      startTime: new Date(startTime),
      endTime: endTime ? new Date(endTime) : undefined,
      externalId,
    },
  });
}

export async function updateMatch(matchId: string, input: unknown) {
  const parsed = updateMatchSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Неверные данные матча");
  }

  const current = await prisma.match.findUnique({ where: { id: matchId } });
  if (!current) {
    throw new Error("Матч не найден");
  }

  const { title, sportType, streamUrl, status, startTime, endTime, externalId } = parsed.data;

  if (current.status === MatchStatus.FINISHED && status && status !== MatchStatus.FINISHED) {
    throw new Error("Нельзя изменять статус завершенного матча");
  }

  const matchData: Prisma.MatchUpdateInput = {};
  if (title) matchData.title = title;
  if (sportType) matchData.sportType = sportType as SportType;
  if (streamUrl) matchData.streamUrl = streamUrl;
  if (status) matchData.status = status;
  if (startTime) matchData.startTime = new Date(startTime);
  if (typeof endTime === "string") matchData.endTime = new Date(endTime);
  if (endTime === null) matchData.endTime = null;
  if (externalId !== undefined) {
    matchData.externalId = externalId;
  }

  if (status === MatchStatus.FINISHED && !matchData.endTime) {
    matchData.endTime = new Date();
  }

  const updated = await prisma.match.update({
    where: { id: matchId },
    data: matchData,
  });

  emitMatchRoomEvent(matchId, "match:update", {
    type: "match:updated",
    status: updated.status,
  });

  return updated;
}

export async function deleteMatch(matchId: string) {
  const match = await prisma.match.findUnique({ where: { id: matchId } });
  if (!match) {
    throw new Error("Матч не найден");
  }

  const removed = await prisma.match.delete({ where: { id: matchId } });

  emitMatchRoomEvent(matchId, "match:update", {
    type: "match:deleted",
  });

  return removed;
}

export async function createPrediction(userId: string, input: unknown) {
  const parsed = createPredictionSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Неверные данные предсказания");
  }

  const { matchId, type, targetEvent, intervalSeconds } = parsed.data;

  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: {
      id: true,
      sportType: true,
      status: true,
      endTime: true,
    },
  });

  if (!match) {
    throw new Error("Матч не найден");
  }

  const lastPrediction = await prisma.prediction.findFirst({
    where: { matchId, userId },
    orderBy: { predictedAt: "desc" },
    select: { predictedAt: true },
  });

  const predictionsCount = await prisma.prediction.count({
    where: { matchId, userId },
  });

  const validation = validatePrediction(
    match.status,
    lastPrediction?.predictedAt ?? null,
    predictionsCount,
    MATCH_PREDICTION_MAX_COUNT,
    MATCH_PREDICTION_COOLDOWN_MS
  );

  if (!validation.valid) {
    throw new Error(validation.error ?? "Предсказание недоступно");
  }

  if (type === "INTERVAL" && intervalSeconds && intervalSeconds > 0 && !targetEvent) {
    throw new Error("Для INTERVAL необходимо указать целевое событие");
  }
  if (match.endTime && new Date(match.endTime).getTime() <= Date.now()) {
    throw new Error("Матч завершен");
  }

  const result = await prisma.$transaction(async (tx) => {
    const metadata = type === "INTERVAL" && intervalSeconds
      ? JSON.stringify({ intervalSeconds })
      : undefined;
    const predictedAt = new Date();

    const prediction = await tx.prediction.create({
      data: {
        matchId,
        userId,
        type: type as PredictionType,
        targetEvent,
        predictedAt,
        metadata,
      },
    });

    const matchedEvent = await tx.event.findFirst({
      where: {
        matchId,
        ...(targetEvent ? { type: targetEvent } : {}),
        timestamp: {
          gte: predictedAt,
        },
      },
      orderBy: { timestamp: "asc" },
    });

    const canScoreByInterval = isWithinIntervalPredictionWindow(
      prediction.type,
      prediction.metadata,
      prediction.predictedAt,
      matchedEvent?.timestamp ?? new Date()
    );

    if (!matchedEvent || !canScoreByInterval) {
      emitMatchRoomEvent(matchId, "match:update", {
        type: "prediction:created",
        predictionId: prediction.id,
        userId,
      });
      return {
        prediction,
        points: null,
        matchedEvent: null,
      };
    }

    const { points, accuracyMs } = calculateEventScore(
      match.sportType,
      matchedEvent.type,
      prediction.predictedAt,
      matchedEvent.timestamp
    );

    const score = await tx.score.create({
      data: {
        predictionId: prediction.id,
        userId,
        points,
        accuracyMs,
      },
    });

    return {
      prediction: {
        ...prediction,
        score,
      },
      points,
      matchedEvent,
    };
  });

  emitMatchRoomEvent(matchId, "match:update", {
    type: "prediction:result",
    predictionId: result.prediction.id,
    points: result.points,
  });

  if (result.points !== null && result.prediction?.id && result.matchedEvent) {
    emitUserResult(userId, {
      matchId,
      predictionId: result.prediction.id,
      points: result.points,
      eventType: result.matchedEvent.type,
    });
    emitLeaderboardUpdate();
  }

  return result;
}

export async function listPredictions(input: {
  matchId?: string;
  userId?: string;
}) {
  const where: Prisma.PredictionWhereInput = {};

  if (input.matchId) {
    where.matchId = input.matchId;
  }

  if (input.userId) {
    where.userId = input.userId;
  }

  return prisma.prediction.findMany({
    where,
    orderBy: { predictedAt: "desc" },
    include: {
      match: {
        select: {
          id: true,
          title: true,
          sportType: true,
        },
      },
      user: {
        select: { id: true, name: true, email: true },
      },
      score: true,
    },
  });
}

export async function createEventAndScore(input: unknown) {
  const parsed = createEventSchema.safeParse(input);
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? "Неверные данные события");
  }

  const { matchId, type, timestamp, description, player, team } = parsed.data;

  return prisma.$transaction(async (tx) => {
    const match = await tx.match.findUnique({
      where: { id: matchId },
      select: { sportType: true },
    });
    if (!match) {
      throw new Error("Матч не найден");
    }

    const event = await tx.event.create({
      data: {
        matchId,
        type,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
        description,
        player,
        team,
      },
    });

    const pendingPredictions = await tx.prediction.findMany({
      where: {
        matchId,
        score: null,
        OR: [{ targetEvent: null }, { targetEvent: type }],
      },
    });

    if (pendingPredictions.length === 0) {
      return event;
    }

    const payload = pendingPredictions
      .filter((prediction) =>
        prediction.targetEvent ? prediction.targetEvent === type : true
      )
      .filter((prediction) =>
        isWithinIntervalPredictionWindow(
          prediction.type as PredictionType,
          prediction.metadata,
          prediction.predictedAt,
          event.timestamp
        )
      )
      .map((prediction) => {
        const { points, accuracyMs } = calculateEventScore(
          match.sportType,
          type,
          prediction.predictedAt,
          event.timestamp
        );

        return {
          predictionId: prediction.id,
          userId: prediction.userId,
          points,
          accuracyMs,
        };
      });

    if (payload.length > 0) {
      await tx.score.createMany({
        data: payload,
      });
    }

    if (payload.length > 0) {
      emitMatchRoomEvent(matchId, "match:event", {
        eventType: type,
        eventId: event.id,
        count: payload.length,
      });
      emitLeaderboardUpdate();

      for (const item of payload) {
        emitUserResult(item.userId, {
          matchId,
          predictionId: item.predictionId,
          points: item.points,
        });
      }
    } else {
      emitMatchRoomEvent(matchId, "match:event", {
        eventType: type,
        eventId: event.id,
        count: 0,
      });
    }

    return event;
  });
}

export async function getLeaderboard(matchId?: string, limit = 20) {
  const scoreWhere: Prisma.ScoreWhereInput = {};
  if (matchId) {
    scoreWhere.prediction = { matchId };
  }

  const totals = await prisma.score.groupBy({
    by: ["userId"],
    where: scoreWhere,
    _sum: { points: true },
  });

  if (totals.length === 0) {
    return [];
  }

  const userIds = totals.map((item) => item.userId);
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, email: true },
  });

  const playedMatches = await prisma.prediction.groupBy({
    by: ["userId", "matchId"],
    where: {
      userId: { in: userIds },
      score: { isNot: null },
      ...(matchId ? { matchId } : {}),
    },
  });

  const matchesPlayedByUser = new Map<string, number>();
  for (const item of playedMatches) {
    matchesPlayedByUser.set(
      item.userId,
      (matchesPlayedByUser.get(item.userId) ?? 0) + 1
    );
  }

  const usersById = new Map(users.map((user) => [user.id, user]));

  const sorted = totals
    .map((item) => ({
      userId: item.userId,
      totalPoints: item._sum.points ?? 0,
      matchesPlayed: matchesPlayedByUser.get(item.userId) ?? 0,
      user: usersById.get(item.userId),
    }))
    .filter((item) => item.user)
    .sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      return (a.user?.name ?? "").localeCompare(b.user?.name ?? "");
    })
    .slice(0, limit)
    .map((item, index) => ({
      rank: index + 1,
      userId: item.userId,
      userName: item.user?.name ?? item.user?.email ?? "Аноним",
      totalPoints: item.totalPoints,
      matchesPlayed: item.matchesPlayed,
      period: matchId ? "match" : "all_time",
      matchId: matchId ?? null,
    }));

  return sorted;
}
