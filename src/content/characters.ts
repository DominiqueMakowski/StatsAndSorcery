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
    /** AI only: how much it fears the damage it could take next turn where it ends up (0 = ignores it). */
    caution?: number
    /** Where this wizard stands when a duel begins (default 0, the middle lane). */
    startY?: number
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
        // The basics only: one spell and one movement. The run adds the rest.
        deck: ["flame", "flame", "flame", "flame", "move", "move", "move"],
        look: { ink: "#1e2a5a", tint: "#5b8def", accent: "#f2c230", hat: "pointed", extra: "scarf" },
        sloppiness: 0,
    },
    plotter: {
        id: "plotter",
        name: "Harry Plotter",
        title: "The Boy Who Plotted",
        hp: 4,
        ap: 2,
        handSize: 3,
        deck: ["flame", "flame", "flame", "move", "move", "move"],
        look: { ink: "#2b2b2b", tint: "#b47ee8", accent: "#7bd389", hat: "wide", extra: "glasses" },
        sloppiness: 0.4,
        // A dodger: hits and runs, and starts a lane off your line so turn one is already a choice.
        caution: 0.8,
        startY: 0.25,
        intro: "Harry never stands still. When he hops out of your lane, Move back in before you cast.",
        lesson: "The hatched band is where 95% of your Flames land. The further they fly, the wider it gets.",
    },
    malfit: {
        id: "malfit",
        name: "Draco Malfit",
        title: "The Badly Fitted",
        hp: 4,
        ap: 2,
        handSize: 3,
        deck: ["flame", "flame", "slope", "intercept", "ward", "ward"],
        look: { ink: "#1f3d2a", tint: "#3f9a6b", accent: "#c0c6cc", hat: "hood", extra: "cape" },
        sloppiness: 0.3,
        caution: 0.5,
        intro: "Draco builds walls at mid-field. A straight line runs right into them.",
        lesson: "The intercept (β₀) lifts the whole line; the slope (β₁) swings it through the middle. Only one of them clears a wall.",
    },
    voldemode: {
        id: "voldemode",
        name: "Lord Voldemode",
        title: "He-Who-Must-Not-Be-Normalised",
        hp: 5,
        ap: 2,
        handSize: 3,
        deck: ["chain_lightning", "chain_lightning", "jinx", "intercept", "slope", "move"],
        look: { ink: "#1a1a1a", tint: "#7a7a8c", accent: "#7bd389", hat: "crown", extra: "cape" },
        sloppiness: 0.15,
        caution: 0.3,
        intro: "Lord Voldemode lives in the tails: huge lightning, and Jinxes that double your spread.",
        lesson: "Wide bands are gambles. SD ÷ 2 narrows yours; a sure 1 damage often beats a risky 2.",
    },
}
