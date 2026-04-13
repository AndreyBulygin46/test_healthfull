import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createEventAndScore } from "@/lib/prediction-service";

export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Требуется авторизация" },
        { status: 401 }
      );
    }

    if (session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
    }

    const body = await request.json();
    const event = await createEventAndScore(body);

    return NextResponse.json(event, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Не удалось создать событие",
      },
      { status: 400 }
    );
  }
}
