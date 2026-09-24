import { defineConfig } from "vite"

// Relative base so the build works both locally and under a GitHub Pages sub-path.
export default defineConfig({
    base: "./",
    server: {
        // Honour a port handed to us by the environment (e.g. the editor's preview runner).
        port: Number(process.env.PORT) || 5173,
        strictPort: false,
    },
})
