// --- Entities ---
class Wizard {
    constructor(name, hp, x, y, color) {
        this.name = name
        this.maxHp = hp
        this.hp = hp
        this.x = x // Grid coordinates (0-2 usually)
        this.y = y
        this.targetY = y
        this.color = color
        this.width = 60 // Sprite width in pixels
        this.height = 60 // Sprite height in pixels
        this.modifiers = {
            beta_x: 0,
            beta_zero: 0,
        }
        this.spellBook = []
    }

    setSpellBook(spells) {
        this.spellBook = spells
    }

    takeDamage(amount) {
        this.hp -= amount
        if (this.hp < 0) this.hp = 0
    }

    isAlive() {
        return this.hp > 0
    }

    resetModifiers() {
        this.modifiers.beta_x = 0
        this.modifiers.beta_zero = 0
    }
}
