// The Outskirts is the fallback zone: it claims nothing and takes every artist no other zone claims.
export const id = "outskirts";

export const TAGS = [] as const;

export const claims = (_tags: string[]): number => 0;
