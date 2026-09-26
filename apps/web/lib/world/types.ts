import type { Look } from "@earshot/core";

/** One person as the world view needs them: identity, look, and what they're engaged with. */
export interface PersonView {
  id: string;
  name: string;
  look: Look;
  groupKey: string;
  groupName: string;
  itemKey: string;
  itemTitle: string;
  /** The signed-in viewer. */
  you?: boolean;
}

export type Selection = { type: "person"; id: string } | { type: "venue"; groupKey: string } | null;

export interface PersonSummary {
  id: string;
  name: string;
  groupName: string;
  itemTitle: string;
  you: boolean;
  where: string;
}
