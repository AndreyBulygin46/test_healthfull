import { expect, test } from "@playwright/test";

import { loginAs } from "./utils/auth";

const testUser = {
  email: "player@example.com",
  password: "player123456",
};

const adminUser = {
  email: "admin@example.com",
  password: "admin123456",
};

test("Smoke: гостевой путь по ключевым страницам", async ({ page }) => {
  const uniqueEmail = `smoke-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}@example.com`;

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "🎯 LivePredict" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Войти" }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Регистрация" }).first()).toBeVisible();

  await page.getByRole("link", { name: "Смотреть матчи" }).click();
  await expect(page).toHaveURL(/\/matches/);
  await expect(page.getByRole("heading", { name: "Матчи" })).toBeVisible();

  const firstMatchLink = page.getByRole("link", { name: "Перейти к матчу" }).first();
  await expect(firstMatchLink).toBeVisible();
  await firstMatchLink.click();
  await expect(page).toHaveURL(/\/matches\/.+/);
  await expect(page.getByRole("link", { name: "← К списку матчей" })).toBeVisible();
  await expect(page.getByRole("link", { name: "войти" })).toBeVisible();

  await page.getByRole("link", { name: "← К списку матчей" }).click();
  await expect(page).toHaveURL(/\/matches$/);

  await page.getByRole("link", { name: "Лидерборд" }).click();
  await expect(page).toHaveURL(/\/leaderboard/);
  await expect(page.getByRole("heading", { name: "Турнирная таблица" })).toBeVisible();
  await page.getByRole("link", { name: "К матчам" }).click();
  await expect(page).toHaveURL(/\/matches/);

  await page.getByRole("link", { name: "Регистрация" }).first().click();
  await expect(page).toHaveURL(/\/register/);
  await expect(page.getByRole("heading", { name: "Регистрация" })).toBeVisible();
  await page.locator('input[name="name"]').fill("Smoke User");
  await page.locator('input[name="email"]').fill(uniqueEmail);
  await page.locator('input[name="password"]').fill("Passw0rd!123");
  await page.getByRole("button", { name: "Зарегистрироваться" }).click();
  await expect(page).toHaveURL(/\/login\?/);
  await expect(
    page.getByText("Аккаунт создан. Войдите, чтобы продолжить.")
  ).toBeVisible();

  await page.goto("/profile");
  await expect(page).toHaveURL(/\/login\?callbackUrl=%2Fprofile/);
});

test("Smoke: путь авторизованного пользователя", async ({ page }) => {
  await loginAs(page, testUser.email, testUser.password, "/matches");
  await expect(page).toHaveURL(/\/matches/);
  await expect(page.getByRole("button", { name: "Выйти" })).toBeVisible();

  await page.getByRole("link", { name: "Лидерборд" }).click();
  await expect(page).toHaveURL(/\/leaderboard/);
  await expect(page.getByRole("link", { name: "К матчам" })).toBeVisible();
  await page.getByRole("link", { name: "К матчам" }).click();
  await expect(page).toHaveURL(/\/matches/);

  await page.getByRole("link", { name: "Профиль" }).click();
  await expect(page).toHaveURL(/\/profile/);
  await expect(page.getByRole("heading", { name: "Профиль" })).toBeVisible();
  await expect(page.getByText("Роль:")).toBeVisible();

  await page.getByRole("link", { name: "Матчи" }).click();
  const firstMatchLink = page.getByRole("link", { name: "Перейти к матчу" }).first();
  await expect(firstMatchLink).toBeVisible();
  await firstMatchLink.click();
  await expect(page.getByRole("heading", { name: "Отправить предсказание" })).toBeVisible();
  await expect(page.getByRole("button", { name: "СЕЙЧАС" })).toBeVisible();

  await page.getByRole("button", { name: "Выйти" }).click();
  await expect(page).toHaveURL(/\/login/);
});

test("Smoke: путь ADMIN пользователя", async ({ page }) => {
  await loginAs(page, adminUser.email, adminUser.password, "/admin");
  await expect(page).toHaveURL(/\/admin/);
  await expect(page.getByRole("heading", { name: "Админ-панель" })).toBeVisible();
  await expect(page.getByText("Создание матча")).toBeVisible();

  await page.getByRole("link", { name: "Матчи" }).click();
  await expect(page).toHaveURL(/\/matches/);
  await expect(page.getByRole("heading", { name: "Матчи" })).toBeVisible();
  await page.getByRole("link", { name: "Админка" }).click();
  await expect(page).toHaveURL(/\/admin/);

  await page.getByRole("link", { name: "На главную" }).click();
  await expect(page.getByRole("heading", { name: "🎯 LivePredict" })).toBeVisible();
  await page.getByRole("button", { name: "Выйти" }).click();
  await expect(page).toHaveURL(/\/login/);
});
