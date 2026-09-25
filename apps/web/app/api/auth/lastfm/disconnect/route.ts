import { LASTFM_SOURCE_ID } from "@earshot/sources/lastfm";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const origin = request.nextUrl.origin;
  if (request.headers.get("origin") !== origin) return new NextResponse("Forbidden", { status: 403 });

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.redirect(new URL("/login", origin), { status: 303 });
  const userId = data.user.id;

  // Drop the link and take the avatar out of the world.
  const admin = createAdminClient();
  await admin.from("source_accounts").delete().eq("user_id", userId).eq("source", LASTFM_SOURCE_ID);
  await admin.from("engagements").delete().eq("user_id", userId).eq("source", LASTFM_SOURCE_ID);
  await admin.from("presence").delete().eq("user_id", userId);

  return NextResponse.redirect(new URL("/me?lastfm=disconnected", origin), { status: 303 });
}
