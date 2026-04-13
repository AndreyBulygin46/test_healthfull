import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { syncActiveSources } from "@/lib/integrations/scheduler";
import { FeedSource, syncFromSource } from "@/lib/integrations/match-feed";

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Требуется авторизация" }, { status: 401 });
  }
  if (session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const source = body?.source;
  const dryRun = Boolean(body?.dryRun);

  if (source && !isFeedSource(source)) {
    return NextResponse.json({ error: "Неизвестный источник" }, { status: 400 });
  }

  if (source) {
    const sourcesToRun = [source] as FeedSource[];
    if (dryRun) {
      const payload = await syncFromSource(source as FeedSource);
      return NextResponse.json({ dryRun, payload: [payload] });
    }

    const payload = await syncActiveSources(sourcesToRun);
    return NextResponse.json({ dryRun, payload });
  }

  const sources = ["pandascore", "api-football"] as FeedSource[];
  if (dryRun) {
    const payload = await Promise.all(sources.map((sourceId) => syncFromSource(sourceId)));
    return NextResponse.json({ dryRun, payload });
  }

  const payload = await syncActiveSources(sources);
  return NextResponse.json({ dryRun, payload });
}

function isFeedSource(value: unknown): value is FeedSource {
  return value === "pandascore" || value === "api-football";
}
