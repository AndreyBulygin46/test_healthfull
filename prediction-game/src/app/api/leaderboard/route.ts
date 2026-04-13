import { NextRequest, NextResponse } from "next/server";
import { getLeaderboard } from "@/lib/prediction-service";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const matchId = searchParams.get("matchId") || undefined;
  const limit = Number(searchParams.get("limit") || "20");

  return NextResponse.json(
    await getLeaderboard(matchId, Number.isNaN(limit) ? 20 : limit)
  );
}
