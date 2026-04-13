import { z } from "zod";
import { MatchStatus, PredictionType } from "@prisma/client";

export const MATCH_PREDICTION_COOLDOWN_MS = 5_000;
export const MATCH_PREDICTION_MAX_COUNT = 50;

// Football event types
export const FOOTBALL_EVENT_TYPES = {
  GOAL: "goal",
  YELLOW_CARD: "yellow_card",
  RED_CARD: "red_card",
  SUBSTITUTION: "substitution",
} as const;

export const FOOTBALL_EVENT_VALUES = Object.values(FOOTBALL_EVENT_TYPES);

const matchIdSchema = z.string().min(1, "Некорректный ID матча");
const dateTimeSchema = z
  .string()
  .min(1, "Дата и время обязательны")
  .refine((value) => !Number.isNaN(new Date(value).getTime()), "Некорректный формат даты");

// Auth schemas
export const loginSchema = z.object({
  email: z.string().email("Введите корректный email"),
  password: z.string().min(6, "Пароль должен быть минимум 6 символов"),
});

export const registerSchema = z.object({
  name: z.string().min(2, "Имя должно быть минимум 2 символа"),
  email: z.string().email("Введите корректный email"),
  password: z.string().min(6, "Пароль должен быть минимум 6 символов"),
});

// Match schemas
export const createMatchSchema = z.object({
  title: z.string().min(3, "Название должно быть минимум 3 символа"),
  sportType: z.enum(["CS2", "FOOTBALL", "DOTA2", "VALORANT"]),
  streamUrl: z.string().url("Введите корректный URL"),
  startTime: dateTimeSchema,
  endTime: dateTimeSchema.optional(),
  externalId: z.string().optional(),
});

export const updateMatchSchema = z.object({
  title: z.string().min(3, "Название должно быть минимум 3 символа").optional(),
  sportType: z.enum(["CS2", "FOOTBALL", "DOTA2", "VALORANT"]).optional(),
  streamUrl: z.string().url("Введите корректный URL").optional(),
  status: z.nativeEnum(MatchStatus).optional(),
  startTime: dateTimeSchema.optional(),
  endTime: dateTimeSchema.nullable().optional(),
  externalId: z.string().optional().nullable(),
});

// Prediction schemas
export const createPredictionSchema = z.object({
  matchId: matchIdSchema,
  type: z.nativeEnum(PredictionType),
  targetEvent: z.string().optional(),
  intervalSeconds: z.number().int().min(1).max(120).optional(),
}).superRefine((value, ctx) => {
  if (value.type === PredictionType.INTERVAL) {
    if (value.intervalSeconds === undefined) {
      ctx.addIssue({
        code: "custom",
        message: "Для INTERVAL необходимо указать окно в секундах",
        path: ["intervalSeconds"],
      });
      return;
    }

    if (!value.targetEvent) {
      ctx.addIssue({
        code: "custom",
        message: "Для INTERVAL необходимо указать целевое событие",
        path: ["targetEvent"],
      });
    }
  }
});

// Event schemas
export const createEventSchema = z.object({
  matchId: matchIdSchema,
  type: z.string().min(1, "Тип события обязателен"),
  timestamp: z.string().datetime().optional(),
  description: z.string().optional(),
  player: z.string().optional(),
  team: z.string().optional(),
});

// Football-specific event schema
export const createFootballEventSchema = z.object({
  matchId: matchIdSchema,
  type: z.enum(FOOTBALL_EVENT_VALUES as [string, ...string[]]),
  timestamp: z.string().datetime().optional(),
  description: z.string().optional(),
  player: z.string().optional(),
  team: z.string().optional(),
});

export const matchEventsQuerySchema = z.object({
  take: z.coerce.number().int().min(1).max(200).optional(),
});
