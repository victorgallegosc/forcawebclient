import { cp, mkdir, stat } from "node:fs/promises";
import { join } from "node:path";

const outputDir = "dist";
const compatibilityDir = join(outputDir, "client");
const publicEntries = ["assets", "favicon.ico", "robots.txt", "_headers"];

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

// Nitro's Netlify preset emits public files in dist/. Some existing Netlify
// sites can retain dist/client as a UI-level publish override, which takes
// precedence over netlify.toml. Mirror only public files so either setting
// serves the same hashed assets without copying the server bundle.
if (process.env.NETLIFY === "true" && (await exists(join(outputDir, "assets")))) {
  await mkdir(compatibilityDir, { recursive: true });

  for (const entry of publicEntries) {
    const source = join(outputDir, entry);
    if (await exists(source)) {
      await cp(source, join(compatibilityDir, entry), { recursive: true });
    }
  }

  console.log("Mirrored Netlify public assets to dist/client for compatibility.");
}