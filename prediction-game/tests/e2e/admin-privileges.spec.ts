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

test("RBAC: non-admin пользователь видит отказ в /admin", async ({ page }) => {
  await loginAs(page, testUser.email, testUser.password, "/admin");
  await expect(page.getByRole("heading", { name: "Доступ запрещён" })).toBeVisible();
  await expect(page.getByText("У этой учётной записи нет административных прав.")).toBeVisible();
});

test("Админ: создание, обновление и удаление матча", async ({ page }) => {
  const uniqueSuffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
  const matchTitle = `Тестовый матч ${uniqueSuffix}`;
  const updatedMatchTitle = `${matchTitle} (обновлён)`;
  const streamUrl = `https://www.youtube.com/watch?v=${Math.random().toString(36).slice(2, 8)}`;
  const startTime = new Date(Date.now() + 60 * 60 * 1000).toISOString().slice(0, 16);

  await loginAs(page, adminUser.email, adminUser.password, "/admin");
  await expect(page.getByRole("heading", { name: "Админ-панель" })).toBeVisible();

  const createSection = page.getByRole("heading", { name: "Создание матча" }).locator("..");
  const createInputs = createSection.getByRole("textbox");
  await createInputs.nth(0).fill(matchTitle);
  await createInputs.nth(1).fill(streamUrl);
  await createInputs.nth(2).fill(startTime);
  await createSection.getByRole("button", { name: "Создать матч" }).click();
  await expect(page.getByText("Матч создан")).toBeVisible();

  const updateCard = page
    .getByRole("heading", { name: matchTitle })
    .first()
    .locator("..");
  await expect(updateCard).toBeVisible();
  await updateCard.getByRole("textbox").first().fill(updatedMatchTitle);
  await updateCard.getByRole("button", { name: "Обновить матч" }).click();
  await expect(page.getByText("Матч обновлен")).toBeVisible();
  await expect(page.getByRole("heading", { name: updatedMatchTitle })).toBeVisible();
  await expect(page.getByRole("heading", { name: matchTitle })).not.toBeVisible();

  await updateCard.getByRole("button", { name: "Удалить матч" }).click();
  await expect(page.getByText("Матч удален")).toBeVisible();
  await expect(page.getByRole("heading", { name: updatedMatchTitle })).not.toBeVisible();
});

test("Админ: создание события, смена роли и запуск интеграции", async ({ page }) => {
  await loginAs(page, adminUser.email, adminUser.password, "/admin");
  await expect(page.getByRole("heading", { name: "Админ-панель" })).toBeVisible();

  const eventSection = page.getByRole("heading", { name: "Добавить событие" }).locator("..");
  await eventSection.getByRole("combobox").selectOption({ index: 1 });
  await eventSection.getByPlaceholder(/Тип события/).fill("goal");
  await eventSection.getByRole("button", { name: "Добавить событие" }).click();
  await expect(page.getByText("Событие создано")).toBeVisible();

  const playerRow = page.getByText("player@example.com").first().locator("..");
  await expect(playerRow).toBeVisible();
  await playerRow.getByRole("combobox").selectOption("ADMIN");
  await playerRow.getByRole("button", { name: "Сменить" }).click();
  await expect(page.getByText("Роль пользователя изменена")).toBeVisible();

  const integrationSection = page.getByRole("heading", { name: "Интеграция матчей" }).locator("..");
  await integrationSection.getByRole("combobox").selectOption("api-football");
  await integrationSection.getByRole("button", { name: "Запустить синхронизацию" }).click();
  await expect(page.getByText(/Интеграция:/)).toBeVisible();
});
