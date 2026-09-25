// Tag claims for your zone. Keep this file dependency-free apart from @earshot/core:
// the poller runs it in Deno to place artists, without loading any rendering code.
import { matchTags } from "@earshot/core";

export const id = "template";

/** Last.fm tags (lowercase) that belong in this zone. Weighted by each artist's tag counts. */
export const TAGS = ["example tag"] as const;

export const claims = matchTags(TAGS);
