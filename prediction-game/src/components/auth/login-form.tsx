"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

type LoginFormProps = {
  callbackUrl: string;
  serverError?: string;
  message?: string;
};

export function LoginForm({ callbackUrl, serverError, message }: LoginFormProps) {
  const router = useRouter();
  const [clientError, setClientError] = useState(false);
  const [pending, setPending] = useState(false);

  const showError = clientError || serverError === "CredentialsSignin";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setClientError(false);

    const form = event.currentTarget;
    const email = (form.elements.namedItem("email") as HTMLInputElement).value.trim();
    const password = (form.elements.namedItem("password") as HTMLInputElement).value;

    setPending(true);
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });
    setPending(false);

    if (result?.error) {
      setClientError(true);
      return;
    }

    router.push(callbackUrl);
    router.refresh();
  }

  return (
    <>
      {message ? (
        <p className="mb-4 text-sm bg-emerald-900/50 border border-emerald-700 rounded-lg p-3 text-emerald-200">
          {message}
        </p>
      ) : null}
      {showError ? (
        <p className="mb-4 text-sm bg-red-900/50 border border-red-700 rounded-lg p-3 text-red-200">
          Неверный email или пароль
        </p>
      ) : null}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1" htmlFor="login-email">
            Email
          </label>
          <input
            id="login-email"
            type="email"
            name="email"
            required
            autoComplete="email"
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            placeholder="you@example.com"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-300 mb-1" htmlFor="login-password">
            Пароль
          </label>
          <input
            id="login-password"
            type="password"
            name="password"
            required
            autoComplete="current-password"
            minLength={6}
            className="w-full px-4 py-3 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-cyan-500 focus:border-transparent"
            placeholder="••••••••"
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full bg-cyan-600 hover:bg-cyan-700 disabled:opacity-60 text-white font-semibold py-3 rounded-lg transition"
        >
          {pending ? "Вход…" : "Войти"}
        </button>
      </form>

      <p className="mt-6 text-center text-slate-400">
        Нет аккаунта?{" "}
        <Link
          href={`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`}
          className="text-cyan-400 hover:text-cyan-300"
        >
          Зарегистрироваться
        </Link>
      </p>
    </>
  );
}
