"use server";

import { requestOrigin } from "@/lib/origin";
import { createClient } from "@/lib/supabase/server";

export interface LoginState {
  status: "idle" | "sent" | "error";
  message?: string;
}

export async function sendMagicLink(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = String(form.get("email") ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { status: "error", message: "That doesn't look like an email address." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: `${await requestOrigin()}/auth/callback?next=/me` },
  });
  if (error) {
    const wait = error.status === 429 || /rate limit|seconds/i.test(error.message);
    return { status: "error", message: wait ? "Too many sign-in emails. Wait a minute and try again." : "Couldn't send the link. Try again." };
  }
  return { status: "sent", message: email };
}
