import { expect, test } from "@playwright/test";

import { loginAs } from "./utils/auth";

const defaultPassword = "Passw0rd!123";

test("Интеракции на странице матчей: фильтрация по спорту", async ({ page }) => {
  await page.goto("/matches");
  await expect(page.getByRole("heading", { name: "Матчи" })).toBeVisible();

  await page.getByRole("link", { name: "CS2" }).first().click();
  await expect(page).toHaveURL(/\/matches\?sport=CS2/);
  await expect(page.getByRole("heading", { name: "Матчи" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Перейти к матчу" }).first()).toBeVisible();

  await page.getByRole("link", { name: "Все дисциплины" }).click();
  await expect(page).toHaveURL(/\/matches$/);
});

test("Интеракции на странице матча: переключение modes и отправка прогноза", async ({ page }) => {
  const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  const email = `match-interaction-${uniqueSuffix}@example.com`;

  await page.goto("/register");
  await page.locator('input[name="name"]').fill(`Match User ${uniqueSuffix}`);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(defaultPassword);
  await page.getByRole("button", { name: "Зарегистрироваться" }).click();

  await expect(page).toHaveURL(/\/login\?/);
  await loginAs(page, email, defaultPassword, "/matches");
  await expect(page).toHaveURL(/\/matches/);

  const firstMatchLink = page.getByRole("link", { name: "Перейти к матчу" }).first();
  await expect(firstMatchLink).toBeVisible();
  await firstMatchLink.click();
  await expect(page).toHaveURL(/\/matches\/.+/);

  await expect(page.getByText("Время обновления:")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Отправить предсказание" })).toBeVisible();

  await expect(page.getByRole("radio", { name: "INSTANT" })).toBeChecked();
  await page.getByRole("radio", { name: "INTERVAL" }).check();
  await expect(page.getByRole("radio", { name: "INTERVAL" })).toBeChecked();
  await expect(page.getByRole("spinbutton", { name: "Окно (сек):" })).toBeVisible();

  await page.getByRole("radio", { name: "INSTANT" }).check();
  await expect(page.getByRole("radio", { name: "INSTANT" })).toBeChecked();

  const myEmptyState = page.getByText("Вы еще не делали прогнозов на этот матч");
  await expect(myEmptyState).toBeVisible();
  await page.getByRole("button", { name: "СЕЙЧАС" }).click();
  await expect(page.getByText("Предсказание отправлено")).toBeVisible();
  await expect(myEmptyState).not.toBeVisible();
});
