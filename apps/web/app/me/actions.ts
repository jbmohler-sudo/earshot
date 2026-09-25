"use server";

import { revalidatePath } from "next/cache";
import { parseAvatar } from "@/lib/avatar";
import { createClient } from "@/lib/supabase/server";

export interface SaveState {
  status: "idle" | "saved" | "error";
  message?: string;
}

async function requireUser() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("Not signed in");
  return { supabase, userId: data.user.id };
}

export async function saveProfile(_prev: SaveState, form: FormData): Promise<SaveState> {
  const { supabase, userId } = await requireUser();
  const displayName = String(form.get("display_name") ?? "").trim().replace(/\s+/g, " ");
  if (displayName.length < 1 || displayName.length > 24) return { status: "error", message: "Pick a name between 1 and 24 characters." };

  let avatarRaw: unknown = {};
  try {
    avatarRaw = JSON.parse(String(form.get("avatar") ?? "{}"));
  } catch {
    // parseAvatar falls back to defaults
  }

  // RLS limits this to the caller's own row; column grants limit it to these fields.
  const { error } = await supabase
    .from("profiles")
    .update({ display_name: displayName, avatar: { ...parseAvatar(avatarRaw) } })
    .eq("id", userId);
  if (error) return { status: "error", message: "Couldn't save. Try again." };
  revalidatePath("/me");
  return { status: "saved" };
}

export async function setVisible(visible: boolean): Promise<{ ok: boolean }> {
  const { supabase, userId } = await requireUser();
  // Turning visibility off fires the on_profile_hidden trigger, which deletes your presence row.
  const { error } = await supabase.from("profiles").update({ visible }).eq("id", userId);
  revalidatePath("/me");
  return { ok: !error };
}
