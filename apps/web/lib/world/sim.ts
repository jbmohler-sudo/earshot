// Simulated crowd for development and demos (/z/metal?sim=130), ported from the Phase 0 bots.
// Never mixed with real people: a zone view shows either the sim or real presence.
import { HAIRS, lookOf, SHIRTS, SKINS } from "@/lib/avatar";
import type { PersonView } from "./types";

const ARTISTS: [name: string, weight: number, titles: string[]][] = [
  ["Metallica", 42, ["Master of Puppets", "Enter Sandman", "Nothing Else Matters", "One", "For Whom the Bell Tolls", "Fade to Black"]],
  ["Iron Maiden", 12, ["The Trooper", "Fear of the Dark", "Run to the Hills", "Hallowed Be Thy Name"]],
  ["Black Sabbath", 9, ["Paranoid", "Iron Man", "War Pigs"]],
  ["Slipknot", 8, ["Duality", "Psychosocial", "Before I Forget"]],
  ["System of a Down", 8, ["Chop Suey!", "Toxicity", "Aerials"]],
  ["Megadeth", 5, ["Symphony of Destruction", "Holy Wars... The Punishment Due", "Hangar 18"]],
  ["Ghost", 4, ["Mary on a Cross", "Square Hammer"]],
  ["Pantera", 4, ["Walk", "Cowboys from Hell", "Cemetery Gates"]],
  ["Slayer", 3, ["Raining Blood", "Angel of Death"]],
  ["Gojira", 3, ["Stranded", "Silvera", "Amazonia"]],
  ["Mastodon", 2, ["Blood and Thunder", "Oblivion"]],
  ["Judas Priest", 2, ["Painkiller", "Breaking the Law"]],
];
const TOTAL = ARTISTS.reduce((s, a) => s + a[1], 0);
const HANDLE_A = ["riff", "doom", "thrash", "grim", "iron", "void", "sludge", "blast", "ember", "crypt", "molten", "static", "black", "rust", "skull", "night", "ash", "storm"];
const HANDLE_B = ["witch", "cat", "lord", "wolf", "maiden", "goat", "crow", "smith", "ghoul", "reaper", "rider", "kid", "hound", "monk", "fang", "bat"];

const pick = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)]!;
const key = (s: string) => s.toLowerCase();

interface Bot {
  id: string;
  name: string;
  look: PersonView["look"];
  artist: (typeof ARTISTS)[number];
  title: string;
  endsAt: number;
}

export class CrowdSim {
  /** Simulated seconds per real second. */
  speed = 10;
  target: number;
  private bots: Bot[] = [];
  private next = 1;
  private t = 0;
  private churn = 0;

  constructor(size: number) {
    this.target = size;
    for (let i = 0; i < size; i++) this.bots.push(this.make());
    for (const b of this.bots) b.endsAt = Math.random() * 250;
  }

  /** Advance by real seconds. Returns true if anyone changed what they're playing or came/went. */
  step(dt: number): boolean {
    this.t += dt * this.speed;
    let changed = false;
    for (const b of this.bots) {
      if (this.t >= b.endsAt) {
        this.nextTrack(b);
        changed = true;
      }
    }
    this.churn += dt;
    if (this.churn > 1.1) {
      this.churn = 0;
      const diff = this.target - this.bots.length;
      if (diff > 0) for (let k = 0; k < Math.min(diff, 4); k++) this.bots.push(this.make());
      else if (diff < 0) this.bots.splice(0, Math.min(-diff, 4));
      else if (Math.random() < 0.35) {
        this.bots.splice(Math.floor(Math.random() * this.bots.length), 1);
        this.bots.push(this.make());
      }
      changed = true;
    }
    return changed;
  }

  people(): PersonView[] {
    return this.bots.map((b) => ({
      id: b.id,
      name: b.name,
      look: b.look,
      groupKey: key(b.artist[0]),
      groupName: b.artist[0],
      itemKey: `${key(b.artist[0])}|${key(b.title)}`,
      itemTitle: b.title,
    }));
  }

  private make(): Bot {
    const b: Bot = {
      id: `sim${this.next++}`,
      name: pick(HANDLE_A) + pick(HANDLE_B) + (Math.random() < 0.5 ? `_${Math.floor(Math.random() * 99)}` : ""),
      look: lookOf({
        skin: Math.floor(Math.random() * SKINS.length),
        hair: Math.floor(Math.random() * HAIRS.length),
        shirt: Math.random() < 0.7 ? 0 : Math.floor(Math.random() * SHIRTS.length),
        long: Math.random() < 0.55,
      }),
      artist: ARTISTS[0]!,
      title: "",
      endsAt: 0,
    };
    this.nextTrack(b, true);
    return b;
  }

  private nextTrack(b: Bot, fresh = false): void {
    if (fresh || Math.random() >= 0.62) {
      let r = Math.random() * TOTAL;
      for (const a of ARTISTS) {
        r -= a[1];
        if (r <= 0) {
          b.artist = a;
          break;
        }
      }
    }
    const titles = b.artist[2];
    // Earlier titles are the hits: weight 1/(k+1)^0.7.
    const ws = titles.map((_, k) => 1 / Math.pow(k + 1, 0.7));
    let r = Math.random() * ws.reduce((s, w) => s + w, 0);
    let title = titles[0]!;
    for (let k = 0; k < titles.length; k++) {
      r -= ws[k]!;
      if (r <= 0) {
        title = titles[k]!;
        break;
      }
    }
    b.title = title;
    b.endsAt = this.t + 150 + Math.random() * 110;
  }
}
