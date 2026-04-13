import {
  loginSchema,
  registerSchema,
  createMatchSchema,
  updateMatchSchema,
  createPredictionSchema,
  createEventSchema,
  createFootballEventSchema,
  FOOTBALL_EVENT_TYPES,
} from "@/lib/validation";

describe("loginSchema", () => {
  it("валидирует корректные данные", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "password123",
    });

    expect(result.success).toBe(true);
  });

  it("отклоняет невалидный email", () => {
    const result = loginSchema.safeParse({
      email: "invalid-email",
      password: "password123",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Введите корректный email");
    }
  });

  it("отклоняет короткий пароль", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "12345",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "Пароль должен быть минимум 6 символов"
      );
    }
  });

  it("отклоняет пустой email", () => {
    const result = loginSchema.safeParse({
      email: "",
      password: "password123",
    });

    expect(result.success).toBe(false);
  });

  it("отклоняет пустой пароль", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "",
    });

    expect(result.success).toBe(false);
  });
});

describe("registerSchema", () => {
  it("валидирует корректные данные", () => {
    const result = registerSchema.safeParse({
      name: "Иван",
      email: "ivan@example.com",
      password: "password123",
    });

    expect(result.success).toBe(true);
  });

  it("отклоняет короткое имя", () => {
    const result = registerSchema.safeParse({
      name: "I",
      email: "ivan@example.com",
      password: "password123",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "Имя должно быть минимум 2 символа"
      );
    }
  });

  it("отклоняет невалидный email", () => {
    const result = registerSchema.safeParse({
      name: "Иван",
      email: "not-an-email",
      password: "password123",
    });

    expect(result.success).toBe(false);
  });

  it("отклоняет короткий пароль", () => {
    const result = registerSchema.safeParse({
      name: "Иван",
      email: "ivan@example.com",
      password: "12345",
    });

    expect(result.success).toBe(false);
  });

  it("отклоняет пустое имя", () => {
    const result = registerSchema.safeParse({
      name: "",
      email: "ivan@example.com",
      password: "password123",
    });

    expect(result.success).toBe(false);
  });
});

describe("createMatchSchema", () => {
  it("валидирует корректные данные", () => {
    const result = createMatchSchema.safeParse({
      title: "NAVI vs FaZe",
      sportType: "CS2",
      streamUrl: "https://youtube.com/embed/test",
      startTime: "2024-01-01T12:00:00Z",
    });

    expect(result.success).toBe(true);
  });

  it("валидирует все типы спорта", () => {
    const sportTypes = ["CS2", "FOOTBALL", "DOTA2", "VALORANT"];

    sportTypes.forEach((sportType) => {
      const result = createMatchSchema.safeParse({
        title: "Test Match",
        sportType,
        streamUrl: "https://example.com/stream",
        startTime: "2024-01-01T12:00:00Z",
      });

      expect(result.success).toBe(true);
    });
  });

  it("отклоняет невалидный тип спорта", () => {
    const result = createMatchSchema.safeParse({
      title: "Test Match",
      sportType: "INVALID",
      streamUrl: "https://example.com/stream",
      startTime: "2024-01-01T12:00:00Z",
    });

    expect(result.success).toBe(false);
  });

  it("отклоняет короткое название", () => {
    const result = createMatchSchema.safeParse({
      title: "AB",
      sportType: "CS2",
      streamUrl: "https://example.com/stream",
      startTime: "2024-01-01T12:00:00Z",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe(
        "Название должно быть минимум 3 символа"
      );
    }
  });

  it("отклоняет невалидный URL", () => {
    const result = createMatchSchema.safeParse({
      title: "Test Match",
      sportType: "CS2",
      streamUrl: "not-a-url",
      startTime: "2024-01-01T12:00:00Z",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Введите корректный URL");
    }
  });

  it("принимает externalId опционально", () => {
    const result = createMatchSchema.safeParse({
      title: "Test Match",
      sportType: "CS2",
      streamUrl: "https://example.com/stream",
      startTime: "2024-01-01T12:00:00Z",
      externalId: "external-123",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.externalId).toBe("external-123");
    }
  });

  it("принимает формат datetime-local для startTime", () => {
    const result = createMatchSchema.safeParse({
      title: "Local Date Match",
      sportType: "CS2",
      streamUrl: "https://example.com/stream",
      startTime: "2026-04-13T18:30",
    });

    expect(result.success).toBe(true);
  });
});

describe("updateMatchSchema", () => {
  it("принимает datetime-local для startTime и endTime", () => {
    const result = updateMatchSchema.safeParse({
      startTime: "2026-04-13T18:30",
      endTime: "2026-04-13T20:45",
    });

    expect(result.success).toBe(true);
  });
});

describe("createPredictionSchema", () => {
  it("валидирует корректные данные", () => {
    const result = createPredictionSchema.safeParse({
      matchId: "cuid-match-1",
      type: "INSTANT",
    });

    expect(result.success).toBe(true);
  });

  it("валидирует тип INTERVAL", () => {
    const result = createPredictionSchema.safeParse({
      matchId: "cuid-match-1",
      type: "INTERVAL",
    });

    expect(result.success).toBe(true);
  });

  it("отклоняет невалидный UUID", () => {
    const result = createPredictionSchema.safeParse({
      matchId: "",
      type: "INSTANT",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Некорректный ID матча");
    }
  });

  it("отклоняет невалидный тип предсказания", () => {
    const result = createPredictionSchema.safeParse({
      matchId: "550e8400-e29b-41d4-a716-446655440000",
      type: "INVALID",
    });

    expect(result.success).toBe(false);
  });

  it("принимает targetEvent опционально", () => {
    const result = createPredictionSchema.safeParse({
      matchId: "cuid-match-1",
      type: "INSTANT",
      targetEvent: "kill",
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.targetEvent).toBe("kill");
    }
  });
});

describe("createEventSchema", () => {
  it("валидирует корректные данные", () => {
    const result = createEventSchema.safeParse({
      matchId: "cuid-match-1",
      type: "kill",
      description: "s1mple killed NiKo",
      player: "s1mple",
      team: "NAVI",
    });

    expect(result.success).toBe(true);
  });

  it("валидирует минимальные данные", () => {
    const result = createEventSchema.safeParse({
      matchId: "cuid-match-1",
      type: "round_win",
    });

    expect(result.success).toBe(true);
  });

  it("отклоняет пустой тип события", () => {
    const result = createEventSchema.safeParse({
      matchId: "cuid-match-1",
      type: "",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Тип события обязателен");
    }
  });

  it("отклоняет невалидный UUID матча", () => {
    const result = createEventSchema.safeParse({
      matchId: "",
      type: "kill",
    });

    expect(result.success).toBe(false);
  });
});

describe("createFootballEventSchema", () => {
  it("валидирует все поддерживаемые футбольные типы событий", () => {
    Object.values(FOOTBALL_EVENT_TYPES).forEach((type) => {
      const result = createFootballEventSchema.safeParse({
        matchId: "football-match-1",
        type,
        description: "Football event",
      });

      expect(result.success).toBe(true);
    });
  });

  it("отклоняет неподдерживаемый тип футбольного события", () => {
    const result = createFootballEventSchema.safeParse({
      matchId: "football-match-1",
      type: "corner",
    });

    expect(result.success).toBe(false);
  });
});
