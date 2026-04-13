import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { auth } from "@/lib/auth";
import { AuthProvider } from "@/components/auth/providers";
import { LogoutButton } from "@/components/auth/logout-button";

export const metadata: Metadata = {
  title: "LivePredict",
  description: "Интерактивные предсказания событий в live-матчах",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const session = await auth();

  return (
    <html lang="ru" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-slate-900 text-white">
        <AuthProvider>
        <header className="border-b border-slate-800 bg-slate-950">
          <div className="container mx-auto px-4 py-3 flex justify-between items-center gap-4">
            <Link href="/" className="font-semibold text-cyan-300">
              LivePredict
            </Link>
            <div className="flex items-center gap-3 text-sm">
              <Link href="/matches" className="text-slate-300 hover:text-white">
                Матчи
              </Link>
              <Link href="/leaderboard" className="text-slate-300 hover:text-white">
                Лидерборд
              </Link>
              {session?.user ? (
                <>
                  <Link href="/profile" className="text-slate-300 hover:text-white">
                    Профиль
                  </Link>
                  {session.user.role === "ADMIN" ? (
                    <Link href="/admin" className="text-cyan-300 hover:text-white">
                      Админка
                    </Link>
                  ) : null}
                  <LogoutButton />
                </>
              ) : (
                <>
                  <Link href="/login" className="text-slate-300 hover:text-white">
                    Войти
                  </Link>
                  <Link href="/register" className="text-cyan-300 hover:text-white">
                    Регистрация
                  </Link>
                </>
              )}
            </div>
          </div>
        </header>
        {children}
        </AuthProvider>
      </body>
    </html>
  );
}
