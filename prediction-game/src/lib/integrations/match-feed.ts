import { MatchStatus, SportType } from "@prisma/client";

export type FeedSource = "pandascore" | "api-football";

type RawMatchPayload = {
  id: string;
  title: string;
  sport: string;
  streamUrl: string;
  startTime: string;
  status?: string;
};

type RawEventPayload = {
  type: string;
  timestamp: string;
  description?: string;
  player?: string;
  team?: string;
};

export type NormalizedMatch = {
  externalId: string;
  title: string;
  sportType: SportType;
  streamUrl: string;
  startTime: string;
  status: MatchStatus;
};

export type NormalizedEvent = {
  matchExternalId: string;
  type: string;
  timestamp: string;
  description?: string;
  player?: string;
  team?: string;
};

export interface FeedResult {
  matches: NormalizedMatch[];
  events: NormalizedEvent[];
}

export type SyncSummary = {
  source: FeedSource;
  matches: number;
  events: number;
  created: number;
  updated: number;
  skipped: number;
  skippedEvents?: number;
};

export const INTEGRATION_MODE = "mock-first";

export interface MatchFeedAdapter {
  fetchMatches(): Promise<RawMatchPayload[]>;
  fetchEvents(matchId: string): Promise<RawEventPayload[]>;
}

function mapSportType(sport: string): SportType {
  const normalized = sport.toUpperCase();
  if (normalized.includes("DOTA")) return SportType.DOTA2;
  if (normalized.includes("VALORANT")) return SportType.VALORANT;
  if (normalized.includes("FOOTBALL")) return SportType.FOOTBALL;
  return SportType.CS2;
}

function mapStatus(status?: string): MatchStatus {
  if (!status) return MatchStatus.UPCOMING;

  if (status.toLowerCase().includes("live")) return MatchStatus.LIVE;
  if (status.toLowerCase().includes("finished") || status.toLowerCase().includes("ended")) return MatchStatus.FINISHED;
  if (status.toLowerCase().includes("cancel")) return MatchStatus.CANCELLED;
  return MatchStatus.UPCOMING;
}

class PandaScoreAdapter implements MatchFeedAdapter {
  async fetchMatches(): Promise<RawMatchPayload[]> {
    return [];
  }

  async fetchEvents(matchId: string): Promise<RawEventPayload[]> {
    void matchId;
    return [];
  }
}

// Demo football matches data
const DEMO_FOOTBALL_MATCHES: RawMatchPayload[] = [
  {
    id: "football-demo-1",
    title: "Real Madrid vs Barcelona - La Liga",
    sport: "football",
    streamUrl: "https://www.youtube.com/embed/demo-football-1",
    startTime: new Date().toISOString(),
    status: "live",
  },
  {
    id: "football-demo-2",
    title: "Manchester City vs Liverpool - Premier League",
    sport: "football",
    streamUrl: "https://www.youtube.com/embed/demo-football-2",
    startTime: new Date(Date.now() + 3600000).toISOString(),
    status: "upcoming",
  },
  {
    id: "football-demo-3",
    title: "Bayern Munich vs Borussia Dortmund - Bundesliga",
    sport: "football",
    streamUrl: "https://www.youtube.com/embed/demo-football-3",
    startTime: new Date(Date.now() - 7200000).toISOString(),
    status: "finished",
  },
];

// Demo football events data
const DEMO_FOOTBALL_EVENTS: Record<string, RawEventPayload[]> = {
  "football-demo-1": [
    {
      type: "goal",
      timestamp: new Date(Date.now() - 300000).toISOString(),
      description: "Vinicius Junior scores!",
      player: "Vinicius Junior",
      team: "Real Madrid",
    },
    {
      type: "yellow_card",
      timestamp: new Date(Date.now() - 600000).toISOString(),
      description: "Yellow card for rough tackle",
      player: "Sergio Busquets",
      team: "Barcelona",
    },
    {
      type: "substitution",
      timestamp: new Date(Date.now() - 900000).toISOString(),
      description: "Tactical substitution",
      player: "Luka Modric",
      team: "Real Madrid",
    },
  ],
  "football-demo-2": [],
  "football-demo-3": [
    {
      type: "goal",
      timestamp: new Date(Date.now() - 7200000).toISOString(),
      description: "Harry Kane header!",
      player: "Harry Kane",
      team: "Bayern Munich",
    },
    {
      type: "goal",
      timestamp: new Date(Date.now() - 7000000).toISOString(),
      description: "Penalty converted!",
      player: "Erling Haaland",
      team: "Borussia Dortmund",
    },
    {
      type: "red_card",
      timestamp: new Date(Date.now() - 6500000).toISOString(),
      description: "Red card for violent conduct",
      player: "Marco Reus",
      team: "Borussia Dortmund",
    },
  ],
};

class ApiFootballAdapter implements MatchFeedAdapter {
  async fetchMatches(): Promise<RawMatchPayload[]> {
    // Return demo football matches
    return DEMO_FOOTBALL_MATCHES;
  }

  async fetchEvents(matchId: string): Promise<RawEventPayload[]> {
    // Return demo events for the given match
    return DEMO_FOOTBALL_EVENTS[matchId] || [];
  }
}

const adapters: Record<FeedSource, MatchFeedAdapter> = {
  "pandascore": new PandaScoreAdapter(),
  "api-football": new ApiFootballAdapter(),
};

export async function fetchFeedData(source: FeedSource): Promise<FeedResult> {
  const adapter = adapters[source];
  const rawMatches = await adapter.fetchMatches();
  const normalizedMatches = rawMatches.map((item): NormalizedMatch => ({
    externalId: item.id,
    title: item.title,
    sportType: mapSportType(item.sport),
    streamUrl: item.streamUrl,
    startTime: item.startTime,
    status: mapStatus(item.status),
  }));

  const rawEvents = await Promise.all(
    rawMatches.map(async (match) => {
      const events = await adapter.fetchEvents(match.id);
      return events.map((event) => ({
        matchExternalId: match.id,
        ...event,
      }));
    })
  );

  return {
    matches: normalizedMatches,
    events: rawEvents.flat(),
  };
}

export async function syncFromSource(source: FeedSource): Promise<SyncSummary> {
  const payload = await fetchFeedData(source);
  return {
    source,
    matches: payload.matches.length,
    events: payload.events.length,
    created: 0,
    updated: 0,
    skipped: 0,
  };
}
