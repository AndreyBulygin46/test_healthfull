import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { listPredictions } from "@/lib/prediction-service";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id: matchId } = await context.params;
  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") || "all";
  const requestedLimit = Number(searchParams.get("limit") || "50");
  const limit = Number.isNaN(requestedLimit) ? 50 : requestedLimit;

  if (scope === "mine") {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
    }

    const predictions = await listPredictions({
      matchId,
      userId: session.user.id,
    });

    return NextResponse.json(predictions.slice(0, limit));
  }

  const predictions = await listPredictions({
    matchId,
  });

  const publicPredictions = predictions.map((prediction) => {
    const { user, ...rest } = prediction;
    return {
      ...rest,
      user: user
        ? {
            id: user.id,
            name: user.name ?? "Аноним",
          }
        : null,
    };
  });

  return NextResponse.json(publicPredictions.slice(0, limit));
}
