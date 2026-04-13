import { getLeaderboard } from "@/lib/prediction-service";
import { LeaderboardClient } from "./leaderboard-client";

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams?: { matchId?: string };
}) {
  const matchId = searchParams?.matchId || undefined;
  const leaderboard = await getLeaderboard(matchId, 50);

  return (
    <LeaderboardClient initialLeaderboard={leaderboard} matchId={matchId} />
  );
}
