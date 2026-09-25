"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { drawPerson } from "@earshot/core";
import { type Avatar, HAIRS, lookOf, SHIRTS, SKINS } from "@/lib/avatar";
import { canvasPainter } from "@/lib/world/canvas-painter";
import { saveProfile, type SaveState } from "./actions";

export function ProfileForm({ displayName, avatar: initial }: { displayName: string; avatar: Avatar }) {
  const [avatar, setAvatar] = useState(initial);
  const [state, action, pending] = useActionState<SaveState, FormData>(saveProfile, { status: "idle" });
  const set = (patch: Partial<Avatar>) => setAvatar((a) => ({ ...a, ...patch }));

  return (
    <form action={action} className="card stack">
      <h2>You in the world</h2>
      <div className="avatar-row">
        <AvatarPreview avatar={avatar} />
        <div className="stack grow">
          <label className="field">
            Name
            <input name="display_name" defaultValue={displayName} maxLength={24} required placeholder="What people see" />
          </label>
          <Swatches label="Skin" colors={SKINS} value={avatar.skin} onPick={(skin) => set({ skin })} />
          <Swatches label="Hair" colors={HAIRS} value={avatar.hair} onPick={(hair) => set({ hair })} />
          <div className="field">
            Hair length
            <div className="seg" role="group" aria-label="Hair length">
              <button type="button" aria-pressed={!avatar.long} onClick={() => set({ long: false })}>
                Short
              </button>
              <button type="button" aria-pressed={avatar.long} onClick={() => set({ long: true })}>
                Long
              </button>
            </div>
          </div>
          <Swatches label="Shirt" colors={SHIRTS} value={avatar.shirt} onPick={(shirt) => set({ shirt })} />
        </div>
      </div>
      <input type="hidden" name="avatar" value={JSON.stringify(avatar)} />
      <div className="row">
        <button className="btn" disabled={pending}>
          {pending ? "Saving…" : "Save"}
        </button>
        {state.status === "saved" && <span className="note" role="status">Saved.</span>}
        {state.status === "error" && <span className="error" role="alert">{state.message}</span>}
      </div>
    </form>
  );
}

function Swatches({ label, colors, value, onPick }: { label: string; colors: readonly string[]; value: number; onPick: (i: number) => void }) {
  return (
    <div className="field">
      {label}
      <div className="swatches" role="radiogroup" aria-label={label}>
        {colors.map((c, i) => (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={i === value}
            aria-label={`${label} ${i + 1}`}
            className="swatch"
            style={{ background: c }}
            onClick={() => onPick(i)}
          />
        ))}
      </div>
    </div>
  );
}

function AvatarPreview({ avatar }: { avatar: Avatar }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const g = ref.current?.getContext("2d");
    if (!g) return;
    g.clearRect(0, 0, 16, 16);
    drawPerson(canvasPainter(g), 7, 14, lookOf(avatar));
  }, [avatar]);
  return <canvas ref={ref} width={16} height={16} className="avatar-preview" aria-label="Your avatar" role="img" />;
}
