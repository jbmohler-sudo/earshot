import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../database.types";

/** Service-role client. Bypasses RLS: only for server code that has already checked who the user is. */
export function createAdminClient() {
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
