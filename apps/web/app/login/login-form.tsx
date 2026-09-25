"use client";

import { useActionState } from "react";
import { sendMagicLink, type LoginState } from "./actions";

export function LoginForm() {
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, { status: "idle" });

  if (state.status === "sent") {
    return (
      <p className="lede" role="status">
        Check <b>{state.message}</b> for a sign-in link. Open it in this browser.
      </p>
    );
  }

  return (
    <form action={action} className="stack">
      <label className="field">
        Email
        <input name="email" type="email" autoComplete="email" required placeholder="you@example.com" />
      </label>
      <button className="btn" disabled={pending}>
        {pending ? "Sending…" : "Email me a sign-in link"}
      </button>
      {state.status === "error" && (
        <p className="error" role="alert">
          {state.message}
        </p>
      )}
    </form>
  );
}
