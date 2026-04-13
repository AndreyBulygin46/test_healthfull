const { PrismaClient, UserRole, MatchStatus, SportType } = require("@prisma/client");
const { PrismaBetterSqlite3 } = require("@prisma/adapter-better-sqlite3");
const { hash } = require("bcryptjs");

const databaseUrl = process.env.DATABASE_URL || "file:./prisma/dev.db";
const adapter = new PrismaBetterSqlite3({ url: databaseUrl });
const prisma = new PrismaClient({ adapter });

async function main() {
  const adminPassword = await hash("admin123456", 10);
  await prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {
      name: "Admin",
      role: UserRole.ADMIN,
      password: adminPassword,
    },
    create: {
      email: "admin@example.com",
      name: "Admin",
      role: UserRole.ADMIN,
      password: adminPassword,
    },
  });

  const existingUser = await prisma.user.findUnique({
    where: { email: "player@example.com" },
  });
  if (!existingUser) {
    const playerPassword = await hash("player123456", 10);
    await prisma.user.create({
      data: {
        email: "player@example.com",
        name: "Player",
        password: playerPassword,
      },
    });
  }

  const liveMatch = await prisma.match.upsert({
    where: { externalId: "seed-live-match" },
    update: {
      status: MatchStatus.LIVE,
      title: "Seed Live Match",
      streamUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    },
    create: {
      externalId: "seed-live-match",
      title: "Seed Live Match",
      sportType: SportType.CS2,
      streamUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      startTime: new Date(Date.now() - 5 * 60 * 1000),
      status: MatchStatus.LIVE,
    },
  });

  const upcomingMatch = await prisma.match.upsert({
    where: { externalId: "seed-upcoming-match" },
    update: {
      status: MatchStatus.UPCOMING,
      title: "Seed Upcoming Match",
      streamUrl: "https://www.youtube.com/watch?v=oHg5SJYRHA0",
    },
    create: {
      externalId: "seed-upcoming-match",
      title: "Seed Upcoming Match",
      sportType: SportType.FOOTBALL,
      streamUrl: "https://www.youtube.com/watch?v=oHg5SJYRHA0",
      startTime: new Date(Date.now() + 60 * 60 * 1000),
      status: MatchStatus.UPCOMING,
    },
  });

  await prisma.event.upsert({
    where: { id: "seed-event-live-1" },
    update: {
      matchId: liveMatch.id,
      type: "start",
      timestamp: new Date(),
    },
    create: {
      id: "seed-event-live-1",
      matchId: liveMatch.id,
      type: "start",
      timestamp: new Date(),
      description: "Событие создано из seed",
      player: "seed-bot",
    },
  });

  await prisma.event.upsert({
    where: { id: "seed-event-upcoming-1" },
    update: {
      matchId: upcomingMatch.id,
      type: "pre-game",
      timestamp: new Date(Date.now() + 50 * 60 * 1000),
    },
    create: {
      id: "seed-event-upcoming-1",
      matchId: upcomingMatch.id,
      type: "pre-game",
      timestamp: new Date(Date.now() + 50 * 60 * 1000),
      description: "Подготовка к старту",
    },
  });
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => {
    return prisma.$disconnect();
  });
