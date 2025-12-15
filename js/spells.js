// --- Spells ---
const SpellType = {
    ATTACK: "attack",
    MODIFIER: "modifier",
    MOVE: "move",
}

class Spell {
    constructor(id, name, type, description, parameters, color = "#333") {
        this.id = id
        this.name = name
        this.type = type
        this.description = description
        this.parameters = parameters
        this.color = color
    }
}

const Compendium = [
    // OFFENSIVE SPELLS
    new Spell(
        "F1",
        "Flame",
        SpellType.ATTACK,
        "",
        {
            cost: 1,
            damage: 1,
            beta_zero: 0,
            beta_zero_min: 0,
            beta_zero_max: 0.0,
            beta_zero_ci: 0.95,
            beta_x: 0,
            beta_x_min: -0.3,
            beta_x_max: 0.3,
            beta_x_ci: 0.95,
            duration: 1000,
            visual_type: "projectile",
            animation_projectile: "img/flame.png",
        },
        "#ffccbc"
    ),
    new Spell( // This spell is the most precise but by default only fires straight
        "IB1",
        "Ice Beam",
        SpellType.ATTACK,
        "", // Description generated dynamically
        {
            cost: 2,
            damage: 1,
            beta_zero: 0,
            beta_zero_min: 0.0,
            beta_zero_max: 0.0,
            beta_zero_ci: 0.95,
            beta_x: 0,
            beta_x_min: -0.05,
            beta_x_max: 0.05,
            beta_x_ci: 0.95,
            duration: 1000,
            visual_type: "ray",
            visual_color: "lightblue",
        },
        "#e0f7fa"
    ),

    new Spell( // This spell has the wider uncertainty
        "LB1",
        "Lightning Bolt",
        SpellType.ATTACK,
        "",
        {
            cost: 1,
            damage: 1,
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
        "#e1bee7"
    ),
    new Spell(
        "SW1",
        "Strong Wind",
        SpellType.ATTACK,
        "Push Enemy (y+1)",
        { cost: 1, damage: 1, move_target_y: 1, animation_prespell: "img/wind.png" },
        "#a5d6a7"
    ),
    new Spell(
        "SW2",
        "Strong Wind",
        SpellType.ATTACK,
        "Push Enemy (y-1)",
        { cost: 1, damage: 1, move_target_y: -1, animation_prespell: "img/wind.png" },
        "#a5d6a7"
    ),

    // METAMAGIC SPELLS
    new Spell("A1", "Alteration", SpellType.MODIFIER, "B(x) - 1", { cost: 1, beta_x_modify: -1 }, "#ffe0b2"),
    new Spell("A2", "Alteration", SpellType.MODIFIER, "B(x) + 1", { cost: 1, beta_x_modify: 1 }, "#ffe0b2"),
    new Spell(
        "A3",
        "Alteration",
        SpellType.MODIFIER,
        "B(0) - 1",
        { cost: 1, beta_zero_modify: -1, animation_prespell: "img/portal.png" },
        "#ffe0b2"
    ),
    new Spell(
        "A4",
        "Alteration",
        SpellType.MODIFIER,
        "B(0) + 1",
        { cost: 1, beta_zero_modify: 1, animation_prespell: "img/portal.png" },
        "#ffe0b2"
    ),

    // MOVEMENT SPELLS
    new Spell("D1", "Dodge", SpellType.MOVE, "Move (y+1)", { cost: 1, move_self_y: 1 }, "#dcedc8"),
    new Spell("D2", "Dodge", SpellType.MOVE, "Move (y-1)", { cost: 1, move_self_y: -1 }, "#dcedc8"),
]
