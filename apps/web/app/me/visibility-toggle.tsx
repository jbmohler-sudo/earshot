"use client";

import { useOptimistic, useTransition } from "react";
import { setVisible } from "./actions";

export function VisibilityToggle({ visible }: { visible: boolean }) {
  const [shown, setShown] = useOptimistic(visible);
  const [pending, start] = useTransition();
  const hidden = !shown;

  return (
    <section className="card stack">
      <h2>Privacy</h2>
      <label className="toggle">
        <input
          type="checkbox"
          checked={hidden}
          disabled={pending}
          onChange={(e) => {
            const nextVisible = !e.target.checked;
            start(async () => {
              setShown(nextVisible);
              await setVisible(nextVisible);
            });
          }}
        />
        <span>Hide what I&rsquo;m playing</span>
      </label>
      <p className="note">
        {hidden
          ? "You're hidden. Nobody sees your avatar or what you're playing."
          : "You're visible. Your avatar walks to the venue of whatever you're playing."}
      </p>
    </section>
  );
}
