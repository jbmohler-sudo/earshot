import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isZoneId, ZONES } from "@/lib/world/zones";
import { ZoneView } from "./zone-view";

type Params = { zone: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { zone } = await params;
  return { title: isZoneId(zone) ? `${ZONES[zone]!.name} · Earshot` : "Earshot" };
}

export default async function ZonePage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<{ sim?: string; welcome?: string; arrive?: string; travel?: string }> }) {
  const { zone } = await params;
  if (!isZoneId(zone)) notFound();
  const { sim, welcome, arrive, travel } = await searchParams;
  // ?sim=N shows a simulated crowd of N (20–260) instead of real people. For development and demos.
  const simSize = sim === undefined ? null : Math.max(20, Math.min(260, Number.parseInt(sim, 10) || 130));
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  // Phase 1 gate: log that this person opened the world today (one row per day; demos don't count).
  // Never block the page on it.
  if (data.user && simSize === null) await supabase.rpc("record_world_visit").then(undefined, () => {});
  return (
    <ZoneView
      zoneId={zone}
      simSize={simSize}
      viewerId={data.user?.id ?? null}
      welcome={!!data.user && welcome !== undefined}
      arrive={arrive !== undefined}
      travelDemo={simSize !== null ? (travel ?? null) : null}
    />
  );
}
