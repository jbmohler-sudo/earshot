import { tierOf } from "@earshot/core";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

const LADDER = [
  { n: 1, label: "Busker", range: "1 listener" },
  { n: 5, label: "Tavern", range: "2 to 9" },
  { n: 20, label: "Amphitheater", range: "10 to 49" },
  { n: 50, label: "Festival", range: "50+" },
];

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const signedIn = !!data.user;

  return (
    <main className="hold">
      <h1 className="brand">
        <Link href="/world" aria-label="Earshot: go to the world">
          EAR<span>SHOT</span>
        </Link>
      </h1>
      <p className="lede">
        A pixel-art music world. Link Last.fm and your avatar walks to the venue of whatever you&rsquo;re playing,
        next to everyone else listening right now.
      </p>
      <div className="stack">
        {signedIn ? (
          <>
            <Link className="btn btn-big" href="/world">
              Enter the world
            </Link>
            <p className="row">
              <Link href="/me">Your avatar and settings</Link>
            </p>
          </>
        ) : (
          <>
            <a className="btn btn-big" href="/api/auth/lastfm/start">
              Sign in with Last.fm
            </a>
            <p className="row note">
              <Link href="/world">Look around first</Link>
              <span aria-hidden="true">·</span>
              <Link href="/login">Use email instead</Link>
            </p>
          </>
        )}
      </div>
      <ul className="ladder">
        {LADDER.map((t) => (
          <li key={t.label} data-tier={tierOf(t.n)}>
            <span className="chip">{t.label}</span>
            <span className="n">{t.range}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
