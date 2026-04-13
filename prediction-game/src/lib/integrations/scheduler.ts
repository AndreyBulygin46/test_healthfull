import { createMatch, createEventAndScore } from "@/lib/prediction-service";
import { FeedSource, NormalizedMatch, SyncSummary, fetchFeedData } from "@/lib/integrations/match-feed";
import { MatchStatus, SportType } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type UpsertMatchResult = {
  id: string;
  created: boolean;
};

export async function syncActiveSources(sources: FeedSource[]) {
  const summary: SyncSummary[] = [];

  for (const source of sources) {
    const result = await fetchFeedData(source);
    const { matches, events } = result;
    const matchIndex = new Map<string, string>();
    let created = 0;
    let updated = 0;
    let skipped = 0;
    let skippedEvents = 0;

    for (const normalizedMatch of matches) {
      const upserted = await upsertMatchFromFeed(normalizedMatch);
      if (!upserted) {
        skipped += 1;
        continue;
      }

      matchIndex.set(normalizedMatch.externalId, upserted.id);
      if (upserted.created) {
        created += 1;
      } else {
        updated += 1;
      }
    }

    for (const event of events) {
      const localMatchId = matchIndex.get(event.matchExternalId);
      if (!localMatchId) {
        continue;
      }

      const eventTimestamp = new Date(event.timestamp);
      if (Number.isNaN(eventTimestamp.getTime())) {
        skippedEvents += 1;
        continue;
      }

      const alreadyExists = await prisma.event.findFirst({
        where: {
          matchId: localMatchId,
          type: event.type,
          timestamp: eventTimestamp,
          description: event.description ?? null,
          player: event.player ?? null,
          team: event.team ?? null,
        },
        select: { id: true },
      });
      if (alreadyExists) {
        skippedEvents += 1;
        continue;
      }

      await createEventAndScore({
        matchId: localMatchId,
        type: event.type,
        timestamp: event.timestamp,
        description: event.description,
        player: event.player,
        team: event.team,
      });
    }

    summary.push({
      source,
      matches: matches.length,
      events: events.length,
      created,
      updated,
      skipped,
      skippedEvents,
    });
  }

  return summary;
}

export async function upsertMatchFromFeed(normalized: NormalizedMatch) {
  const existing = await prisma.match.findFirst({
    where: { externalId: normalized.externalId },
  });

  if (existing) {
    return updateExistingMatch(existing.id, normalized);
  }

  const created = await createMatch({
    title: normalized.title,
    sportType: normalized.sportType,
    streamUrl: normalized.streamUrl,
    startTime: normalized.startTime,
    externalId: normalized.externalId,
  });

  if (!created?.id) {
    return null;
  }

  return { id: created.id, created: true };
}

async function updateExistingMatch(
  matchId: string,
  normalized: Omit<NormalizedMatch, "externalId">
): Promise<UpsertMatchResult | null> {
  const match = await prisma.match.findUnique({
    where: { id: matchId },
    select: { id: true, status: true },
  });
  if (!match) return null;

  if (match.status === MatchStatus.CANCELLED) {
    return { id: match.id, created: false };
  }

  const updated = await prisma.match.update({
    where: { id: matchId },
    data: {
      title: normalized.title,
      sportType: normalized.sportType as SportType,
      streamUrl: normalized.streamUrl,
      startTime: new Date(normalized.startTime),
      status: normalized.status,
    },
  });

  return { id: updated.id, created: false };
}

