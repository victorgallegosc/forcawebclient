// Publishable-key client for server-side use. Works on any host (Netlify
// included) without a private service key: tables are read-only and every
// write goes through narrow security-definer database functions.
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

const DEFAULT_URL = "https://leggouvupbatbzihmwxw.supabase.co";
const DEFAULT_KEY = "sb_publishable_x01V98AhdUvMCBhddnpWsA_gVTJzrVa";

function build() {
  // Fixed on purpose: the rides database lives in Lovable Cloud, so host
  // environment variables (which may point elsewhere) are ignored.
  const url = DEFAULT_URL;
  const key = DEFAULT_KEY;

  return createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
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
