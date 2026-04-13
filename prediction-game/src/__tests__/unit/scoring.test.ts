import {
  calculateScore,
  calculateEventScore,
  validatePrediction,
  formatTimeDifference,
  getScoreTierName,
  getFootballEventScore,
  getFootballEventDisplayName,
} from "@/lib/scoring";

describe("calculateScore", () => {
  it("возвращает 100 очков при разнице 0-2 секунд", () => {
    const predictionTime = new Date("2024-01-01T12:00:00Z");
    const eventTime = new Date("2024-01-01T12:00:01Z");

    const result = calculateScore(predictionTime, eventTime);

    expect(result.points).toBe(100);
    expect(result.accuracyMs).toBe(1000);
  });

  it("возвращает 100 очков при разнице ровно 2 секунды", () => {
    const predictionTime = new Date("2024-01-01T12:00:00Z");
    const eventTime = new Date("2024-01-01T12:00:02Z");

    const result = calculateScore(predictionTime, eventTime);

    expect(result.points).toBe(100);
  });

  it("возвращает 80 очков при разнице 2-5 секунд", () => {
    const predictionTime = new Date("2024-01-01T12:00:00Z");
    const eventTime = new Date("2024-01-01T12:00:03Z");

    const result = calculateScore(predictionTime, eventTime);

    expect(result.points).toBe(80);
  });

  it("возвращает 80 очков при разнице ровно 5 секунд", () => {
    const predictionTime = new Date("2024-01-01T12:00:00Z");
    const eventTime = new Date("2024-01-01T12:00:05Z");

    const result = calculateScore(predictionTime, eventTime);

    expect(result.points).toBe(80);
  });

  it("возвращает 50 очков при разнице 5-10 секунд", () => {
    const predictionTime = new Date("2024-01-01T12:00:00Z");
    const eventTime = new Date("2024-01-01T12:00:07Z");

    const result = calculateScore(predictionTime, eventTime);

    expect(result.points).toBe(50);
  });

  it("возвращает 50 очков при разнице ровно 10 секунд", () => {
    const predictionTime = new Date("2024-01-01T12:00:00Z");
    const eventTime = new Date("2024-01-01T12:00:10Z");

    const result = calculateScore(predictionTime, eventTime);

    expect(result.points).toBe(50);
  });

  it("возвращает 20 очков при разнице 10-20 секунд", () => {
    const predictionTime = new Date("2024-01-01T12:00:00Z");
    const eventTime = new Date("2024-01-01T12:00:15Z");

    const result = calculateScore(predictionTime, eventTime);

    expect(result.points).toBe(20);
  });

  it("возвращает 20 очков при разнице ровно 20 секунд", () => {
    const predictionTime = new Date("2024-01-01T12:00:00Z");
    const eventTime = new Date("2024-01-01T12:00:20Z");

    const result = calculateScore(predictionTime, eventTime);

    expect(result.points).toBe(20);
  });

  it("возвращает 0 очков при разнице больше 20 секунд", () => {
    const predictionTime = new Date("2024-01-01T12:00:00Z");
    const eventTime = new Date("2024-01-01T12:00:25Z");

    const result = calculateScore(predictionTime, eventTime);

    expect(result.points).toBe(0);
  });

  it("работает когда предсказание позже события", () => {
    const predictionTime = new Date("2024-01-01T12:00:03Z");
    const eventTime = new Date("2024-01-01T12:00:00Z");

    const result = calculateScore(predictionTime, eventTime);

    expect(result.points).toBe(80);
    expect(result.accuracyMs).toBe(3000);
  });

  it("работает с миллисекундами", () => {
    const predictionTime = new Date("2024-01-01T12:00:00.000Z");
    const eventTime = new Date("2024-01-01T12:00:00.500Z");

    const result = calculateScore(predictionTime, eventTime);

    expect(result.points).toBe(100);
    expect(result.accuracyMs).toBe(500);
  });
});

describe("validatePrediction", () => {
  it("валидирует при LIVE статусе", () => {
    const result = validatePrediction("LIVE", null, 0);

    expect(result.valid).toBe(true);
  });

  it("отклоняет при UPCOMING статусе", () => {
    const result = validatePrediction("UPCOMING", null, 0);

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Матч еще не начался");
  });

  it("отклоняет при FINISHED статусе", () => {
    const result = validatePrediction("FINISHED", null, 0);

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Матч завершен");
  });

  it("отклоняет при CANCELLED статусе", () => {
    const result = validatePrediction("CANCELLED", null, 0);

    expect(result.valid).toBe(false);
    expect(result.error).toBe("Матч завершен");
  });

  it("отклоняет при активном cooldown", () => {
    const lastPredictionTime = new Date(Date.now() - 2000); // 2 секунды назад

    const result = validatePrediction("LIVE", lastPredictionTime, 0);

    expect(result.valid).toBe(false);
    expect(result.error).toContain("Подождите");
  });

  it("разрешает после окончания cooldown", () => {
    const lastPredictionTime = new Date(Date.now() - 6000); // 6 секунд назад

    const result = validatePrediction("LIVE", lastPredictionTime, 0);

    expect(result.valid).toBe(true);
  });

  it("отклоняет при достижении лимита предсказаний", () => {
    const result = validatePrediction("LIVE", null, 50);

    expect(result.valid).toBe(false);
    expect(result.error).toContain("Достигнут лимит");
  });

  it("разрешает при количестве меньше лимита", () => {
    const result = validatePrediction("LIVE", null, 49);

    expect(result.valid).toBe(true);
  });

  it("учитывает кастомный лимит предсказаний", () => {
    const result = validatePrediction("LIVE", null, 10, 10);

    expect(result.valid).toBe(false);
    expect(result.error).toContain("10");
  });
});

