import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "../database.types";

let client: ReturnType<typeof createBrowserClient<Database>> | null = null;

/**
 * Supabase client for the browser, used only for public reads and Realtime (anon key; RLS applies).
 * It deliberately never reads, refreshes or writes the auth session: only server responses (proxy.ts)
 * set the auth cookies. Safari caps cookies written from JavaScript at 7 days, so a browser-side
 * refresh would quietly shorten everyone's session on iPhone.
 */
export function browserClient() {
  client ??= createBrowserClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
  return client;
}
