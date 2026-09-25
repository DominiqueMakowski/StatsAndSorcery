// Renders og.html (the social card) to public/og.png with headless Chrome.
// Usage: bun run og   (set CHROME=/path/to/chrome if it isn't found)

import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createServer } from "vite"

const candidates = [
    process.env.CHROME,
    "C:/Program Files/Google/Chrome/Application/chrome.exe",
    "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
]
const chrome = candidates.find((c) => c && existsSync(c))
if (!chrome) throw new Error("No Chrome found; set CHROME=/path/to/chrome")

const server = await createServer({ server: { port: 0 }, logLevel: "error" })
await server.listen()
const url = `${server.resolvedUrls!.local[0]}og.html`

// --dump-dom waits for the page to settle; og.ts leaves the canvas as a data URL in #png, so the
// PNG is exactly the canvas (a --screenshot would be cropped by the window frame). A throwaway
// profile stops it handing off to a Chrome that's already open, and the spawn is async because a
// sync one would block the Vite server running in this same process.
const profile = mkdtempSync(join(tmpdir(), "sas-og-"))
const proc = Bun.spawn([chrome, "--headless=new", "--disable-gpu", `--user-data-dir=${profile}`, "--virtual-time-budget=10000", "--dump-dom", url], {
    stderr: "ignore",
    timeout: 60_000,
})
const dom = await new Response(proc.stdout).text()
await proc.exited
await server.close()
rmSync(profile, { recursive: true, force: true })

const match = dom.match(/data:image\/png;base64,([A-Za-z0-9+/=]+)/)
if (!match) throw new Error("The card didn't render: open /og.html on the dev server to check")
mkdirSync("public", { recursive: true })
writeFileSync("public/og.png", Buffer.from(match[1], "base64"))
console.log("wrote public/og.png")
