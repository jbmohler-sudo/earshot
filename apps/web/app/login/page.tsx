import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in · Earshot" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (data.user) redirect("/me");
  const { error } = await searchParams;

  return (
    <main className="hold">
      <Link href="/world" className="brand small" aria-label="Earshot: go to the world">
        EAR<span>SHOT</span>
      </Link>
      <h1 className="h">Sign in</h1>
      <p className="lede">No password. We&rsquo;ll email you a link.</p>
      {error && (
        <p className="error" role="alert">
          That sign-in link didn&rsquo;t work. It may have expired or been opened in a different browser. Request a new one.
        </p>
      )}
      <LoginForm />
    </main>
  );
}
