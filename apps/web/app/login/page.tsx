import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { EmailCodeForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · Earshot" };

const LASTFM_ERRORS: Record<string, string> = {
  denied: "Last.fm didn't approve the sign-in. Try again.",
  expired: "That sign-in took too long or started in another browser. Try again.",
  error: "Couldn't reach Last.fm just now. Try again in a minute.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; lastfm?: string }> }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect("/me");
  const { error, lastfm } = await searchParams;
  const lastfmError = lastfm ? LASTFM_ERRORS[lastfm] : undefined;

  return (
    <main className="hold">
      <Link href="/world" className="brand small" aria-label="Earshot: go to the world">
        EAR<span>SHOT</span>
      </Link>
      <h1 className="h">Sign in</h1>

      <section className="stack">
        <a className="btn btn-big" href="/api/auth/lastfm/start">
          Sign in with Last.fm
        </a>
        <p className="note">One step: approve Earshot on Last.fm and you land in the world. New here? This creates your account.</p>
        {(lastfmError || error) && (
          <p className="error" role="alert">
            {lastfmError ?? "That sign-in link didn't work. Use Last.fm, or get a code by email below."}
          </p>
        )}
      </section>

      <div className="or">
        <span>or use email</span>
      </div>

      <EmailCodeForm />
      <p className="note">We&rsquo;ll email you a 6-digit code to type here. You&rsquo;ll still connect Last.fm afterwards so your music shows up.</p>
    </main>
  );
}
