"use client";

import { useActionState } from "react";
import { login, type LoginState } from "./actions";

const initial: LoginState = {};

export function LoginForm() {
  const [state, action, pending] = useActionState(login, initial);

  return (
    <form action={action} className="flex w-full flex-col gap-4 text-left">
      <label className="flex flex-col gap-1 text-sm font-medium text-brand">
        Correo
        <input
          name="email"
          type="email"
          autoComplete="email"
          required
          className="rounded-lg border border-brand/20 bg-white px-3 py-2 text-base text-brand-dark outline-none focus:border-iris focus:ring-2 focus:ring-iris/30"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm font-medium text-brand">
        Contraseña
        <input
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className="rounded-lg border border-brand/20 bg-white px-3 py-2 text-base text-brand-dark outline-none focus:border-iris focus:ring-2 focus:ring-iris/30"
        />
      </label>
      {state.error && (
        <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {state.error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-brand px-4 py-2.5 font-semibold text-white transition hover:bg-brand-dark disabled:opacity-60"
      >
        {pending ? "Ingresando…" : "Ingresar"}
      </button>
    </form>
  );
}
