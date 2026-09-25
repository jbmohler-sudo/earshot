// Tag claims for the indie zone. Dependency-free so the poller (Deno) can import it without the renderer.
import { matchTags } from "@earshot/core";

export const id = "indie";

export const TAGS = ["indie", "indie rock", "indie pop", "lo-fi", "shoegaze", "dream pop", "post-punk", "alternative"] as const;

export const claims = matchTags(TAGS);
