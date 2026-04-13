import { NextResponse } from "next/server";
import { getRealtimeBus, realtimeLimits } from "@/lib/realtime/socket";

export async function GET() {
  const rateWindowSeconds = Math.ceil(realtimeLimits.predictionCooldownMs / 1000);

  return NextResponse.json({
    ...getRealtimeBus().getStatus(),
    limits: {
      predictionCooldownMs: realtimeLimits.predictionCooldownMs,
      predictionMaxCount: realtimeLimits.predictionMaxCount,
      rateWindowSeconds,
    },
  });
}
