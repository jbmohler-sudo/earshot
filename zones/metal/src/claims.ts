// Tag claims for the metal zone. Dependency-free so the poller (Deno) can import it without the renderer.
import { matchTags } from "@earshot/core";

export const id = "metal";

export const TAGS = ["metal", "heavy metal", "thrash metal", "death metal", "black metal", "doom metal", "metalcore", "nu metal", "progressive metal", "sludge"] as const;

export const claims = matchTags(TAGS);
