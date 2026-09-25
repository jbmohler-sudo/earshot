// Tag claims for the folk zone. Dependency-free so the poller (Deno) can import it without the renderer.
import { matchTags } from "@earshot/core";

export const id = "folk";

export const TAGS = ["folk", "americana", "singer-songwriter", "bluegrass", "country", "acoustic", "folk rock"] as const;

export const claims = matchTags(TAGS);
