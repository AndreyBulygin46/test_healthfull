import { auth } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

function getSafeCallbackUrl(callbackUrl?: string) {
  if (!callbackUrl || !callbackUrl.startsWith("/")) {
    return "/matches";
  }

  return callbackUrl;
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams?: { error?: string; message?: string; callbackUrl?: string };
}) {
  const session = await auth();
  const callbackUrl = getSafeCallbackUrl(searchParams?.callbackUrl);
  const error = searchParams?.error;
  const message = searchParams?.message;

  if (session) {
    redirect(callbackUrl);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center">
      <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 w-full max-w-md">
        <h1 className="text-3xl font-bold text-white mb-2 text-center">Регистрация</h1>
        <p className="text-slate-400 mb-6 text-center">
          Создайте аккаунт LivePredict
        </p>
        {message ? (
          <p className="mb-4 text-sm bg-emerald-900/50 border border-emerald-700 rounded-lg p-3 text-emerald-200">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mb-4 text-sm bg-red-900/50 border border-red-700 rounded-lg p-3 text-red-200">
            {error}
          </p>
        ) : null}

        <form
          action={async (formData) => {
            "use server";
            const name = formData.get("name") as string;
            const email = formData.get("email") as string;
            const password = formData.get("password") as string;
            const targetCallback = getSafeCallbackUrl(formData.get("callbackUrl")?.toString());

            if (!name || !email || !password) {
              redirect(
                `/register?${new URLSearchParams({
                  error: "Заполните все поля",
                  callbackUrl: targetCallback,
                }).toString()}`
              );
            }
            if (password.length < 6) {
              redirect(
                `/register?${new URLSearchParams({
                  error: "Пароль должен содержать минимум 6 символов",
                  callbackUrl: targetCallback,
                }).toString()}`
              );
            }

            const existingUser = await prisma.user.findUnique({
              where: { email },
            });

            if (existingUser) {
              redirect(
                `/register?${new URLSearchParams({
                  error: "Пользователь с таким email уже существует",
                  callbackUrl: targetCallback,
                }).toString()}`
              );
            }

            const hashedPassword = await bcrypt.hash(password, 12);

            await prisma.user.create({
              data: {
                name,
                email,
                password: hashedPassword,
              },
            });

            redirect(
              `/login?${new URLSearchParams({
                message: "Аккаунт создан. Войдите, чтобы продолжить.",
                callbackUrl: targetCallback,
              }).toString()}`
            );
          }}
          className="space-y-4"
        >
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Имя
            </label>
            <input
              type="text"
              name="name"
              required
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="Иван"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Email
            </label>
            <input
              type="email"
              name="email"
              required
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-1">
              Пароль
            </label>
            <input
              type="password"
              name="password"
              required
              minLength={6}
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-3 rounded-lg transition"
          >
            Зарегистрироваться
          </button>
        </form>

        <p className="mt-6 text-center text-slate-400">
          Уже есть аккаунт?{" "}
          <Link
            href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}
            className="text-cyan-400 hover:text-cyan-300"
          >
            Войти
          </Link>
        </p>
      </div>
    </div>
  );
}
