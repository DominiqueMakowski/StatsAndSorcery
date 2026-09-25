// Professor Hoot's sticky notes: short, contextual tips that appear at most once each.

const STORAGE_KEY = "sas.tips"

export class Coach {
    private seen = new Set<string>()
    private timer = 0
    private textEl: HTMLElement

    constructor(private el: HTMLElement) {
        this.textEl = el.querySelector(".coach-text")!
        try {
            for (const k of JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")) this.seen.add(k)
        } catch {
            // ignore
        }
        el.querySelector(".coach-close")?.addEventListener("click", () => this.hide())
    }

    /** Show a tip once per key (persisted), or every time when `always` is set. */
    say(key: string, text: string, always = false) {
        if (!always && !this.firstTime(key)) return
        this.textEl.innerHTML = text
        this.el.hidden = false
        this.el.classList.remove("is-in")
        void this.el.offsetWidth
        this.el.classList.add("is-in")
        clearTimeout(this.timer)
        this.timer = window.setTimeout(() => this.hide(), 11000)
    }

    /** True the first time a key comes up (persisted), then false until tips are reset. */
    firstTime(key: string): boolean {
        if (this.seen.has(key)) return false
        this.seen.add(key)
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify([...this.seen]))
        } catch {
            // ignore
        }
        return true
    }

    hide() {
        this.el.hidden = true
        clearTimeout(this.timer)
    }

    /** Forget every tip (for the "show tips again" toggle). */
    reset() {
        this.seen.clear()
        try {
            localStorage.removeItem(STORAGE_KEY)
        } catch {
            // ignore
        }
    }
}
