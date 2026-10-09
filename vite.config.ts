// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

// Production host is Vercel (SUPABASE_* env lives there). Vercel sets VERCEL=1
// during build; Nitro must use the vercel preset — the old hard-coded "netlify"
// preset broke SSR/server functions on Vercel. Override with NITRO_PRESET if needed.
const nitroPreset =
  process.env["NITRO_PRESET"] ||
  (process.env["VERCEL"] ? "vercel" : undefined);

export default defineConfig({
  ...(nitroPreset ? { nitro: { preset: nitroPreset } } : {}),
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
