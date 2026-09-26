// Well-known artists per zone for the simulated crowd (?sim=N). Weights are rough popularity.
import type { SimArtist } from "./sim";

export const METAL: SimArtist[] = [
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

export const INDIE: SimArtist[] = [
  ["Arctic Monkeys", 30, ["Do I Wanna Know?", "R U Mine?", "505", "Fluorescent Adolescent", "I Bet You Look Good on the Dancefloor"]],
  ["The Strokes", 12, ["Last Nite", "Reptilia", "Someday", "The Adults Are Talking"]],
  ["Radiohead", 12, ["Creep", "Karma Police", "No Surprises", "Weird Fishes/Arpeggi"]],
  ["Tame Impala", 10, ["The Less I Know the Better", "Let It Happen", "Borderline"]],
  ["Phoebe Bridgers", 6, ["Motion Sickness", "Kyoto", "Garden Song"]],
  ["Beach House", 6, ["Space Song", "Myth", "Take Care"]],
  ["The Smiths", 5, ["There Is a Light That Never Goes Out", "This Charming Man", "Ask"]],
  ["Mitski", 5, ["My Love Mine All Mine", "Nobody", "Washing Machine Heart"]],
  ["Slowdive", 3, ["When the Sun Hits", "Alison", "Sugar for the Pill"]],
  ["Joy Division", 3, ["Love Will Tear Us Apart", "Disorder", "Atmosphere"]],
  ["Alvvays", 2, ["Archie, Marry Me", "Dreams Tonite"]],
  ["Big Thief", 2, ["Paul", "Not", "Simulation Swarm"]],
];

export const FOLK: SimArtist[] = [
  ["Fleet Foxes", 20, ["White Winter Hymnal", "Mykonos", "Helplessness Blues", "Ragged Wood"]],
  ["Bon Iver", 16, ["Skinny Love", "Holocene", "Flume", "Re: Stacks"]],
  ["Mumford & Sons", 12, ["Little Lion Man", "The Cave", "I Will Wait"]],
  ["The Lumineers", 10, ["Ho Hey", "Ophelia", "Stubborn Love"]],
  ["Iron & Wine", 6, ["Naked as We Came", "Such Great Heights", "Flightless Bird, American Mouth"]],
  ["Joni Mitchell", 6, ["A Case of You", "Big Yellow Taxi", "River"]],
  ["Zach Bryan", 6, ["Something in the Orange", "Heading South", "Oklahoma Smokeshow"]],
  ["Gillian Welch", 3, ["Look at Miss Ohio", "Revelator"]],
  ["Nick Drake", 3, ["Pink Moon", "Northern Sky", "River Man"]],
  ["Watchhouse", 2, ["Wildflowers", "Beautiful and Strange"]],
];

export const OUTSKIRTS: SimArtist[] = [
  ["Kendrick Lamar", 18, ["HUMBLE.", "DNA.", "Alright", "Not Like Us"]],
  ["Taylor Swift", 18, ["Anti-Hero", "Cruel Summer", "Love Story", "All Too Well"]],
  ["Daft Punk", 10, ["Get Lucky", "One More Time", "Around the World"]],
  ["Beastie Boys", 6, ["Sabotage", "Intergalactic", "No Sleep till Brooklyn"]],
  ["Miles Davis", 5, ["So What", "Blue in Green", "Freddie Freeloader"]],
  ["SZA", 8, ["Kill Bill", "Good Days", "Snooze"]],
  ["Aphex Twin", 3, ["Avril 14th", "Windowlicker", "Xtal"]],
  ["Bad Bunny", 8, ["Tití Me Preguntó", "Me Porto Bonito", "DtMF"]],
  ["Frank Ocean", 6, ["Pink + White", "Nights", "Ivy"]],
];
