import { auth, signIn } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";

function getSafeCallbackUrl(callbackUrl?: string) {
  if (!callbackUrl || !callbackUrl.startsWith("/")) {
    return "/matches";
  }

  return callbackUrl;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?: Promise<{ error?: string; callbackUrl?: string; message?: string }>;
}) {
  const session = await auth();
  const resolvedSearchParams = await searchParams;
  const callbackUrl = getSafeCallbackUrl(resolvedSearchParams?.callbackUrl);
  const error = resolvedSearchParams?.error;
  const message = resolvedSearchParams?.message;

  if (session) {
    redirect(callbackUrl);
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center">
      <div className="bg-slate-800 p-8 rounded-2xl border border-slate-700 w-full max-w-md">
        <h1 className="text-3xl font-bold text-white mb-2 text-center">Вход</h1>
        <p className="text-slate-400 mb-6 text-center">
          Войдите в свой аккаунт LivePredict
        </p>
        {message ? (
          <p className="mb-4 text-sm bg-emerald-900/50 border border-emerald-700 rounded-lg p-3 text-emerald-200">
            {message}
          </p>
        ) : null}
        {error ? (
          <p className="mb-4 text-sm bg-red-900/50 border border-red-700 rounded-lg p-3 text-red-200">
            {error === "CredentialsSignin"
              ? "Неверный email или пароль"
              : "Не удалось войти. Проверьте данные и попробуйте еще раз."}
          </p>
        ) : null}

        <form
          action={async (formData) => {
            "use server";
            const email = formData.get("email") as string;
            const password = formData.get("password") as string;
            const formCallback = formData.get("callbackUrl")?.toString();
            const redirectTo = getSafeCallbackUrl(formCallback);

            try {
              await signIn("credentials", {
                email,
                password,
                redirectTo,
              });
            } catch {
              redirect(
                `/login?${new URLSearchParams({
                  error: "CredentialsSignin",
                  callbackUrl: redirectTo,
                }).toString()}`
              );
            }
          }}
          className="space-y-4"
        >
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
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
          <Link
            href={`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`}
            className="text-cyan-400 hover:text-cyan-300"
          >
            Зарегистрироваться
          </Link>
        </p>
      </div>
    </div>
  );
}
