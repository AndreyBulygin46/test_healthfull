# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: admin-privileges.spec.ts >> RBAC: non-admin пользователь видит отказ в /admin
- Location: tests\e2e\admin-privileges.spec.ts:15:5

# Error details

```
Test timeout of 60000ms exceeded.
```

```
Error: page.waitForURL: Test timeout of 60000ms exceeded.
=========================== logs ===========================
waiting for navigation until "load"
  navigated to "http://127.0.0.1:3000/login?error=CredentialsSignin&callbackUrl=%2Fadmin"
============================================================
```

# Page snapshot

```yaml
- generic [active] [ref=e1]:
  - banner [ref=e2]:
    - generic [ref=e3]:
      - link "LivePredict" [ref=e4] [cursor=pointer]:
        - /url: /
      - generic [ref=e5]:
        - link "Матчи" [ref=e6] [cursor=pointer]:
          - /url: /matches
        - link "Лидерборд" [ref=e7] [cursor=pointer]:
          - /url: /leaderboard
        - link "Войти" [ref=e8] [cursor=pointer]:
          - /url: /login
        - link "Регистрация" [ref=e9] [cursor=pointer]:
          - /url: /register
  - generic [ref=e11]:
    - heading "Вход" [level=1] [ref=e12]
    - paragraph [ref=e13]: Войдите в свой аккаунт LivePredict
    - paragraph [ref=e14]: Неверный email или пароль
    - generic [ref=e15]:
      - generic [ref=e16]:
        - generic [ref=e17]: Email
        - textbox "you@example.com" [ref=e18]
      - generic [ref=e19]:
        - generic [ref=e20]: Пароль
        - textbox "••••••••" [ref=e21]
      - button "Войти" [ref=e22]
    - paragraph [ref=e23]:
      - text: Нет аккаунта?
      - link "Зарегистрироваться" [ref=e24] [cursor=pointer]:
        - /url: /register?callbackUrl=%2Fadmin
  - button "Open Next.js Dev Tools" [ref=e30] [cursor=pointer]:
    - img [ref=e31]
  - alert [ref=e34]
```

# Test source

```ts
  1  | import type { Page } from "@playwright/test";
  2  | 
  3  | export async function loginAs(page: Page, email: string, password: string, callbackUrl = "/matches") {
  4  |   const query = new URLSearchParams({ callbackUrl }).toString();
  5  |   await page.goto(`/login?${query}`);
  6  |   await page.locator('input[name="email"]').fill(email);
  7  |   await page.locator('input[name="password"]').fill(password);
  8  |   await page.getByRole("button", { name: "Войти" }).click();
> 9  |   await page.waitForURL((url) => {
     |              ^ Error: page.waitForURL: Test timeout of 60000ms exceeded.
  10 |     try {
  11 |       const pathname = new URL(url).pathname;
  12 |       return pathname === callbackUrl || pathname.startsWith(`${callbackUrl}/`);
  13 |     } catch {
  14 |       return false;
  15 |     }
  16 |   });
  17 | }
  18 | 
```