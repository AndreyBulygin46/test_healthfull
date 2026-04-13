import { NextRequest, NextResponse } from "next/server";
import { MatchStatus, SportType } from "@prisma/client";
import { auth } from "@/lib/auth";
import { createMatch, getMatchList } from "@/lib/prediction-service";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);

  const status = searchParams.get("status");
  const sportType = searchParams.get("sportType");
  const take = Number(searchParams.get("take") || "20");

  const matches = await getMatchList({
    status:
      status && Object.values(MatchStatus).includes(status as MatchStatus)
        ? (status as MatchStatus)
        : undefined,
    sportType:
      sportType && Object.values(SportType).includes(sportType as SportType)
        ? (sportType as SportType)
        : undefined,
    take: Number.isNaN(take) ? 20 : Math.max(1, take),
  });

  return NextResponse.json(matches);
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }

    const body = await request.json();
    const match = await createMatch(body);

    return NextResponse.json(match, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Не удалось создать матч" },
      { status: 400 }
    );
  }
}
