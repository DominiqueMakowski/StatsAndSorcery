// The rules on a big sticky note taped over the battlefield: shown before your first duel, and on demand.

import type { Character } from "../content/characters"

export class RulesNote {
    private onClose: (() => void) | null = null

    constructor(private el: HTMLElement) {
        el.querySelector(".rules-ok")!.addEventListener("click", () => this.hide())
    }

    get isOpen(): boolean {
        return !this.el.hidden
    }

    /** Numbers come from the character, so the note stays true if the balance changes. */
    show(you: Character, onClose?: () => void) {
        this.el.querySelector(".rules-list")!.innerHTML = `
            <li>It's <b>turn by turn</b>: you act, then your opponent does.</li>
            <li>Each turn you draw <b>${you.handSize} action cards</b> from your spellbook: <b>spells</b> to attack, <b>movements</b> to change lane and, later, <b>alterations</b> that tweak your next spell.</li>
            <li>You get <b>${you.ap} action points ★</b> each turn (use them or lose them). Each card costs the ★ in its corner.</li>
            <li><b>Click cards below</b> to plan your turn. They're played <b>in the order you pick them</b> when you press <b>Cast!</b></li>
            <li>Spells that hit scratch out their ♥. Scratch them all out to win.</li>`
        // Reopening while open (the "? rules" link) keeps whatever was waiting for it to close.
        this.onClose = onClose ?? (this.isOpen ? this.onClose : null)
        this.el.hidden = false
        this.el.classList.remove("is-in")
        void this.el.offsetWidth
        this.el.classList.add("is-in")
    }

    hide() {
        if (this.el.hidden) return
        this.el.hidden = true
        const done = this.onClose
        this.onClose = null
        done?.()
    }
}
