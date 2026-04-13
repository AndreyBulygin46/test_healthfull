import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createPrediction, listPredictions } from "@/lib/prediction-service";

export async function GET(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const matchId = searchParams.get("matchId") || undefined;
  const limit = Number(searchParams.get("limit") || "50");

  const predictions = await listPredictions({
    matchId,
    userId: session.user.id,
  });

  return NextResponse.json(
    limit && !Number.isNaN(limit) ? predictions.slice(0, limit) : predictions
  );
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Требуется авторизация" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const created = await createPrediction(session.user.id, body);

    return NextResponse.json(created, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось создать предсказание" },
      { status: 400 }
    );
  }
}
