import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { parseAvatar } from "@/lib/avatar";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { ProfileForm } from "./profile-form";
import { VisibilityToggle } from "./visibility-toggle";

export const metadata: Metadata = { title: "You · Earshot" };

const LASTFM_MESSAGES: Record<string, { ok: boolean; text: string }> = {
  connected: { ok: true, text: "Last.fm connected." },
  disconnected: { ok: true, text: "Last.fm disconnected." },
  taken: { ok: false, text: "That Last.fm account is already linked to another Earshot account." },
  denied: { ok: false, text: "Last.fm didn't approve the connection. Try connecting again." },
  expired: { ok: false, text: "That connect attempt timed out. Start it again from this page." },
  error: { ok: false, text: "Couldn't reach Last.fm. Try again in a minute." },
};

export default async function MePage({ searchParams }: { searchParams: Promise<{ lastfm?: string }> }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("display_name, avatar, visible").eq("id", auth.user.id).single();
  // source_accounts is server-only; read just the username, never the session key.
  const { data: lastfm } = await createAdminClient()
    .from("source_accounts")
    .select("external_username")
    .eq("user_id", auth.user.id)
    .eq("source", "lastfm")
    .maybeSingle();
  const flash = LASTFM_MESSAGES[(await searchParams).lastfm ?? ""];

  return (
    <main className="hold wide">
      <header className="topbar">
        <Link href="/" className="brand small">
          EAR<span>SHOT</span>
        </Link>
        <form action="/auth/signout" method="post">
          <button className="btn ghost">Sign out</button>
        </form>
      </header>

      <section className="card stack">
        <h2>Last.fm</h2>
        {flash && (
          <p className={flash.ok ? "note" : "error"} role={flash.ok ? "status" : "alert"}>
            {flash.text}
          </p>
        )}
        {lastfm ? (
          <>
            <p className="lede">
              Connected as{" "}
              <a href={`https://www.last.fm/user/${encodeURIComponent(lastfm.external_username)}`} target="_blank" rel="noreferrer">
                {lastfm.external_username}
              </a>
              . Play something and your avatar walks to that artist&rsquo;s venue.
            </p>
            <form action="/api/auth/lastfm/disconnect" method="post">
              <button className="btn ghost">Disconnect Last.fm</button>
            </form>
          </>
        ) : (
          <>
            <p className="lede">
              Earshot reads what you&rsquo;re playing from Last.fm. Connect your account so we know it&rsquo;s really you.
            </p>
            <p>
              <a className="btn" href="/api/auth/lastfm/start">
                Connect Last.fm
              </a>
            </p>
            <p className="note">Listening on Spotify? Connect it in your Last.fm settings under Applications so your plays reach Last.fm.</p>
          </>
        )}
      </section>

      <ProfileForm displayName={profile?.display_name ?? ""} avatar={parseAvatar(profile?.avatar)} />
      <VisibilityToggle visible={profile?.visible ?? true} />
    </main>
  );
}
