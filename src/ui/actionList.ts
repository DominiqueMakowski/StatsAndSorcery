// The action list: every action in the game, grouped by type and sorted by when you can first use it.

import { Actions } from "../content/actions"
import { Characters } from "../content/characters"
import { RUN_STAGES } from "../content/run"
import type { Action } from "../core/types"
import { createCard } from "./cards"

const GROUPS: { title: string; blurb: string; kinds: Action["kind"][] }[] = [
    { title: "Spells", blurb: "Attacks. Each one trades precision against power.", kinds: ["spell"] },
    { title: "Movements", blurb: "Change where you stand.", kinds: ["movement"] },
    { title: "Alterations", blurb: "Change one parameter of your next spell.", kinds: ["alteration"] },
    { title: "Opponent tricks", blurb: "Things only your opponents can do, for now.", kinds: ["ward", "hex"] },
]

/** When the player can first use an action in a run: a sort key and a pencilled label. */
function availability(action: Action): { order: number; label: string } {
    if (Characters.apprentice.deck.includes(action.id)) return { order: 0, label: "from the start" }
    const stage = RUN_STAGES.findIndex((s) => s.rewards.includes(action.id))
    if (stage >= 0) return { order: stage + 1, label: `reward after duel ${stage + 1}` }
    if (action.enemyOnly) return { order: 90, label: "opponents only" }
    return { order: 80, label: "not in the run yet" }
}

function usedBy(action: Action): string[] {
    return Object.values(Characters)
        .filter((c) => c.id !== "apprentice" && c.deck.includes(action.id))
        .map((c) => c.name)
}

export function buildActionList(): HTMLElement {
    const list = document.createElement("div")
    list.className = "action-list"
    for (const group of GROUPS) {
        const entries = Object.values(Actions)
            .filter((a) => group.kinds.includes(a.kind))
            .map((action) => ({ action, when: availability(action) }))
            .sort((x, y) => x.when.order - y.when.order || x.action.cost - y.action.cost)
        if (entries.length === 0) continue

        const section = document.createElement("section")
        section.className = "action-group"
        section.innerHTML = `<h3>${group.title}</h3><p class="action-blurb">${group.blurb}</p>`
        const row = document.createElement("div")
        row.className = "action-row"
        for (const { action, when } of entries) {
            const cell = document.createElement("div")
            cell.className = "action-cell"
            const card = createCard(action, { affordable: true })
            card.classList.add("is-listed")
            cell.appendChild(card)
            const users = usedBy(action)
            cell.insertAdjacentHTML("beforeend", `<p class="action-when">${when.label}</p>${users.length ? `<p class="action-users">used by ${users.join(", ")}</p>` : ""}`)
            row.appendChild(cell)
        }
        section.appendChild(row)
        list.appendChild(section)
    }
    return list
}
