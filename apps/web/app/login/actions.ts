"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export interface LoginState {
  step: "email" | "code";
  email?: string;
  error?: string;
  /** Set after a code was actually sent (vs. "I already have a code"). */
  sent?: boolean;
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Email fallback, step 1: send a 6-digit code. */
export async function sendCode(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  if (!EMAIL.test(email)) return { step: "email", email, error: "That doesn't look like an email address." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
  if (error) {
    const wait = error.status === 429 || /rate limit|seconds/i.test(error.message);
    return { step: "email", email, error: wait ? "Too many codes requested. Wait a minute and try again." : "Couldn't send a code. Try again." };
  }
  return { step: "code", email, sent: true };
}

/** Email fallback, step 2: check the code and sign in on this same page. */
export async function verifyCode(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const token = String(form.get("code") ?? "").replace(/\D/g, "");
  if (!EMAIL.test(email)) return { step: "code", email, error: "Enter the email address the code was sent to." };
  if (token.length !== 6) return { step: "code", email, error: "The code is 6 digits." };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { step: "code", email, error: "That code didn't work. It may have expired or been used; ask for a new one." };
  redirect("/world");
}
