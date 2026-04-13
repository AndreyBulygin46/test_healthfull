/**
 * Calculate score based on prediction accuracy
 * ±0-2 seconds: 100 points
 * ±2-5 seconds: 80 points  
 * ±5-10 seconds: 50 points
 * ±10-20 seconds: 20 points
 * >20 seconds: 0 points
 */
export function calculateScore(
  predictionTime: Date,
  eventTime: Date
): { points: number; accuracyMs: number } {
  const diffMs = Math.abs(predictionTime.getTime() - eventTime.getTime());
  const diffSec = diffMs / 1000;

  let points: number;
  if (diffSec <= 2) {
    points = 100;
  } else if (diffSec <= 5) {
    points = 80;
  } else if (diffSec <= 10) {
    points = 50;
  } else if (diffSec <= 20) {
    points = 20;
  } else {
    points = 0;
  }

  return { points, accuracyMs: diffMs };
}

export function calculateEventScore(
  sportType: string,
  eventType: string,
  predictionTime: Date,
  eventTime: Date
): { points: number; accuracyMs: number } {
  const timedScore = calculateScore(predictionTime, eventTime);

  if (sportType === "FOOTBALL") {
    return {
      points: getFootballEventScore(eventType),
      accuracyMs: timedScore.accuracyMs,
    };
  }

  return timedScore;
}

/**
 * Validate if prediction is allowed
 */
export function validatePrediction(
  matchStatus: string,
  lastPredictionTime: Date | null,
  predictionsCount: number,
  maxPredictions: number = 50,
  cooldownMs: number = 5000
): { valid: boolean; error?: string } {
  // Check match status
  if (matchStatus !== "LIVE") {
    return {
      valid: false,
      error: matchStatus === "UPCOMING" ? "Матч еще не начался" : "Матч завершен",
    };
  }

  // Check cooldown (5 seconds)
  if (lastPredictionTime) {
    const timeSinceLast = Date.now() - lastPredictionTime.getTime();
    if (timeSinceLast < cooldownMs) {
      const remaining = Math.ceil((cooldownMs - timeSinceLast) / 1000);
      return {
        valid: false,
        error: `Подождите ${remaining} секунд перед следующим предсказанием`,
      };
    }
  }

  // Check prediction limit
  if (predictionsCount >= maxPredictions) {
    return {
      valid: false,
      error: `Достигнут лимит предсказаний (${maxPredictions})`,
    };
  }

  return { valid: true };
}

/**
 * Format time difference for display
 */
export function formatTimeDifference(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const milliseconds = ms % 1000;
  
  if (seconds === 0) {
    return `${milliseconds}мс`;
  }
  
  return `${seconds}.${Math.floor(milliseconds / 100)}с`;
}

/**
 * Get score tier name
 */
export function getScoreTierName(points: number): string {
  switch (points) {
    case 100:
      return "Идеально!";
    case 80:
      return "Отлично!";
    case 50:
      return "Хорошо!";
    case 20:
      return "Неплохо";
    default:
      return "Мимо";
  }
}

/**
 * Get score for football event based on event type
 * goal: 100 points (main event)
 * yellow_card, red_card: 80 points
 * substitution: 50 points
 * other: 20 points
 */
export function getFootballEventScore(eventType: string): number {
  switch (eventType.toLowerCase()) {
    case "goal":
      return 100;
    case "yellow_card":
    case "red_card":
      return 80;
    case "substitution":
      return 50;
    default:
      return 20;
  }
}

/**
 * Get display name for football event type
 */
export function getFootballEventDisplayName(eventType: string): string {
  switch (eventType.toLowerCase()) {
    case "goal":
      return "Гол!";
    case "yellow_card":
      return "Желтая карточка";
    case "red_card":
      return "Красная карточка";
    case "substitution":
      return "Замена";
    default:
      return eventType;
  }
}
