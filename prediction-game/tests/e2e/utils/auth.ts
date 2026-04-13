import type { Page } from "@playwright/test";

export async function loginAs(page: Page, email: string, password: string, callbackUrl = "/matches") {
  const query = new URLSearchParams({ callbackUrl }).toString();
  await page.goto(`/login?${query}`);
  await page.locator('input[name="email"]').fill(email);
  await page.locator('input[name="password"]').fill(password);
  await page.getByRole("button", { name: "Войти" }).click();
  await page.waitForURL((url) => {
    try {
      const pathname = new URL(url).pathname;
      return pathname === callbackUrl || pathname.startsWith(`${callbackUrl}/`);
    } catch {
      return false;
    }
  });
}
