import type { NextRequest } from "next/server";
import { updateSession } from "./lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Static assets skip the session refresh, sprite manifests (/sprites/**/*.json) included.
  matcher: ["/((?!_next/static|_next/image|sprites/|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
