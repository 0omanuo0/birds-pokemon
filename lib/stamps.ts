// Stamps on the profile: gentle milestones, never points or levels (docs/CONCEPT.md, section 6.5).
// Pure and serializable, so the server computes them and the client only draws them.

export type StampId = "first" | "ten" | "fifty" | "early" | "owl" | "wader" | "shutter" | "old";

export type Stamp = {
    id: StampId;
    name: string;
    earned: boolean;
    // one line saying how it was earned, or how to earn it while it's still locked
    how: string;
    // count-based stamps show how close you are; null for the others
    progress: { have: number; need: number } | null;
};

export type StampFacts = {
    species: number;
    photos: number;
    // species met per bird group (lib/birdGroups.ts names)
    groupFound: Record<string, number>;
    // any sighting logged before 07:00 local time
    earlyBird: boolean;
    // most distinct days the same bird was met on
    maxDaysOneBird: number;
};

const WADER_NEED = 3;

function count(id: StampId, name: string, have: number, need: number, earned: string, todo: string): Stamp {
    const done = have >= need;
    return { id, name, earned: done, how: done ? earned : todo, progress: { have: Math.min(have, need), need } };
}

export function buildStamps(f: StampFacts): Stamp[] {
    const owls = f.groupFound["Owls"] ?? 0;
    const waders = f.groupFound["Waders"] ?? 0;
    return [
        count("first", "First catch", f.species, 1, "You met your first bird.", "Meet your first bird."),
        count("ten", "Ten friends", f.species, 10, "You met 10 different birds.", "Meet 10 different birds."),
        count("fifty", "Fifty found", f.species, 50, "You met 50 different birds.", "Meet 50 different birds."),
        {
            id: "early", name: "Early bird", earned: f.earlyBird, progress: null,
            how: f.earlyBird ? "You logged a bird before 7 in the morning." : "Log a bird before 7 in the morning.",
        },
        {
            id: "owl", name: "First owl", earned: owls > 0, progress: null,
            how: owls > 0 ? "You met an owl." : "Meet an owl. Try at dusk.",
        },
        count("wader", "Wader watcher", waders, WADER_NEED, `You met ${WADER_NEED} waders.`, `Meet ${WADER_NEED} waders, the long-legged birds of the shore.`),
        count("shutter", "Shutterbug", f.photos, 10, "You took 10 photos of birds.", "Take 10 photos of birds."),
        count("old", "Old friend", f.maxDaysOneBird, 3, "You met the same bird on 3 different days.", "Meet the same bird on 3 different days."),
    ];
}
