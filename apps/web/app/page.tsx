import { tierOf } from "@earshot/core";

const LADDER = [
  { n: 1, label: "Busker", range: "1 listener" },
  { n: 5, label: "Tavern", range: "2 to 9" },
  { n: 20, label: "Amphitheater", range: "10 to 49" },
  { n: 50, label: "Festival", range: "50+" },
];

export default function Home() {
  return (
    <main className="hold">
      <h1 className="brand">
        EAR<span>SHOT</span>
      </h1>
      <p className="lede">
        A pixel-art music world. Link Last.fm and your avatar walks to the venue of whatever you&rsquo;re playing,
        next to everyone else listening right now.
      </p>
      <ul className="ladder">
        {LADDER.map((t) => (
          <li key={t.label} data-tier={tierOf(t.n)}>
            <span className="chip">{t.label}</span>
            <span className="n">{t.range}</span>
          </li>
        ))}
      </ul>
      <p className="soon">Doors open soon.</p>
    </main>
  );
}
