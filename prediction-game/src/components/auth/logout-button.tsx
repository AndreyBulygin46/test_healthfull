"use client";

import { signOut } from "next-auth/react";

export function LogoutButton() {
  return (
    <button
      type="button"
      className="text-slate-300 hover:text-white"
      onClick={() => signOut({ callbackUrl: "/login" })}
    >
      Выйти
    </button>
  );
}
