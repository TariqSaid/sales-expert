"use client";

import { useActionState } from "react";
import { login } from "./actions";

export default function LoginPage() {
  const [error, formAction, pending] = useActionState(login, "");

  return (
    <div className="flex h-dvh items-center justify-center bg-neutral-950 px-4 text-neutral-100">
      <form action={formAction} className="w-full max-w-sm space-y-4">
        <h1 className="text-xl font-semibold">Sales Expert</h1>
        <input
          type="password"
          name="password"
          placeholder="Password"
          autoFocus
          className="w-full rounded-full bg-neutral-800 px-4 py-2 outline-none"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-full bg-blue-600 px-5 py-2 disabled:opacity-50"
        >
          Log in
        </button>
      </form>
    </div>
  );
}