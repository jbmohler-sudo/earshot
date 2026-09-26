import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { currentZone } from "@/lib/world/where";

/** "Take me to the world": the zone you're in right now, or the Forge. */
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  const zone = await currentZone(data.user?.id ?? null);
  const welcome = request.nextUrl.searchParams.has("welcome") ? "?welcome=1" : "";
  return NextResponse.redirect(new URL(`/z/${zone}${welcome}`, request.nextUrl.origin));
}