describe("formatTimeDifference", () => {
  it("форматирует только миллисекунды", () => {
    expect(formatTimeDifference(500)).toBe("500мс");
  });

  it("форматирует секунды с миллисекундами", () => {
    expect(formatTimeDifference(3500)).toBe("3.5с");
  });

  it("форматирует целые секунды", () => {
    expect(formatTimeDifference(1000)).toBe("1.0с");
  });

  it("форматирует большие значения", () => {
    expect(formatTimeDifference(15000)).toBe("15.0с");
  });
});

describe("getScoreTierName", () => {
  it("возвращает 'Идеально!' для 100 очков", () => {
    expect(getScoreTierName(100)).toBe("Идеально!");
  });

  it("возвращает 'Отлично!' для 80 очков", () => {
    expect(getScoreTierName(80)).toBe("Отлично!");
  });

  it("возвращает 'Хорошо!' для 50 очков", () => {
    expect(getScoreTierName(50)).toBe("Хорошо!");
  });

  it("возвращает 'Неплохо' для 20 очков", () => {
    expect(getScoreTierName(20)).toBe("Неплохо");
  });

  it("возвращает 'Мимо' для 0 очков", () => {
    expect(getScoreTierName(0)).toBe("Мимо");
  });

  it("возвращает 'Мимо' для неизвестного значения", () => {
    expect(getScoreTierName(999)).toBe("Мимо");
  });
});

describe("getFootballEventScore", () => {
  it("возвращает 100 очков для гола", () => {
    expect(getFootballEventScore("goal")).toBe(100);
    expect(getFootballEventScore("GOAL")).toBe(100);
  });

  it("возвращает 80 очков для желтой карточки", () => {
    expect(getFootballEventScore("yellow_card")).toBe(80);
    expect(getFootballEventScore("YELLOW_CARD")).toBe(80);
  });

  it("возвращает 80 очков для красной карточки", () => {
    expect(getFootballEventScore("red_card")).toBe(80);
    expect(getFootballEventScore("RED_CARD")).toBe(80);
  });

  it("возвращает 50 очков для замены", () => {
    expect(getFootballEventScore("substitution")).toBe(50);
    expect(getFootballEventScore("SUBSTITUTION")).toBe(50);
  });

  it("возвращает 20 очков для неизвестного события", () => {
    expect(getFootballEventScore("unknown")).toBe(20);
    expect(getFootballEventScore("corner")).toBe(20);
  });
});

describe("getFootballEventDisplayName", () => {
  it("возвращает 'Гол!' для goal", () => {
    expect(getFootballEventDisplayName("goal")).toBe("Гол!");
    expect(getFootballEventDisplayName("GOAL")).toBe("Гол!");
  });

  it("возвращает 'Желтая карточка' для yellow_card", () => {
    expect(getFootballEventDisplayName("yellow_card")).toBe("Желтая карточка");
  });

  it("возвращает 'Красная карточка' для red_card", () => {
    expect(getFootballEventDisplayName("red_card")).toBe("Красная карточка");
  });

  it("возвращает 'Замена' для substitution", () => {
    expect(getFootballEventDisplayName("substitution")).toBe("Замена");
  });

  it("возвращает исходное значение для неизвестного типа", () => {
    expect(getFootballEventDisplayName("corner")).toBe("corner");
    expect(getFootballEventDisplayName("offside")).toBe("offside");
  });
});

describe("calculateEventScore", () => {
  it("для футбола использует очки по типу события", () => {
    const predictionTime = new Date("2024-01-01T12:00:00Z");
    const eventTime = new Date("2024-01-01T12:00:20Z");

    const result = calculateEventScore("FOOTBALL", "goal", predictionTime, eventTime);

    expect(result.points).toBe(100);
    expect(result.accuracyMs).toBe(20000);
  });

  it("для не-футбольного спорта использует time-based шкалу", () => {
    const predictionTime = new Date("2024-01-01T12:00:00Z");
    const eventTime = new Date("2024-01-01T12:00:20Z");

    const result = calculateEventScore("CS2", "kill", predictionTime, eventTime);

    expect(result.points).toBe(20);
    expect(result.accuracyMs).toBe(20000);
  });
});
