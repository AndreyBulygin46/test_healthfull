import { auth } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signIn } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export default async function LoginPage() {
  const session = await auth();
  
  if (session) {
    redirect("/matches");
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center">
      <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 w-full max-w-md">
        <h1 className="text-3xl font-bold text-white mb-2 text-center">Вход</h1>
        <p className="text-slate-400 mb-6 text-center">
          Войдите в свой аккаунт LivePredict
        </p>

        <form
          action={async (formData) => {
            "use server";
            const email = formData.get("email") as string;
            const password = formData.get("password") as string;
            
            await signIn("credentials", {
              email,
              password,
              redirectTo: "/matches",
            });
          }}
          className="space-y-4"
        >
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
              className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
              placeholder="••••••••"
            />
          </div>

          <button
            type="submit"
            className="w-full bg-cyan-600 hover:bg-cyan-700 text-white font-semibold py-3 rounded-lg transition"
          >
            Войти
          </button>
        </form>

        <p className="mt-6 text-center text-slate-400">
          Нет аккаунта?{" "}
          <Link href="/register" className="text-cyan-400 hover:text-cyan-300">
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </div>
  );
}
