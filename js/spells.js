// --- Spells ---
const SpellType = {
    ATTACK: "attack",
    MODIFIER: "modifier",
    MOVE: "move",
}

class Spell {
    constructor(name, type, description, parameters, cost = 1, color = "#333", available = 1) {
        this.name = name
        this.type = type
        this.description = description
        this.parameters = parameters
        this.cost = cost
        this.color = color
        this.available = available
    }
}

const Compendium = [
    new Spell(
        "Ice Beam",
        SpellType.ATTACK,
        "", // Description generated dynamically
        {
            beta_zero: 0,
            beta_zero_min: 0.0,
            beta_zero_max: 0.0,
            beta_zero_ci: 0.95,
            beta_x: 0,
            beta_x_min: -0.1,
            beta_x_max: 0.1,
            beta_x_ci: 0.95,
            duration: 1000,
            visual_type: "ray",
            visual_color: "lightblue",
        },
        1,
        "#e0f7fa",
        2 // Available twice
    ),
    new Spell(
        "Fireball",
        SpellType.ATTACK,
        "",
        {
            beta_zero: 0,
            beta_zero_min: 0,
            beta_zero_max: 0.0,
            beta_zero_ci: 0.95,
            beta_x: 0,
            beta_x_min: -0.5,
            beta_x_max: 0.5,
            beta_x_ci: 0.95,
            duration: 1000,
            visual_type: "projectile",
            visual_color: "orange",
        },
        1,
        "#ffccbc",
        1
    ),
    new Spell(
        "Lightning Bolt",
        SpellType.ATTACK,
        "",
        {
            beta_zero: 0,
            beta_zero_min: -0.5,
            beta_zero_max: 0.5,
            beta_zero_ci: 0.95,
            beta_x: 0,
            beta_x_min: -0.5,
            beta_x_max: 0.5,
            beta_x_ci: 0.95,
            duration: 800,
            visual_type: "ray",
            visual_color: "purple",
            animation_prespell: "img/darkcloud.png",
        },
        1,
        "#e1bee7",
        1
    ),
    new Spell("Alteration", SpellType.MODIFIER, "B(x) - 1", { beta_x_modify: -1 }, 1, "#ffe0b2", 2),
    new Spell("Alteration", SpellType.MODIFIER, "B(0) - 1", { beta_zero_modify: -1 }, 1, "#ffe0b2", 2),
    new Spell("Move", SpellType.MOVE, "Move Y+1", { move_self_y: 1 }, 1, "#dcedc8", 0),
    new Spell("Move", SpellType.MOVE, "Move Y-1", { move_self_y: -1 }, 1, "#dcedc8", 0),
    new Spell("Strong Wind", SpellType.MOVE, "Push Enemy Y+1", { move_target_y: 1 }, 1, "#a5d6a7", 0),
]
