import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isZoneId, ZONES } from "@/lib/world/zones";
import { ZoneView } from "./zone-view";

type Params = { zone: string };

export async function generateMetadata({ params }: { params: Promise<Params> }): Promise<Metadata> {
  const { zone } = await params;
  return { title: isZoneId(zone) ? `${ZONES[zone]!.name} · Earshot` : "Earshot" };
}

export default async function ZonePage({ params, searchParams }: { params: Promise<Params>; searchParams: Promise<{ sim?: string }> }) {
  const { zone } = await params;
  if (!isZoneId(zone)) notFound();
  const { sim } = await searchParams;
  // ?sim=N shows a simulated crowd of N (20–260) instead of real people. For development and demos.
  const simSize = sim === undefined ? null : Math.max(20, Math.min(260, Number.parseInt(sim, 10) || 130));
  return <ZoneView zoneId={zone} simSize={simSize} />;
}
