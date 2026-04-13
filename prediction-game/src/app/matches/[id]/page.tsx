import { notFound } from "next/navigation";
import { auth } from "@/lib/auth";
import { getMatchById } from "@/lib/prediction-service";
import { MatchClientPage } from "./match-page-client";

type MatchPageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ message?: string }>;
};

export default async function MatchPage({ params, searchParams }: MatchPageProps) {
  const { id } = await params;
  const match = await getMatchById(id);
  const session = await auth();

  if (!match) {
    notFound();
  }

  const resolvedSearchParams = await searchParams;
  const message = resolvedSearchParams?.message ? decodeURIComponent(resolvedSearchParams.message) : null;

  const serializableMatch = {
    id: match.id,
    title: match.title,
    status: match.status,
    sportType: match.sportType,
    streamUrl: match.streamUrl,
    startTime: match.startTime.toISOString(),
    endTime: match.endTime ? match.endTime.toISOString() : null,
    events: match.events.map((event) => ({
      id: event.id,
      type: event.type,
      timestamp: event.timestamp.toISOString(),
      description: event.description,
      player: event.player,
      team: event.team,
    })),
    predictions: match.predictions.map((prediction) => ({
      id: prediction.id,
      userName: prediction.user?.name || prediction.user?.email || "Аноним",
      predictedAt: prediction.predictedAt.toISOString(),
      targetEvent: prediction.targetEvent,
      points: prediction.score?.points ?? null,
      accuracyMs: prediction.score?.accuracyMs ?? null,
      userId: prediction.userId,
    })),
  };

  return (
    <MatchClientPage
      match={serializableMatch}
      sessionUser={
        session?.user
          ? {
              id: session.user.id,
              name: session.user.name,
              email: session.user.email ?? "",
            }
          : null
      }
      initialMessage={message}
    />
  );
}
