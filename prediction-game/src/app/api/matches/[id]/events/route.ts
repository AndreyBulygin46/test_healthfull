import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { getMatchById, getMatchEvents } from "@/lib/prediction-service";

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const match = await getMatchById(context.params.id);
  if (!match) {
    return NextResponse.json({ error: "Матч не найден" }, { status: 404 });
  }

  const { searchParams } = new URL(request.url);
  const take = Number(searchParams.get("take") || "0");
  const events = await getMatchEvents(match.id, { take: Number.isNaN(take) ? undefined : take });
  const user = await auth();

  return NextResponse.json({
    matchId: match.id,
    events,
    canManage: user?.user?.role === "ADMIN",
  });
}
