export interface CharacterLook {
    /** Pen colour of the outline. */
    ink: string
    /** Coloured-pencil tint of the robe. */
    tint: string
    /** Accent for the staff star, hat band, etc. */
    accent: string
    hat: "pointed" | "wide" | "hood" | "crown"
    /** Small extras that give each doodle a personality. */
    extra?: "scarf" | "glasses" | "beard" | "cape"
}

export interface Character {
    id: string
    name: string
    title: string
    hp: number
    ap: number
    handSize: number
    deck: string[]
    look: CharacterLook
    /** AI only: 0 = always picks the best plan, 1 = very erratic. */
    sloppiness: number
    /** One-line intro written on a sticky note before the duel. */
    intro?: string
    /** What this opponent teaches. */
    lesson?: string
}

export const Characters: Record<string, Character> = {
    apprentice: {
        id: "apprentice",
        name: "You",
        title: "Apprentice",
        hp: 5,
        ap: 2,
        handSize: 3,
        // The basics only: one spell and one action. The run adds the rest.
        deck: ["flame", "flame", "flame", "flame", "move", "move", "move"],
        look: { ink: "#1e2a5a", tint: "#5b8def", accent: "#f2c230", hat: "pointed", extra: "scarf" },
        sloppiness: 0,
    },
    wendel: {
        id: "wendel",
        name: "Wobbly Wendel",
        title: "Hedge Wizard",
        hp: 3,
        ap: 2,
        handSize: 3,
        deck: ["flame", "flame", "flame", "move", "move", "move"],
        look: { ink: "#2b2b2b", tint: "#b47ee8", accent: "#7bd389", hat: "wide", extra: "beard" },
        sloppiness: 0.6,
        intro: "Wendel never stands still. When he hops out of your lane, Move back in before you cast.",
        lesson: "The hatched band is where 95% of your Flames land. The further they fly, the wider it gets.",
    },
    lin: {
        id: "lin",
        name: "Warden Lin",
        title: "Keeper of Lines",
        hp: 4,
        ap: 2,
        handSize: 3,
        deck: ["flame", "flame", "tilt", "shift", "ward", "ward"],
        look: { ink: "#1f3d3a", tint: "#4fb3a5", accent: "#f2c230", hat: "hood", extra: "glasses" },
        sloppiness: 0.3,
        intro: "Lin builds walls at mid-field. A straight line runs right into them.",
        lesson: "Shift (β₀) lifts the whole line; Tilt (β₁) swings it through the middle. Only one of them clears a wall.",
    },
    outlier: {
        id: "outlier",
        name: "The Outlier",
        title: "Heir of the Tails",
        hp: 5,
        ap: 2,
        handSize: 3,
        deck: ["chain_lightning", "chain_lightning", "jinx", "shift", "tilt", "move"],
        look: { ink: "#3a1020", tint: "#e0506a", accent: "#ffb36b", hat: "crown", extra: "cape" },
        sloppiness: 0.15,
        intro: "The Outlier lives in the tails: huge lightning, and Jinxes that double your spread.",
        lesson: "Wide bands are gambles. Focus halves your spread; a sure 1 damage often beats a risky 2.",
    },
}
