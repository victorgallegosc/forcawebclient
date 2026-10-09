// Publishable-key client for server-side use. Works on any host (Netlify
// included) without a private service key: tables are read-only and every
// write goes through narrow security-definer database functions.
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

const DEFAULT_URL = "https://leggouvupbatbzihmwxw.supabase.co";
const DEFAULT_KEY = "sb_publishable_x01V98AhdUvMCBhddnpWsA_gVTJzrVa";

function isNewSupabaseApiKey(value: string): boolean {
  return value.startsWith("sb_publishable_") || value.startsWith("sb_secret_");
}

/** Netlify sometimes sets VITE_SUPABASE_URL to the site origin — ignore that. */
function isUsableSupabaseUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const host = new URL(value).hostname;
    return host.endsWith(".supabase.co") || host.endsWith(".supabase.in");
  } catch {
    return false;
  }
}

function resolveUrl() {
  const fromEnv = process.env["SUPABASE_URL"] || process.env["VITE_SUPABASE_URL"];
  // Prefer a real Supabase host from env; otherwise the Lovable Cloud project.
  return isUsableSupabaseUrl(fromEnv) ? fromEnv : DEFAULT_URL;
}

function resolveKey() {
  return (
    process.env["SUPABASE_PUBLISHABLE_KEY"] ||
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ||
    DEFAULT_KEY
  );
}

function build() {
  const url = resolveUrl();
  const key = resolveKey();

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
