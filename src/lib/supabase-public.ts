// Publishable-key client for server-side ride reads/writes.
// Credentials come from the Vercel project env (SUPABASE_URL +
// SUPABASE_PUBLISHABLE_KEY). No service role key — tables are read-only for
// this key; writes go through security-definer RPCs.
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

/** True only for a real Supabase API host — not the app's own deploy URL. */
function isUsableSupabaseUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const host = new URL(value).hostname.toLowerCase();
    return host.endsWith(".supabase.co") || host.endsWith(".supabase.in");
  } catch {
    return false;
  }
}

function resolveCredentials() {
  const key =
    process.env["SUPABASE_PUBLISHABLE_KEY"] ||
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

  const projectId =
    process.env["SUPABASE_PROJECT_ID"] ||
    process.env["VITE_SUPABASE_PROJECT_ID"];

  // Prefer server env, then Vite env — never the site origin.
  const urlFromEnv = [
    process.env["SUPABASE_URL"],
    process.env["VITE_SUPABASE_URL"],
  ].find(isUsableSupabaseUrl);

  const urlFromProjectId =
    projectId && /^[a-z0-9]{10,}$/i.test(projectId)
      ? `https://${projectId}.supabase.co`
      : undefined;

  const url = urlFromEnv ?? urlFromProjectId;

  if (!url || !key) {
    const missing = [
      ...(!url ? ["SUPABASE_URL (https://<ref>.supabase.co)"] : []),
      ...(!key ? ["SUPABASE_PUBLISHABLE_KEY"] : []),
    ];
    throw new Error(
      `Missing or invalid Supabase env on Vercel: ${missing.join(", ")}.`,
    );
  }

  return { url, key };
}

function build() {
  const { url, key } = resolveCredentials();

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        // New Supabase API keys are opaque strings, not bearer JWTs.
        if (
          isNewSupabaseApiKey(key) &&
          headers.get("Authorization") === `Bearer ${key}`
        ) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
    },
  });
}

let client: ReturnType<typeof build> | undefined;

export function publicDb() {
  if (!client) client = build();
  return client;
}
