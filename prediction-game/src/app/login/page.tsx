import { auth } from "@/lib/auth";
import { LoginForm } from "@/components/auth/login-form";
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

        {error && error !== "CredentialsSignin" ? (
          <p className="mb-4 text-sm bg-red-900/50 border border-red-700 rounded-lg p-3 text-red-200">
            Не удалось войти. Проверьте данные и попробуйте еще раз.
          </p>
        ) : null}

        <LoginForm
          callbackUrl={callbackUrl}
          serverError={error}
          message={message}
        />

        <p className="mt-4 text-center text-sm text-slate-500">
          <Link href="/" className="text-slate-400 hover:text-slate-300">
            На главную
          </Link>
        </p>
      </div>
    </div>
  );
}
