"use client";

import { useActionState, useState } from "react";
import { type LoginState, sendCode, verifyCode } from "./actions";

/** Email fallback: ask for a 6-digit code, then type it here. No links, no app switching back. */
export function EmailCodeForm() {
  const [sendState, send, sending] = useActionState<LoginState, FormData>(sendCode, { step: "email" });
  const [verifyState, verify, verifying] = useActionState<LoginState, FormData>(verifyCode, { step: "code" });
  const [manual, setManual] = useState(false);
  const [email, setEmail] = useState("");

  const codeStep = manual || sendState.step === "code";
  const knownEmail = sendState.email ?? email;

  if (!codeStep) {
    return (
      <form action={send} className="stack">
        <label className="field">
          Email
          <input
            name="email"
            type="email"
            autoComplete="email"
            required
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </label>
        <div className="row">
          <button className="btn ghost" disabled={sending}>
            {sending ? "Sending…" : "Email me a code"}
          </button>
          <button type="button" className="linkish" onClick={() => setManual(true)}>
            I already have a code
          </button>
        </div>
        {sendState.error && (
          <p className="error" role="alert">
            {sendState.error}
          </p>
        )}
      </form>
    );
  }

  return (
    <form action={verify} className="stack">
      {sendState.sent && (
        <p className="note" role="status">
          We sent a 6-digit code to <b>{sendState.email}</b>. Type it here; this page stays open.
        </p>
      )}
      <label className="field">
        Email
        <input name="email" type="email" autoComplete="email" required defaultValue={verifyState.email ?? knownEmail} />
      </label>
      <label className="field">
        Code
        <input
          name="code"
          className="code-input"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9 ]{6,7}"
          maxLength={7}
          required
          placeholder="123456"
          autoFocus
        />
      </label>
      <div className="row">
        <button className="btn" disabled={verifying}>
          {verifying ? "Checking…" : "Sign in"}
        </button>
        <button
          type="button"
          className="linkish"
          onClick={() => {
            setManual(false);
            window.location.reload();
          }}
        >
          Use a different email
        </button>
      </div>
      {verifyState.error && (
        <p className="error" role="alert">
          {verifyState.error}
        </p>
      )}
    </form>
  );
}
